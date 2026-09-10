'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Search,
  AlertCircle,
  Building2,
  Camera,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PostDispatchInvoiceSummary } from './InvoiceCard';
import MobilePostDispatchCard from './MobilePostDispatchCard';
import InvoiceDetailModal from './InvoiceDetailModal';
import ReceivingUploadModal from './ReceivingUploadModal';
import CheckedUploadModal from './CheckedUploadModal';
import MobileImagePreview from '@/components/mobile/MobileImagePreview';

export interface MobilePostDispatchViewProps {
  permissions: {
    canPostDispatch: boolean;
    canReceivingUpload: boolean;
    canCheckedUpload: boolean;
  };
  user: {
    id: string;
    name: string;
  };
  refreshTrigger?: number;
  onRefreshStateChange?: (refreshing: boolean) => void;
}

type OperationalQueue = 'hub' | 'receiving' | 'check';

function formatINR(val: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

export default function MobilePostDispatchView({
  permissions,
  user,
  refreshTrigger,
  onRefreshStateChange,
}: MobilePostDispatchViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial queue & warehouse from URL
  const initialQueueParam = searchParams.get('queue') as OperationalQueue | null;
  const initialQueue: OperationalQueue =
    initialQueueParam && ['hub', 'receiving', 'check'].includes(initialQueueParam)
      ? initialQueueParam
      : 'hub';

  const [activeQueue, setActiveQueue] = useState<OperationalQueue>(initialQueue);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    searchParams.get('warehouse') || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [invoices, setInvoices] = useState<PostDispatchInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);

  // Active Modals
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [uploadReceivingInvoice, setUploadReceivingInvoice] = useState<PostDispatchInvoiceSummary | null>(null);
  const [uploadCheckedInvoice, setUploadCheckedInvoice] = useState<PostDispatchInvoiceSummary | null>(null);

  // Fullscreen photo preview
  const [previewPhoto, setPreviewPhoto] = useState<{
    isOpen: boolean;
    url: string | null;
    title?: string;
  }>({
    isOpen: false,
    url: null,
  });

  // Keep state in sync with URL search params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('dispatch', 'post');

      Object.entries(updates).forEach(([key, val]) => {
        if (!val || val === 'hub' || val === 'ALL') {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const handleQueueChange = (queue: OperationalQueue) => {
    setActiveQueue(queue);
    updateUrlParams({ queue: queue === 'hub' ? null : queue });
  };

  const handleWarehouseChange = (wh: string) => {
    setSelectedWarehouse(wh);
    updateUrlParams({ warehouse: wh === 'ALL' ? null : wh });
  };

  // ── Fetch Invoices (LOCAL ERP DATA ONLY) ─────────────────────────
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
      onRefreshStateChange?.(true);
    }
    try {
      // Invoices (fetch active invoices)
      const invRes = await fetch('/api/mobile/post-dispatch/invoices?tab=all&pageSize=all');
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.invoices || []);
        setUnauthorizedMessage(null);
      } else if (invRes.status === 403) {
        const errJson = await invRes.json().catch(() => ({}));
        setUnauthorizedMessage(errJson.error || 'Access to Post-Dispatch is restricted.');
      }

      if (isManualRefresh) {
        toast.success('Post-dispatch queues updated');
      }
    } catch (err) {
      console.error('[PostDispatch Mobile Fetch Error]', err);
      if (isManualRefresh) {
        toast.error('Failed to refresh data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      onRefreshStateChange?.(false);
    }
  }, [onRefreshStateChange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Trigger refresh when header refresh button clicked
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchData(true);
    }
  }, [refreshTrigger, fetchData]);

  // ── Unique Available Warehouses ──────────────────────────────────────────
  const availableWarehouses = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.warehouseName) set.add(inv.warehouseName);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // ── Filtered Datasets by Warehouse ───────────────────────────────────────
  const warehouseFilteredInvoices = useMemo(() => {
    if (selectedWarehouse === 'ALL') return invoices;
    return invoices.filter(
      (inv) => (inv.warehouseName || 'Not Assigned') === selectedWarehouse
    );
  }, [invoices, selectedWarehouse]);

  // ── Queue Counts (Actionable Operational Logic) ──────────────────────────
  // A. Pending Receiving Upload:
  // Invoices where receiving is PENDING or REWORK_REQUIRED (not COMPLETED, not AWAITING_VERIFICATION)
  // Eligible: Active erpStatus, not draft/void zohoStatus, not Void erpSubStatus
  const receivingUploadInvoices = useMemo(() => {
    return warehouseFilteredInvoices.filter((inv) => {
      const zStatus = (inv.zohoStatus || '').toLowerCase();
      if (inv.erpStatus !== 'Active') return false;
      if (zStatus === 'draft' || zStatus === 'void') return false;
      if (inv.erpSubStatus === 'Void') return false;
      const rStatus = inv.workflowSummary?.receivingStatus;
      return rStatus === 'PENDING' || rStatus === 'REWORK_REQUIRED';
    });
  }, [warehouseFilteredInvoices]);

  // B. Pending Check Upload:
  // Invoices where physical check is PENDING or REWORK_REQUIRED (not COMPLETED, not AWAITING_VERIFICATION)
  // Eligible: Active erpStatus, not draft/void zohoStatus, not Void erpSubStatus
  const checkedUploadInvoices = useMemo(() => {
    return warehouseFilteredInvoices.filter((inv) => {
      const zStatus = (inv.zohoStatus || '').toLowerCase();
      if (inv.erpStatus !== 'Active') return false;
      if (zStatus === 'draft' || zStatus === 'void') return false;
      if (inv.erpSubStatus === 'Void') return false;
      const cStatus = inv.workflowSummary?.checkedStatus;
      return cStatus === 'PENDING' || cStatus === 'REWORK_REQUIRED';
    });
  }, [warehouseFilteredInvoices]);

  // ── Search Filtering within active queue ──────────────────────────────────
  const searchLower = searchQuery.trim().toLowerCase();

  const searchedReceivingList = useMemo(() => {
    if (!searchLower) return receivingUploadInvoices;
    return receivingUploadInvoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(searchLower) ||
        inv.customerName.toLowerCase().includes(searchLower) ||
        (inv.salesOrderNumber && inv.salesOrderNumber.toLowerCase().includes(searchLower))
    );
  }, [receivingUploadInvoices, searchLower]);

  const searchedCheckedList = useMemo(() => {
    if (!searchLower) return checkedUploadInvoices;
    return checkedUploadInvoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(searchLower) ||
        inv.customerName.toLowerCase().includes(searchLower) ||
        (inv.salesOrderNumber && inv.salesOrderNumber.toLowerCase().includes(searchLower))
    );
  }, [checkedUploadInvoices, searchLower]);

  // User permission flags
  const canSeeReceiving = permissions.canReceivingUpload;
  const canSeeCheck = permissions.canCheckedUpload;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-0">
      {/* Compact Warehouse Selector Bar (Refined Filter Pill) */}
      <div className="px-4 py-2 bg-white border-b border-slate-200/80 sticky top-[95px] z-30 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0 bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/70 transition-colors">
          <Building2 size={15} className="text-[#1A2766] shrink-0" />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
              Warehouse:
            </span>
            <select
              value={selectedWarehouse}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none truncate cursor-pointer flex-1 min-w-0 py-0.5"
            >
              <option value="ALL">All Warehouses</option>
              {availableWarehouses.map((wh) => (
                <option key={wh} value={wh}>
                  {wh}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-[430px] mx-auto w-full pb-20 space-y-4">
        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-slate-200 rounded w-28" />
                  <div className="h-4 bg-slate-200 rounded w-16" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-44" />
                <div className="h-10 bg-slate-100 rounded-xl mt-2" />
              </div>
            ))}
          </div>
        ) : unauthorizedMessage ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-amber-200 bg-amber-50/30 text-slate-700 space-y-3 my-4">
            <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
            <h3 className="font-bold text-sm text-slate-900">Post-Dispatch Access Restricted</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{unauthorizedMessage}</p>
          </div>
        ) : activeQueue === 'hub' ? (
          /* ── LANDING QUEUE HUB VIEW ─────────────────────────────────────── */
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
              Operational Action Queues
            </div>

            {/* A. Pending Receiving Upload Card */}
            {canSeeReceiving && (
              <div
                onClick={() => handleQueueChange('receiving')}
                className="bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100/60 shrink-0">
                    <Camera size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="font-bold text-slate-800 text-[15px]">
                      Pending Receiving Upload
                    </div>
                    <div className="text-[12px] text-slate-500 font-medium truncate">
                      Customer receiving proof & photos
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      receivingUploadInvoices.length > 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {receivingUploadInvoices.length}
                  </span>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </div>
            )}

            {/* B. Pending Check Upload Card */}
            {canSeeCheck && (
              <div
                onClick={() => handleQueueChange('check')}
                className="bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 bg-purple-50 text-purple-700 rounded-xl border border-purple-100/60 shrink-0">
                    <FileCheck size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="font-bold text-slate-800 text-[15px]">
                      Pending Check Upload
                    </div>
                    <div className="text-[12px] text-slate-500 font-medium truncate">
                      Checked By / Checked At evidence
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      checkedUploadInvoices.length > 0
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {checkedUploadInvoices.length}
                  </span>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </div>
            )}

            {/* No Action Queues Available for user permissions */}
            {!canSeeReceiving && !canSeeCheck && (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center">
                <p className="text-sm text-slate-600 font-medium">
                  No post-dispatch operational queues are assigned to your account.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Please contact your administrator to request upload permissions.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── QUEUE DRILLDOWN VIEW ───────────────────────────────────────── */
          <div className="space-y-3">
            {/* Back Button & Queue Title Header */}
            <div className="flex items-center justify-between gap-2 pb-1">
              <button
                type="button"
                onClick={() => handleQueueChange('hub')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1A2766] py-1 px-2.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
                <span>All Queues</span>
              </button>

              <div className="text-xs font-bold text-slate-700">
                {activeQueue === 'receiving' && `Pending Receiving (${searchedReceivingList.length})`}
                {activeQueue === 'check' && `Pending Check (${searchedCheckedList.length})`}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice #, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 border border-slate-200 text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* List for Pending Receiving */}
            {activeQueue === 'receiving' && (
              searchedReceivingList.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-slate-700">No Receiving Uploads Pending</p>
                  <p className="text-xs text-slate-400">
                    {searchQuery
                      ? 'No invoices match your search query.'
                      : 'All eligible invoices have receiving proofs uploaded.'}
                  </p>
                </div>
              ) : (
                searchedReceivingList.map((inv) => (
                  <MobilePostDispatchCard
                    key={inv.id}
                    invoice={inv}
                    activeQueue="receiving"
                    onAction={(i) => setUploadReceivingInvoice(i)}
                  />
                ))
              )
            )}

            {/* List for Pending Check */}
            {activeQueue === 'check' && (
              searchedCheckedList.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-slate-700">No Physical Checks Pending</p>
                  <p className="text-xs text-slate-400">
                    {searchQuery
                      ? 'No invoices match your search query.'
                      : 'All eligible invoices have physical check evidence submitted.'}
                  </p>
                </div>
              ) : (
                searchedCheckedList.map((inv) => (
                  <MobilePostDispatchCard
                    key={inv.id}
                    invoice={inv}
                    activeQueue="check"
                    onAction={(i) => setUploadCheckedInvoice(i)}
                  />
                ))
              )
            )}
          </div>
        )}
      </main>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {/* 1. Invoice Detail Modal */}
      {detailInvoiceId && (
        <InvoiceDetailModal
          isOpen={!!detailInvoiceId}
          onClose={() => setDetailInvoiceId(null)}
          invoiceId={detailInvoiceId}
          onPhotoClick={(url, title) => setPreviewPhoto({ isOpen: true, url, title })}
          onUpdated={() => fetchData(false)}
        />
      )}

      {/* 2. Receiving Upload Modal */}
      {uploadReceivingInvoice && (
        <ReceivingUploadModal
          isOpen={!!uploadReceivingInvoice}
          onClose={() => setUploadReceivingInvoice(null)}
          invoiceId={uploadReceivingInvoice.id}
          invoiceNumber={uploadReceivingInvoice.invoiceNumber}
          customerName={uploadReceivingInvoice.customerName}
          onSuccess={() => fetchData(false)}
        />
      )}

      {/* 3. Checked Upload Modal */}
      {uploadCheckedInvoice && (
        <CheckedUploadModal
          isOpen={!!uploadCheckedInvoice}
          onClose={() => setUploadCheckedInvoice(null)}
          invoiceId={uploadCheckedInvoice.id}
          invoiceNumber={uploadCheckedInvoice.invoiceNumber}
          customerName={uploadCheckedInvoice.customerName}
          currentUserName={user.name}
          onSuccess={() => fetchData(false)}
        />
      )}

      {/* 4. Fullscreen Image Preview */}
      <MobileImagePreview
        isOpen={previewPhoto.isOpen}
        onClose={() => setPreviewPhoto({ isOpen: false, url: null })}
        imageUrl={previewPhoto.url}
        title={previewPhoto.title || 'Evidence Preview'}
      />
    </div>
  );
}

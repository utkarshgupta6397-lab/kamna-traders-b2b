'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Search,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PostDispatchInvoiceSummary } from '@/components/dispatch/post-dispatch/InvoiceCard';
import InvoiceDetailModal from '@/components/dispatch/post-dispatch/InvoiceDetailModal';
import SyncApiUsageModal from '@/components/dispatch/post-dispatch/SyncApiUsageModal';
import MobileImagePreview from '@/components/mobile/MobileImagePreview';

type TabKey = 'all' | 'pending' | 'verification' | 'archived';
type SortKey = 'index' | 'invoice' | 'customer' | 'amount' | 'status' | 'eInvoice' | 'timer';

function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

function LivePostDispatchTimer({ baseTs }: { baseTs: string }) {
  const [elapsedSec, setElapsedSec] = useState(() => {
    return Math.max(0, Math.floor((Date.now() - new Date(baseTs).getTime()) / 1000));
  });

  useEffect(() => {
    const update = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(baseTs).getTime()) / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [baseTs]);

  return (
    <div>
      <div className="font-semibold text-gray-800 tabular-nums text-xs font-mono">
        {formatElapsed(elapsedSec)}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {format(new Date(baseTs), 'dd MMM · hh:mm a')}
      </div>
    </div>
  );
}

function FrozenPostDispatchTimer({ baseTs, stoppedAt, elapsedSeconds }: { baseTs: string; stoppedAt?: string | null; elapsedSeconds: number }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-emerald-700 font-semibold tabular-nums text-xs font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
        <CheckCircle2 size={12} className="text-emerald-600" />
        {formatElapsed(elapsedSeconds)}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {stoppedAt ? format(new Date(stoppedAt), 'dd MMM · hh:mm a') : 'Duration'}
      </div>
    </div>
  );
}

export default function DesktopPostDispatchView({
  initialTab = 'all',
}: {
  initialTab?: TabKey;
} = {}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<PostDispatchInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);

  // Verification queue counts
  const [queueCounts, setQueueCounts] = useState<{ receiving: number; checked: number; total: number }>({
    receiving: 0,
    checked: 0,
    total: 0,
  });

  // Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ isOpen: boolean; url: string | null; title?: string }>({
    isOpen: false,
    url: null,
  });

  // Sorting and pagination
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'timer',
    direction: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  // Fetch logic
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/mobile/post-dispatch/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
        setUnauthorizedMessage(null);
      } else if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setUnauthorizedMessage(data.error || 'Forbidden. Post-Dispatch access required.');
      }
    } catch (err) {
      console.error('[Desktop PostDispatch Fetch Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, searchQuery]);

  const fetchQueueCounts = async () => {
    try {
      const res = await fetch('/api/mobile/post-dispatch/verification-queue');
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setQueueCounts(data.counts);
        }
      }
    } catch (err) {
      console.error('[Desktop Queue Counts Error]', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchQueueCounts();
  }, [fetchInvoices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchInvoices(), fetchQueueCounts()]);
    if (!unauthorizedMessage) {
      toast.success('Post-dispatch queue refreshed');
    }
  };

  // Reset pagination on search or tab switch
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  // Tab definitions with counts
  const tabs = useMemo(() => [
    { key: 'all' as TabKey, label: 'All Invoices' },
    { key: 'pending' as TabKey, label: 'Pending Action' },
    {
      key: 'verification' as TabKey,
      label: 'Verification Queue',
      count: queueCounts.total,
      badgeClass: 'bg-blue-100 text-blue-800',
    },
    { key: 'archived' as TabKey, label: 'Archived' },
  ], [queueCounts.total]);

  // Sorting
  const sortedInvoices = useMemo(() => {
    const list = [...invoices];
    list.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      switch (sortConfig.key) {
        case 'index':
          return sortConfig.direction === 'asc' ? 1 : -1;
        case 'invoice':
          valA = a.invoiceNumber.toLowerCase();
          valB = b.invoiceNumber.toLowerCase();
          break;
        case 'customer':
          valA = (a.customerName || '').toLowerCase();
          valB = (b.customerName || '').toLowerCase();
          break;
        case 'amount':
          valA = a.total ?? 0;
          valB = b.total ?? 0;
          break;
        case 'status':
          valA = a.zohoStatus.toLowerCase();
          valB = b.zohoStatus.toLowerCase();
          break;
        case 'eInvoice':
          valA = a.eInvoice.generated ? 1 : 0;
          valB = b.eInvoice.generated ? 1 : 0;
          break;
        case 'timer':
          valA = a.timer.elapsedSeconds;
          valB = b.timer.elapsedSeconds;
          break;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [invoices, sortConfig]);

  // Pagination
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(sortedInvoices.length / (pageSize as number)) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const paginatedInvoices = useMemo(() => {
    if (pageSize === 'all') return sortedInvoices;
    const start = (currentPage - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, currentPage, pageSize]);

  const SortableHeader = ({
    label,
    sortKey,
    align = 'left',
  }: {
    label: string;
    sortKey: SortKey;
    align?: 'left' | 'right' | 'center';
  }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        className={`px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100/50 transition-colors select-none group ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        }`}
        onClick={() => {
          setSortConfig(prev => ({
            key: sortKey,
            direction: prev.key === sortKey && prev.direction === 'asc' ? 'desc' : 'asc',
          }));
        }}
      >
        <div
          className={`flex items-center gap-1.5 ${
            align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''
          }`}
        >
          {label}
          <div className="flex-shrink-0 w-3">
            {isActive ? (
              sortConfig.direction === 'asc' ? (
                <ChevronUp size={12} className="text-[#1A2766]" />
              ) : (
                <ChevronDown size={12} className="text-[#1A2766]" />
              )
            ) : (
              <ArrowUpDown size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Desktop Horizontal Workflow Tabs */}
      <div className="px-6 border-b border-gray-100 bg-white overflow-x-auto">
        <div className="flex gap-4 -mb-px min-w-max">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  active
                    ? 'border-[#1A2766] text-[#1A2766]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tab.badgeClass}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Search & Action Bar */}
      <div className="px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/30">
        <div className="relative w-full sm:w-80 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search Invoice #, Customer, or SO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Sub-counters info when in verification tab */}
          {activeTab === 'verification' && (
            <div className="hidden md:flex items-center gap-2 text-xs mr-2 pr-3 border-r border-gray-200">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Awaiting:</span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100 text-[11px]">
                Rec: <strong>{queueCounts.receiving}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 text-[11px]">
                Chk: <strong>{queueCounts.checked}</strong>
              </span>
            </div>
          )}

          {/* Zoho Sync & Usage Button */}
          <button
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1A2766] rounded-lg text-xs font-semibold transition-colors"
            title="Zoho Books Sync & API Usage"
          >
            <Activity size={13} className="text-blue-600" />
            <span>Zoho Sync & Usage</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh Post-Dispatch List"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Access Restriction Notice */}
      {unauthorizedMessage && (
        <div className="m-6 p-6 rounded-xl border border-amber-200 bg-amber-50/50 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm text-gray-900">Post-Dispatch Access Restricted</h4>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{unauthorizedMessage}</p>
            <p className="text-[11px] text-gray-400 mt-2">
              Requires <code>dispatch_view</code> and <code>dispatch_post_dispatch</code> permission. Please contact your system administrator.
            </p>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      {!unauthorizedMessage && (
        <div className="flex-1 overflow-auto bg-gray-50/30 relative">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-xs">
              <tr>
                <SortableHeader label="#" sortKey="index" align="center" />
                <SortableHeader label="Invoice Number" sortKey="invoice" />
                <SortableHeader label="Customer" sortKey="customer" />
                <SortableHeader label="Amount" sortKey="amount" align="right" />
                <SortableHeader label="Zoho Status" sortKey="status" />
                <SortableHeader label="E-Invoice" sortKey="eInvoice" />
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                  Workflows (Rec / Chk / Inv)
                </th>
                <SortableHeader label="Timer" sortKey="timer" />
                <th className="px-4 py-3 border-b border-gray-200 w-24 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={15} className="animate-spin text-gray-300" />
                      <span className="text-sm">Loading post-dispatch invoices…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center max-w-xs mx-auto">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 border border-gray-100">
                        <FileText size={24} className="text-gray-300" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">No invoices found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {searchQuery
                          ? 'No invoices match your search query.'
                          : activeTab === 'verification'
                          ? 'No invoices currently awaiting verification.'
                          : activeTab === 'pending'
                          ? 'All actionable invoices have completed their workflows.'
                          : activeTab === 'archived'
                          ? 'No archived or void invoices recorded.'
                          : 'Click "Zoho Sync & Usage" to discover invoices from Zoho Books.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv, idx) => {
                  const globalIndex = pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const isVoid = inv.erpSubStatus === 'Void' || inv.zohoStatus.toLowerCase() === 'void';
                  const isDraft = inv.zohoStatus.toLowerCase() === 'draft';

                  const receivingDone = inv.workflowSummary.receivingStatus === 'COMPLETED';
                  const receivingAwaiting = inv.workflowSummary.receivingStatus === 'AWAITING_VERIFICATION';
                  const receivingRework = inv.workflowSummary.receivingStatus === 'REWORK_REQUIRED';

                  const checkedDone = inv.workflowSummary.checkedStatus === 'COMPLETED';
                  const checkedAwaiting = inv.workflowSummary.checkedStatus === 'AWAITING_VERIFICATION';
                  const checkedRework = inv.workflowSummary.checkedStatus === 'REWORK_REQUIRED';

                  const hasRework = receivingRework || checkedRework;
                  const hasAwaiting = receivingAwaiting || checkedAwaiting;

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        isVoid
                          ? 'bg-red-50/20'
                          : hasRework
                          ? 'bg-amber-50/30'
                          : hasAwaiting
                          ? 'bg-blue-50/20'
                          : ''
                      }`}
                    >
                      {/* # Index */}
                      <td className="px-4 py-3 text-center text-xs font-mono text-gray-400 w-12">
                        {globalIndex}
                      </td>

                      {/* Invoice Number */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="font-bold text-[#1A2766] hover:underline text-sm text-left"
                        >
                          {inv.invoiceNumber}
                        </button>
                        {inv.salesOrderNumber && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            SO: <span className="font-mono text-gray-600">{inv.salesOrderNumber}</span>
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="font-medium text-gray-900 text-sm truncate">
                          {inv.customerName || 'Unknown'}
                        </div>
                        {hasRework && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 mt-0.5">
                            <AlertCircle size={10} className="text-amber-600" />
                            Rework Required
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900 text-sm tabular-nums">
                          {formatCurrency(inv.total, inv.currencyCode || 'INR')}
                        </div>
                      </td>

                      {/* Zoho Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                              isVoid
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : isDraft
                                ? 'bg-slate-100 text-slate-600 border-slate-300'
                                : inv.zohoStatus.toLowerCase() === 'sent'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {inv.zohoStatus}
                          </span>
                          {isDraft && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              Not Actionable
                            </span>
                          )}
                        </div>
                      </td>

                      {/* E-Invoice */}
                      <td className="px-4 py-3">
                        {inv.eInvoice.generated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-medium text-[10px]">
                            <CheckCircle2 size={11} className="text-teal-600" />
                            Generated
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">
                            Not Generated
                          </span>
                        )}
                      </td>

                      {/* Workflows (Receiving / Checked / Inventory) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* Receiving */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              receivingDone
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : receivingAwaiting
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : receivingRework
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                            title={`Receiving: ${inv.workflowSummary.receivingStatus}`}
                          >
                            Rec: {receivingDone ? 'DONE' : receivingAwaiting ? 'VERIFY' : receivingRework ? 'REWORK' : 'PENDING'}
                          </span>

                          {/* Checked */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              checkedDone
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : checkedAwaiting
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : checkedRework
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                            title={`Checked: ${inv.workflowSummary.checkedStatus}`}
                          >
                            Chk: {checkedDone ? 'DONE' : checkedAwaiting ? 'VERIFY' : checkedRework ? 'REWORK' : 'PENDING'}
                          </span>

                          {/* Inventory Placeholder */}
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200"
                            title="Inventory Deduction (Phase 2 Coming Soon)"
                          >
                            Inv: TBD
                          </span>
                        </div>
                      </td>

                      {/* Timer */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {inv.timer.isStopped ? (
                          <FrozenPostDispatchTimer
                            baseTs={inv.timer.startedAt}
                            stoppedAt={inv.timer.stoppedAt}
                            elapsedSeconds={inv.timer.elapsedSeconds}
                          />
                        ) : (
                          <LivePostDispatchTimer baseTs={inv.timer.startedAt} />
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="px-3 py-1 text-xs font-bold text-white bg-[#1A2766] hover:bg-blue-900 rounded transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Desktop Pagination Footer */}
      {!unauthorizedMessage && (
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value;
                setPageSize(val === 'all' ? 'all' : Number(val));
                setCurrentPage(1);
              }}
              className="bg-gray-50 border border-gray-200 text-gray-700 rounded py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1A2766]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
            <span className="text-gray-400 ml-2">
              Total: <strong>{sortedInvoices.length}</strong> invoices
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-opacity"
                aria-label="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-opacity"
                aria-label="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Full Overlay Modals (Presentation-Neutral) */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          isOpen={!!selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          invoiceId={selectedInvoiceId}
          onPhotoClick={(url, title) => setPreviewPhoto({ isOpen: true, url, title })}
          onUpdated={() => {
            fetchInvoices();
            fetchQueueCounts();
          }}
        />
      )}

      {/* Fullscreen Photo Preview Modal */}
      <MobileImagePreview
        isOpen={previewPhoto.isOpen}
        onClose={() => setPreviewPhoto({ isOpen: false, url: null })}
        imageUrl={previewPhoto.url}
        title={previewPhoto.title || 'Evidence Preview'}
      />

      {/* Sync & API Usage Modal */}
      <SyncApiUsageModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSyncComplete={() => {
          fetchInvoices();
          fetchQueueCounts();
        }}
      />
    </div>
  );
}

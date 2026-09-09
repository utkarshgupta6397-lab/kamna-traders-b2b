'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  AlertCircle,
  Activity,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import InvoiceCard, { PostDispatchInvoiceSummary } from './InvoiceCard';
import InvoiceDetailModal from './InvoiceDetailModal';
import SyncApiUsageModal from './SyncApiUsageModal';
import MobileImagePreview from '@/components/mobile/MobileImagePreview';

export default function PostDispatchView({
  initialTab = 'all',
}: {
  initialTab?: 'all' | 'pending' | 'verification' | 'archived';
} = {}) {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'verification' | 'archived'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<PostDispatchInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Queue counts for Verification tab
  const [queueCounts, setQueueCounts] = useState<{ receiving: number; checked: number; total: number }>({
    receiving: 0,
    checked: 0,
    total: 0,
  });

  // Modal states
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // Fullscreen photo preview
  const [previewPhoto, setPreviewPhoto] = useState<{ isOpen: boolean; url: string | null; title?: string }>({
    isOpen: false,
    url: null,
  });

  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);

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
      console.error('[PostDispatch Fetch Error]', err);
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
      } else if (res.status === 403) {
        // Handled in fetchInvoices
      }
    } catch (err) {
      console.error('[Queue Counts Error]', err);
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
      toast.success('Invoices refreshed');
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-20">
      {/* Search & Sync Actions Bar */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center gap-2 sticky top-[104px] z-30 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice, customer, SO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100/80 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* Sync & Usage Button */}
        <button
          type="button"
          onClick={() => setSyncModalOpen(true)}
          className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1A2766] font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
          title="Zoho Sync & Usage"
        >
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span>Sync</span>
        </button>

        {/* Refresh List Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Invoice-Centric Primary Tabs */}
      <div className="px-4 pt-2.5 pb-2 bg-slate-50 border-b border-slate-200/60 sticky top-[156px] z-20">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'all'
                ? 'bg-white text-[#1A2766] shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            ALL
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'pending'
                ? 'bg-white text-[#1A2766] shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            PENDING
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            className={`py-1.5 rounded-lg transition-all text-center relative ${
              activeTab === 'verification'
                ? 'bg-white text-[#1A2766] shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            <span>VERIFY</span>
            {queueCounts.total > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px]">
                {queueCounts.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={`py-1.5 rounded-lg transition-all text-center ${
              activeTab === 'archived'
                ? 'bg-white text-[#1A2766] shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            ARCHIVED
          </button>
        </div>

        {/* Verification Sub-counter pills */}
        {activeTab === 'verification' && (
          <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-200/60 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Awaiting:
            </span>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold text-[11px]">
                Receiving: <strong>{queueCounts.receiving}</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold text-[11px]">
                Checked: <strong>{queueCounts.checked}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Invoice List Container */}
      <div className="p-4 space-y-3">
        {loading ? (
          // Skeleton loaders
          <div className="space-y-3">
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
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <div className="h-3 bg-slate-100 rounded w-20" />
                  <div className="h-3 bg-slate-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : unauthorizedMessage ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-amber-200 bg-amber-50/40 text-slate-700 space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
            <h3 className="font-bold text-base text-slate-900">Post-Dispatch Access Restricted</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {unauthorizedMessage}
            </p>
            <p className="text-[11px] text-slate-400">
              Please contact an administrator to enable Post-Dispatch workspace access for your account.
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-sm text-slate-700">No invoices found</p>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? 'Try searching with a different keyword.'
                : activeTab === 'verification'
                ? 'No invoices currently awaiting verification.'
                : activeTab === 'pending'
                ? 'All actionable invoices have completed their workflows.'
                : activeTab === 'archived'
                ? 'No archived or void invoices recorded.'
                : 'Click "Sync" to discover invoices from Zoho Books.'}
            </p>
          </div>
        ) : (
          invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              onOpen={(i) => setSelectedInvoiceId(i.id)}
            />
          ))
        )}
      </div>

      {/* Detail Modal */}
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

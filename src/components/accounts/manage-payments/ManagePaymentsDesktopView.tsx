'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Search,
  Plus,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  X,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Building2,
  ArrowUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatIndianCurrency } from '@/lib/formatters';
import PaymentStatusBadge from '@/components/mobile/manage-payments/PaymentStatusBadge';
import RecordPaymentModal from './RecordPaymentModal';
import PaymentDetailsModal from './PaymentDetailsModal';
import ApproveConfirmModal from './ApproveConfirmModal';
import DeclineModal from './DeclineModal';

interface SummaryData {
  todayDate: string;
  totalToday: number;
  approvedCountToday: number;
  approvedTodayCount: number;
  rejectedCountToday: number;
  pendingCount: number;
  pendingAmount: number;
  canViewAll: boolean;
}

interface PaymentRow {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  amount: number | string;
  paymentDate: string;
  paymentMode: string;
  photoUrl?: string | null;
  status: string;
  submittedAt: string;
  createdAt: string;
  createdById: string;
  createdBy?: { id: string; name: string };
  approvedById?: string | null;
  approvedAt?: string | null;
  approvedBy?: { id: string; name: string } | null;
  rejectedById?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: { id: string; name: string } | null;
  rejectionReason?: string | null;
  zohoPaymentId?: string | null;
  zohoSyncStatus?: string;
  zohoSyncedAt?: string | null;
  zohoSyncError?: string | null;
  customer?: { id: string; name: string; gstNumber?: string | null };
}

interface ManagePaymentsDesktopViewProps {
  userId: string;
  userName: string;
  canViewOwn: boolean;
  canViewAll: boolean;
  canCreate: boolean;
  canApprove: boolean;
  canReject: boolean;
}

type TabType = 'all' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
type LookbackType = 'today' | 'yesterday' | '3days' | '7days' | '15days' | 'custom';

export default function ManagePaymentsDesktopView({
  userId,
  userName,
  canViewOwn,
  canViewAll,
  canCreate,
  canApprove,
  canReject,
}: ManagePaymentsDesktopViewProps) {
  // Scope: 'all' or 'my'
  const [activeScope, setActiveScope] = useState<'all' | 'my'>(canViewAll ? 'all' : 'my');

  // Status Tab
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Date Lookback
  const [lookback, setLookback] = useState<LookbackType>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Data & Loading States
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [detailsPaymentId, setDetailsPaymentId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<PaymentRow | null>(null);
  const [declineTarget, setDeclineTarget] = useState<PaymentRow | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/manage-payments/summary');
      const data = await res.json();
      if (res.ok && data.success) {
        setSummary(data);
      }
    } catch (err) {
      console.error('[Fetch Summary Error]', err);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  // Fetch payment list
  const fetchPayments = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsListLoading(true);

      try {
        const params = new URLSearchParams({
          view: activeScope,
          status: activeTab === 'all' ? 'all' : activeTab,
          page: String(page),
          limit: String(limit),
        });

        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        }

        if (paymentModeFilter !== 'all') {
          params.append('paymentMode', paymentModeFilter);
        }

        if (lookback === 'custom') {
          if (customStartDate && customEndDate) {
            params.append('dateRange', 'custom');
            params.append('startDate', customStartDate);
            params.append('endDate', customEndDate);
          }
        } else {
          params.append('dateRange', lookback);
        }

        const res = await fetch(`/api/mobile/manage-payments?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setPayments(data.payments || []);
          setTotalRecords(data.total || 0);
          setTotalPages(data.totalPages || 1);
        } else {
          toast.error(data.error || 'Failed to fetch payments');
        }
      } catch (err) {
        console.error('[Fetch Payments Error]', err);
        toast.error('Network error loading payments');
      } finally {
        setIsListLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeScope, activeTab, page, limit, debouncedSearch, paymentModeFilter, lookback, customStartDate, customEndDate]
  );

  // Initial load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // List fetch on dependencies change
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchSummary();
    fetchPayments(true);
  };

  // Filter tabs config
  const statusTabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    {
      id: 'PENDING_APPROVAL',
      label: 'Pending',
      count: summary?.pendingCount,
    },
    {
      id: 'APPROVED',
      label: 'Approved',
    },
    {
      id: 'REJECTED',
      label: 'Rejected',
    },
  ];

  const lookbackButtons: { id: LookbackType; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '3days', label: '3D' },
    { id: '7days', label: '7D' },
    { id: '15days', label: '15D' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6">
      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-slate-900" style={{ letterSpacing: '-0.01em' }}>
            Manage Payments
          </h1>
          <p className="text-xs mt-1 text-slate-500">
            Manage payment requests, approvals and collections.
            {summary && (
              <>
                {' • Business Date: '}
                <span className="font-semibold text-slate-700">{summary.todayDate}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Scope Toggle (if user has canViewAll) */}
          {canViewAll && (
            <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setActiveScope('all');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeScope === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Payments
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveScope('my');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${
                  activeScope === 'my'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                My Payments
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
            title="Refresh payment requests and KPI cards"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Record Payment Button */}
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#1A2766] hover:bg-[#152055] rounded-xl shadow-xs transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── KPI CARDS ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1: Total Collections Today */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Collections Today
          </p>
          {isSummaryLoading ? (
            <div className="h-8 bg-slate-100 rounded-md w-2/3 mt-2 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-emerald-600 mt-1 tracking-tight">
              {formatIndianCurrency(summary?.totalToday || 0)}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Approved payments today</p>
        </div>

        {/* Card 2: Pending Approval */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Pending Approval
          </p>
          {isSummaryLoading ? (
            <div className="h-8 bg-slate-100 rounded-md w-1/3 mt-2 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-amber-600 mt-1 tracking-tight">
              {summary?.pendingCount || 0}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Awaiting approval</p>
        </div>

        {/* Card 3: Approved Today */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Approved Today
          </p>
          {isSummaryLoading ? (
            <div className="h-8 bg-slate-100 rounded-md w-1/3 mt-2 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-slate-900 mt-1 tracking-tight">
              {summary?.approvedTodayCount || 0}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Payments approved today</p>
        </div>

        {/* Card 4: Rejected Today */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Rejected Today
          </p>
          {isSummaryLoading ? (
            <div className="h-8 bg-slate-100 rounded-md w-1/3 mt-2 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-red-600 mt-1 tracking-tight">
              {summary?.rejectedCountToday || 0}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Declined requests</p>
        </div>
      </div>

      {/* ─── PAYMENT REQUESTS SECTION & TABLE ───────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-2xs">
        {/* Toolbar Header */}
        <div className="p-4 border-b border-slate-100 space-y-3.5 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Payment Requests
            </h2>

            {/* Date Lookback Buttons */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
              {lookbackButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    setLookback(btn.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    lookback === btn.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Pickers (if lookback === 'custom') */}
          {lookback === 'custom' && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">Date Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Filters & Search Row */}
          <div className="flex items-center justify-between gap-4 pt-1">
            {/* Status Tabs */}
            <div className="flex items-center gap-1">
              {statusTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPage(1);
                    }}
                    className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      isActive
                        ? 'text-slate-900 bg-slate-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums bg-amber-100 text-amber-800">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search & Mode Dropdown */}
            <div className="flex items-center gap-2.5">
              {/* Payment Mode Selector */}
              <select
                value={paymentModeFilter}
                onChange={(e) => {
                  setPaymentModeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:bg-white"
              >
                <option value="all">All Modes</option>
                <option value="POS">POS Device</option>
              </select>

              {/* Search Bar */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search payment request, customer, customer ID or submitted by..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#1A2766] focus:ring-1 focus:ring-[#1A2766] transition-all w-80 placeholder:text-slate-400 text-slate-800"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Payment Request</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Payment Mode</th>
                <th className="py-3 px-4">Submitted By</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isListLoading ? (
                /* Skeleton rows */
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-4" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-28" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-20" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-36" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-3 bg-slate-200 rounded w-16 ml-auto" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-20" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-slate-200 rounded w-16" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-3 bg-slate-200 rounded w-12 ml-auto" /></td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                /* Empty states */
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="text-sm font-bold text-slate-800">
                        {activeTab === 'PENDING_APPROVAL'
                          ? 'No pending payments'
                          : activeTab === 'APPROVED'
                          ? 'No approved payments'
                          : activeTab === 'REJECTED'
                          ? 'No rejected payments'
                          : 'No payment requests found'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activeTab === 'PENDING_APPROVAL'
                          ? 'There are no payment requests awaiting approval.'
                          : activeTab === 'APPROVED'
                          ? 'Approved payment requests will appear here.'
                          : activeTab === 'REJECTED'
                          ? 'Declined payment requests will appear here.'
                          : 'Payment requests matching the selected filters will appear here.'}
                      </p>
                      {canCreate && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setIsRecordModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1A2766] hover:bg-[#152055] rounded-xl shadow-xs transition-colors"
                          >
                            <Plus size={13} strokeWidth={2.5} />
                            Record Payment
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                /* Data rows */
                payments.map((p, idx) => {
                  const rowNumber = (page - 1) * limit + idx + 1;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setDetailsPaymentId(p.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* # */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {rowNumber}
                      </td>

                      {/* Payment Request */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {p.requestNumber}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {p.paymentDate?.slice(0, 10)}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 truncate max-w-[200px]" title={p.customerName}>
                          {p.customerName}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          ID: {p.customerId}
                          {p.customer?.gstNumber ? ` • ${p.customer.gstNumber}` : ''}
                        </p>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {formatIndianCurrency(Number(p.amount))}
                      </td>

                      {/* Mode */}
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {p.paymentMode === 'POS' ? 'POS Device' : p.paymentMode}
                      </td>

                      {/* Submitted By */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {p.createdBy?.name || 'Staff User'}
                      </td>

                      {/* Submitted At */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(p.submittedAt || p.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <PaymentStatusBadge status={p.status} size="sm" />
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setDetailsPaymentId(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-colors font-semibold text-[11px] shadow-2xs"
                          title="View Payment Details"
                        >
                          <Eye size={12} className="text-slate-400" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>
              Showing {payments.length} of {totalRecords} records
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="font-semibold text-slate-700">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODALS ────────────────────────────────────────────────────────── */}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={() => {
          fetchSummary();
          fetchPayments();
        }}
      />

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        isOpen={Boolean(detailsPaymentId)}
        onClose={() => setDetailsPaymentId(null)}
        paymentId={detailsPaymentId}
        canApprove={canApprove}
        canReject={canReject}
        onApproveClick={(p) => {
          setDetailsPaymentId(null);
          setApproveTarget(p);
        }}
        onDeclineClick={(p) => {
          setDetailsPaymentId(null);
          setDeclineTarget(p);
        }}
        onRefreshList={() => {
          fetchSummary();
          fetchPayments();
        }}
      />

      {/* Approve Confirm Dialog */}
      <ApproveConfirmModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        payment={approveTarget}
        onApproved={() => {
          fetchSummary();
          fetchPayments();
        }}
      />

      {/* Decline Dialog */}
      <DeclineModal
        isOpen={Boolean(declineTarget)}
        onClose={() => setDeclineTarget(null)}
        payment={declineTarget}
        onDeclined={() => {
          fetchSummary();
          fetchPayments();
        }}
      />
    </div>
  );
}

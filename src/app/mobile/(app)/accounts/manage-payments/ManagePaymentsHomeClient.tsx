'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Filter,
} from 'lucide-react';
import PaymentCard, { PaymentItem } from '@/components/mobile/manage-payments/PaymentCard';
import { formatIndianCurrency } from '@/lib/formatters';
import { format, isToday, isYesterday } from 'date-fns';

interface ManagePaymentsHomeClientProps {
  userId: string;
  userName: string;
  canViewAll: boolean;
  canCreate: boolean;
}

interface SummaryData {
  totalToday: number;
  approvedCountToday: number;
  pendingCount: number;
  pendingAmount: number;
  canViewAll: boolean;
}

export default function ManagePaymentsHomeClient({
  userId,
  userName,
  canViewAll,
  canCreate,
}: ManagePaymentsHomeClientProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('all');

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FAB Expand/Collapse State
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const fabTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollYRef = useRef<number>(0);

  const triggerFabExpand = useCallback((durationMs = 3500) => {
    if (fabTimeoutRef.current) clearTimeout(fabTimeoutRef.current);
    setIsFabExpanded(true);
    fabTimeoutRef.current = setTimeout(() => {
      setIsFabExpanded(false);
    }, durationMs);
  }, []);

  // Initial subtle expansion after short idle period (1.5s), then collapse
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      triggerFabExpand(3500);
    }, 1500);

    return () => {
      clearTimeout(initialTimer);
      if (fabTimeoutRef.current) clearTimeout(fabTimeoutRef.current);
    };
  }, [triggerFabExpand]);

  // Expand when scrolling upward to indicate user looking for actions
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      if (lastScrollYRef.current - currentScrollY > 10 && currentScrollY > 40) {
        triggerFabExpand(3000);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [triggerFabExpand]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/manage-payments/summary');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data);
        }
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, []);

  // Fetch payment list
  const fetchPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        view: activeTab,
        status: statusFilter,
        page: '1',
        limit: '100',
      });

      const res = await fetch(`/api/mobile/manage-payments?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch payment list');
      }

      setPayments(data.payments || []);
    } catch (err: any) {
      console.error('Failed to fetch payments:', err);
      setError(err.message || 'Unable to load payment records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, statusFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, activeTab]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleRefresh = () => {
    fetchSummary();
    fetchPayments(true);
  };

  // Group payments by date: Today, Yesterday, Older
  const groupedPayments = useMemo(() => {
    const groups: { [key: string]: PaymentItem[] } = {};

    payments.forEach((payment) => {
      let groupKey = 'Older';
      try {
        const d = new Date(payment.paymentDate || payment.createdAt);
        if (isToday(d)) {
          groupKey = 'Today';
        } else if (isYesterday(d)) {
          groupKey = 'Yesterday';
        } else {
          groupKey = format(d, 'dd MMMM yyyy');
        }
      } catch (e) {
        groupKey = 'Older';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(payment);
    });

    return groups;
  }, [payments]);

  const groupKeys = useMemo(() => {
    const keys = Object.keys(groupedPayments);
    // Sort so Today is first, Yesterday is second, then chronological desc
    return keys.sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      return 0;
    });
  }, [groupedPayments]);

  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB] relative">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-2 min-h-[56px] py-1">
          <Link
            href="/mobile/accounts"
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Accounts</span>
          </Link>

          <span className="font-bold text-[16px] tracking-tight">Manage Payments</span>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh payments"
            className="p-2.5 rounded-full active:bg-white/10 transition-colors text-white/90 disabled:opacity-50"
          >
            <RefreshCw size={19} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full flex flex-col gap-4 pb-28">
        {/* Top Summary Card */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] relative overflow-hidden">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Collections Today
              </span>
              <div className="text-[28px] font-black text-[#1A2766] tracking-tight">
                {formatIndianCurrency(summary?.totalToday ?? 0, false)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/60">
              <CheckCircle2 size={20} strokeWidth={2.5} />
            </div>
          </div>

          <div className="text-[12px] text-slate-500 font-medium flex items-center gap-1">
            <span>
              {summary?.approvedCountToday ?? 0} {summary?.approvedCountToday === 1 ? 'payment' : 'payments'} approved today
            </span>
            {activeTab === 'all' && canViewAll && (
              <span className="text-slate-400 font-normal">· Company Total</span>
            )}
          </div>

          {/* Pending Approval Requests Indicator */}
          {(summary?.pendingCount ?? 0) > 0 && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[12px] bg-amber-50/60 -mx-2 -mb-2 px-3 py-2 rounded-xl">
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Pending Approval</span>
              </div>
              <div className="font-bold text-amber-900">
                {summary?.pendingCount} {summary?.pendingCount === 1 ? 'request' : 'requests'}
                {summary?.pendingAmount ? ` (${formatIndianCurrency(summary.pendingAmount, false)})` : ''}
              </div>
            </div>
          )}
        </div>

        {/* View Tabs (My Payments vs All Payments) */}
        {canViewAll && (
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('my')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all text-center ${
                activeTab === 'my'
                  ? 'bg-white text-[#1A2766] shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Payments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all text-center ${
                activeTab === 'all'
                  ? 'bg-white text-[#1A2766] shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Payments
            </button>
          </div>
        )}

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'PENDING_APPROVAL', label: 'Pending' },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map((item) => {
            const isSelected = statusFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key as any)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-[#1A2766] text-white border-[#1A2766] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Payment List Content */}
        {loading && !refreshing ? (
          <div className="flex flex-col gap-3 py-1 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col gap-2.5"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 w-36 bg-slate-200 rounded" />
                  <div className="h-5 w-24 bg-slate-100 rounded-full" />
                </div>
                <div className="h-3 w-20 bg-slate-100 rounded" />
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <div className="h-6 w-24 bg-slate-200 rounded" />
                  <div className="h-4 w-28 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-700">
            <AlertCircle size={28} className="mx-auto mb-2 text-red-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => fetchPayments()}
              className="mt-3 text-xs font-bold text-red-800 bg-red-100/80 px-4 py-2 rounded-lg active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-center my-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Inbox size={26} strokeWidth={1.75} />
            </div>
            <h4 className="font-bold text-slate-800 text-[15px] mb-1">
              {statusFilter !== 'all'
                ? `No ${statusFilter.replace('_', ' ').toLowerCase()} payments`
                : activeTab === 'my'
                ? 'No payments recorded yet'
                : 'No company payments found'}
            </h4>
            <p className="text-xs text-slate-500 max-w-[260px] mx-auto leading-relaxed">
              {activeTab === 'my' && canCreate
                ? 'Tap the Record Payment button below to submit a new customer POS payment request.'
                : 'No payment requests match the current selection.'}
            </p>

            {canCreate && activeTab === 'my' && (
              <Link
                href="/mobile/accounts/manage-payments/record"
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1A2766] text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Record Payment</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groupKeys.map((groupTitle) => (
              <div key={groupTitle} className="flex flex-col gap-2.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  {groupTitle}
                </div>
                <div className="flex flex-col gap-2.5">
                  {groupedPayments[groupTitle]?.map((payment) => (
                    <PaymentCard
                      key={payment.id}
                      payment={payment}
                      showCreator={activeTab === 'all'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) - Compact Circular with subtle pill expansion */}
      {canCreate && (
        <div
          className="fixed right-4 z-40"
          style={{
            bottom: 'calc(76px + env(safe-area-inset-bottom, 16px))',
          }}
        >
          <Link
            href="/mobile/accounts/manage-payments/record"
            className={`flex items-center justify-center bg-[#1A2766] text-white shadow-[0_4px_18px_rgba(26,39,102,0.38)] active:scale-95 transition-all duration-300 ease-out font-bold text-sm tracking-tight rounded-full h-14 ${
              isFabExpanded ? 'px-4 gap-2' : 'w-14 px-0'
            }`}
            aria-label="Record Payment"
          >
            <Plus size={24} strokeWidth={2.5} className="shrink-0" />
            <span
              className={`whitespace-nowrap transition-all duration-300 ease-out overflow-hidden ${
                isFabExpanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'
              }`}
            >
              Record Payment
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

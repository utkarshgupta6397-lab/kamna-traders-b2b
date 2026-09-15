'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  X,
  Check,
  Ban,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  canApprove: boolean;
  currentUserId: string;
  currentUserName: string;
}

interface AllocationEntry {
  skuId: string;
  skuName: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
  uom: string;
  unitPrice?: number;
  lineValue?: number;
}

interface RejectionCycle {
  cycle: number;
  rejectedById: string;
  rejectedByName: string;
  rejectedAt: string;
  rejectionRemarks: string;
  previousState?: string;
  newState?: string;
  submittedSnapshot?: any;
}

interface AllocationItem {
  id: string;
  invoiceId: string;
  invoiceLineId: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  zohoStatus: string | null;
  erpSubStatus: string | null;
  isVoid: boolean;
  expectedSkuId: string | null;
  expectedItemName: string | null;
  expectedWarehouseId: string | null;
  expectedQty: number;
  expectedUom: string;
  sourceUnitPrice?: number;
  sourceAmount?: number;
  allocationData: AllocationEntry[] | null;
  isExploded: boolean;
  status: 'SUBMITTED_FOR_APPROVAL' | 'APPROVED' | 'REJECTED' | 'REWORK_REQUIRED' | 'DEDUCTED' | string;
  classification: string;
  deviationReasons: string[] | null;
  submittedById: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  submittedSnapshot: any;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectionRemarks: string | null;
  rejectionHistory: RejectionCycle[] | null;
  deductedAt: string | null;
  deductedById: string | null;
  deductedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Warehouse {
  id: string;
  name: string;
}

export default function StockApprovalClient({ canApprove, currentUserId, currentUserName }: Props) {
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
    deductedToday: 0,
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED_FOR_APPROVAL' | 'APPROVED' | 'REWORK_REQUIRED' | 'DEDUCTED'>('SUBMITTED_FOR_APPROVAL');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  // Selected for modal review popup
  const [selectedAllocation, setSelectedAllocation] = useState<AllocationItem | null>(null);

  // Rejection input state inside review modal
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);

      const res = await fetch(`/api/staff/operations/stock-approval?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch approval queue');
      const data = await res.json();
      setAllocations(data.allocations || []);
      setStats(data.stats || { pending: 0, approvedToday: 0, rejectedToday: 0, deductedToday: 0 });
      setWarehouses(data.warehouses || []);

      // If an allocation was open in modal, refresh its data
      if (selectedAllocation) {
        const fresh = (data.allocations || []).find((a: AllocationItem) => a.id === selectedAllocation.id);
        if (fresh) setSelectedAllocation(fresh);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading stock approvals');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, searchQuery, warehouseFilter, selectedAllocation]);

  useEffect(() => {
    fetchQueue();
  }, [statusFilter, warehouseFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQueue();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchQueue();
  };

  const handleOpenReview = (alloc: AllocationItem) => {
    setSelectedAllocation(alloc);
    setShowRejectInput(false);
    setRejectionReason('');
  };

  const handleCloseReview = () => {
    setSelectedAllocation(null);
    setShowRejectInput(false);
    setRejectionReason('');
  };

  const handleApprove = async () => {
    if (!selectedAllocation) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/staff/operations/stock-approval/${selectedAllocation.id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      toast.success('Stock deduction request approved successfully');
      handleCloseReview();
      await fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAllocation) return;
    const trimmed = rejectionReason.trim();
    if (trimmed.length < 5) {
      toast.error('Rejection reason must be at least 5 characters');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/staff/operations/stock-approval/${selectedAllocation.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rejection failed');
      toast.success('Stock deduction returned for rework (REWORK_REQUIRED)');
      handleCloseReview();
      await fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getDeviationLabel = (code: string) => {
    switch (code) {
      case 'ITEM_EXPLODED':
        return 'Item Exploded / Component Decomposition';
      case 'WAREHOUSE_DEVIATION':
        return 'Warehouse Location Deviation';
      case 'SKU_DEVIATION':
        return 'SKU Catalog Substitution';
      case 'MULTI_WAREHOUSE_ALLOCATION':
        return 'Multi-Warehouse Split Allocation';
      case 'QUANTITY_EXCEEDS_EXPECTED':
        return 'Allocated Qty Exceeds Invoice Line';
      case 'INSUFFICIENT_STOCK':
        return 'Insufficient Warehouse Stock';
      default:
        return code.replace(/_/g, ' ');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED_FOR_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Pending Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Approved
          </span>
        );
      case 'REWORK_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle size={12} className="text-rose-600" />
            Rework Required
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={12} className="text-rose-600" />
            Rejected
          </span>
        );
      case 'DEDUCTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Check size={12} className="text-purple-600" />
            Deducted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Helper for computing total allocated value for selected allocation
  const allocatedEntries = selectedAllocation?.allocationData || [];
  const totalAllocatedValue = allocatedEntries.reduce((sum, e) => {
    const val = typeof e.lineValue === 'number' ? e.lineValue : (e.qty || 0) * (e.unitPrice || 0);
    return sum + val;
  }, 0);

  const deviations = selectedAllocation?.deviationReasons || [];

  return (
    <div className="max-w-screen-2xl mx-auto space-y-5 pb-12 px-4 mt-2">
      {/* ── Top Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-[#1A2766]" size={24} />
            Stock Approval
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Review and process Post-Dispatch inventory deduction requests and warehouse deviations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#1A2766]' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Summary Metric Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div
          onClick={() => setStatusFilter('SUBMITTED_FOR_APPROVAL')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            statusFilter === 'SUBMITTED_FOR_APPROVAL'
              ? 'bg-orange-50/70 border-orange-300 shadow-xs ring-1 ring-orange-400'
              : 'bg-white border-gray-200 hover:border-orange-200 hover:bg-orange-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Pending Approval</span>
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{stats.pending}</span>
            <span className="text-[11px] text-orange-700 font-medium">requires action</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50/70 border-emerald-300 shadow-xs ring-1 ring-emerald-400'
              : 'bg-white border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Approved Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{stats.approvedToday}</span>
            <span className="text-[11px] text-emerald-700 font-medium">cleared</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('REWORK_REQUIRED')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            statusFilter === 'REWORK_REQUIRED'
              ? 'bg-rose-50/70 border-rose-300 shadow-xs ring-1 ring-rose-400'
              : 'bg-white border-gray-200 hover:border-rose-200 hover:bg-rose-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Rework / Rejected</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
              <XCircle size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{stats.rejectedToday}</span>
            <span className="text-[11px] text-rose-700 font-medium">sent back</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('DEDUCTED')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            statusFilter === 'DEDUCTED'
              ? 'bg-purple-50/70 border-purple-300 shadow-xs ring-1 ring-purple-400'
              : 'bg-white border-gray-200 hover:border-purple-200 hover:bg-purple-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Deducted Today</span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <Check size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{stats.deductedToday}</span>
            <span className="text-[11px] text-purple-700 font-medium">decremented</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoice number, customer, SKU, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Tabs */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
              {(['ALL', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'REWORK_REQUIRED', 'DEDUCTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-[#1A2766] shadow-2xs font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {st === 'ALL'
                    ? 'All'
                    : st === 'SUBMITTED_FOR_APPROVAL'
                    ? 'Pending'
                    : st === 'APPROVED'
                    ? 'Approved'
                    : st === 'REWORK_REQUIRED'
                    ? 'Rework'
                    : 'Deducted'}
                </button>
              ))}
            </div>

            {/* Warehouse Filter */}
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1A2766]"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Table Queue View (Full Width) ───────────────────────────────────────── */}
      <div className="w-full">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <th className="py-2.5 px-3">Invoice</th>
                  <th className="py-2.5 px-3">Item / Catalog SKU</th>
                  <th className="py-2.5 px-3 text-right">Req. Qty</th>
                  <th className="py-2.5 px-3">Allocation Warehouse</th>
                  <th className="py-2.5 px-3">Deviations</th>
                  <th className="py-2.5 px-3">Submitted By</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#1A2766]" />
                      <span className="text-xs font-medium">Loading approval queue…</span>
                    </td>
                  </tr>
                ) : allocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-gray-400">
                      <ShieldCheck size={40} strokeWidth={1.2} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm font-bold text-gray-700">No requests match criteria</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        There are currently no stock deduction requests requiring review under the active filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  allocations.map((alloc) => {
                    const isRowSelected = selectedAllocation?.id === alloc.id;
                    const isRowSelf = alloc.submittedById === currentUserId;
                    const reasons = alloc.deviationReasons || [];
                    const entries = alloc.allocationData || [];

                    // Compute distinct warehouses correctly
                    const distinctWarehouses = Array.from(
                      new Set(entries.map((e) => e.warehouseName || e.warehouseId).filter(Boolean))
                    );

                    return (
                      <tr
                        key={alloc.id}
                        onClick={() => handleOpenReview(alloc)}
                        className={`cursor-pointer transition-colors ${
                          isRowSelected
                            ? 'bg-blue-50/60'
                            : 'hover:bg-gray-50/80 odd:bg-white even:bg-gray-50/20'
                        }`}
                      >
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-[#1A2766] flex items-center gap-1.5">
                            <span>{alloc.invoiceNumber}</span>
                            {alloc.isVoid && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-red-100 text-red-700 rounded font-bold">
                                VOID
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate max-w-[150px]" title={alloc.customerName}>
                            {alloc.customerName}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{alloc.invoiceDate}</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900 truncate max-w-[220px]" title={alloc.expectedItemName || ''}>
                            {alloc.expectedItemName}
                          </div>
                          <div className="text-[11px] font-mono text-gray-500 mt-0.5">
                            {alloc.expectedSkuId ? `SKU: ${alloc.expectedSkuId}` : 'Manual Mapping'}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-gray-800">
                          {alloc.expectedQty} {alloc.expectedUom}
                        </td>

                        <td className="py-3 px-3 text-xs">
                          {distinctWarehouses.length === 1 ? (
                            <div className="text-gray-800 font-medium truncate max-w-[160px]" title={distinctWarehouses[0]}>
                              {distinctWarehouses[0]}
                            </div>
                          ) : distinctWarehouses.length > 1 ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold border border-blue-200"
                              title={distinctWarehouses.join(', ')}
                            >
                              <Building2 size={11} />
                              {distinctWarehouses.length} Warehouses
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {reasons.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {reasons.slice(0, 2).map((r, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-medium"
                                  title={getDeviationLabel(r)}
                                >
                                  {r.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {reasons.length > 2 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold">
                                  +{reasons.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">None</span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-xs">
                          <div className="font-semibold text-gray-700 flex items-center gap-1">
                            <span>{alloc.submittedByName || 'Staff'}</span>
                            {isRowSelf && (
                              <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded font-bold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {alloc.submittedAt ? new Date(alloc.submittedAt).toLocaleDateString('en-IN') : '-'}
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">{getStatusBadge(alloc.status)}</td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReview(alloc);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1A2766] bg-slate-100 hover:bg-[#1A2766] hover:text-white rounded-md transition-all cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Complete Request Review Modal / Dialog Popup ─────────────────────────── */}
      {selectedAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl my-auto max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-[#1A2766] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-blue-200">REQUEST REVIEW</span>
                  {selectedAllocation.isVoid && (
                    <span className="px-2 py-0.5 bg-rose-500 text-white rounded text-[10px] font-black uppercase tracking-wider">
                      VOID INVOICE
                    </span>
                  )}
                  {selectedAllocation.status === 'SUBMITTED_FOR_APPROVAL' ? (
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-200 border border-orange-400/40 rounded text-[10px] font-bold">
                      Pending Decision
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-white/15 text-white rounded text-[10px] font-bold">
                      {selectedAllocation.status}
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold mt-1 flex flex-wrap items-center gap-2">
                  <span>Invoice: {selectedAllocation.invoiceNumber}</span>
                  <span className="text-xs font-normal text-blue-200">Customer: {selectedAllocation.customerName}</span>
                </h2>
              </div>

              <button
                onClick={handleCloseReview}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0 ml-2"
                title="Close review modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)] text-xs text-gray-700">
              {/* Void Warning if applicable */}
              {selectedAllocation.isVoid && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
                  <Ban size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-900">Invoice Void — Action Blocked</h4>
                    <p className="mt-0.5 text-[11px] leading-relaxed">
                      This invoice has been voided in Zoho Books. Approval, rejection, and inventory deductions are strictly blocked.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. SOURCE ITEM */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">SOURCE ITEM</span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{selectedAllocation.expectedItemName}</h3>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                      SKU: {selectedAllocation.expectedSkuId || 'Manual Catalog Mapping'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="font-mono text-sm font-bold text-[#1A2766]">
                      Qty: {selectedAllocation.expectedQty} {selectedAllocation.expectedUom}
                    </div>
                    {selectedAllocation.sourceUnitPrice ? (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Source Rate: ₹{selectedAllocation.sourceUnitPrice.toLocaleString('en-IN')}
                        {selectedAllocation.sourceAmount ? ` (Line: ₹${selectedAllocation.sourceAmount.toLocaleString('en-IN')})` : ''}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* 2. ALLOCATED ERP ITEMS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    ALLOCATED ERP ITEMS
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {allocatedEntries.length} {allocatedEntries.length === 1 ? 'component' : 'components'}
                  </span>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                        <th className="py-2.5 px-3">ERP Item</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Warehouse</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Line Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allocatedEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-gray-400 italic">
                            No ERP allocation lines recorded.
                          </td>
                        </tr>
                      ) : (
                        allocatedEntries.map((entry, idx) => {
                          const uPrice = entry.unitPrice != null && entry.unitPrice > 0 ? entry.unitPrice : null;
                          const lVal = entry.lineValue != null && entry.lineValue > 0 ? entry.lineValue : (uPrice ? entry.qty * uPrice : null);
                          return (
                            <tr key={idx} className="hover:bg-gray-50/60">
                              <td className="py-2.5 px-3 font-semibold text-gray-900">
                                {entry.skuName || entry.skuId}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                                {entry.skuId}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1 font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                                  <Building2 size={11} className="text-gray-500" />
                                  {entry.warehouseName || entry.warehouseId}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                                {entry.qty} {entry.uom || 'Unit'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                {uPrice != null ? `₹${uPrice.toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                                {lVal != null ? `₹${lVal.toLocaleString('en-IN')}` : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {totalAllocatedValue > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-bold border-t border-gray-200 text-gray-800">
                          <td colSpan={3} className="py-2 px-3 text-right text-[11px] uppercase tracking-wider text-gray-500">
                            Total ERP Allocated Value:
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                            {allocatedEntries.reduce((s, e) => s + e.qty, 0)} Units
                          </td>
                          <td></td>
                          <td className="py-2 px-3 text-right font-mono text-sm text-[#1A2766]">
                            ₹{totalAllocatedValue.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* 3. PRICE SUMMARY */}
              <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">SOURCE INVOICE RATE</span>
                  <span className="text-gray-600">
                    Line Total: <strong className="text-gray-900">{selectedAllocation.sourceAmount ? `₹${selectedAllocation.sourceAmount.toLocaleString('en-IN')}` : 'N/A'}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">LOCAL ERP CATALOG VALUE</span>
                  <span className="font-mono font-bold text-sm text-[#1A2766]">
                    {totalAllocatedValue > 0 ? `₹${totalAllocatedValue.toLocaleString('en-IN')}` : '—'}
                  </span>
                </div>
              </div>

              {/* 4. DEVIATION */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">DEVIATION</span>
                {deviations.length === 0 ? (
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Exact Match (No deviations)</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {deviations.map((code, idx) => (
                      <div key={idx} className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-lg text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-rose-900">{getDeviationLabel(code)}</span>
                          <p className="text-[11px] text-rose-700 mt-0.5">
                            {code === 'ITEM_EXPLODED' && 'The invoice item was decomposed into individual local catalog components with custom manual quantities.'}
                            {code === 'WAREHOUSE_DEVIATION' && 'Stock is allocated from a warehouse location different than the invoice location.'}
                            {code === 'SKU_DEVIATION' && 'A different product or SKU was substituted for the invoiced line.'}
                            {code === 'MULTI_WAREHOUSE_ALLOCATION' && 'Allocation is split across multiple physical warehouses.'}
                            {code === 'QUANTITY_EXCEEDS_EXPECTED' && 'Total allocated quantity is greater than original quantity requested.'}
                            {code === 'INSUFFICIENT_STOCK' && 'Target warehouse does not currently possess sufficient stock to fulfill this deduction.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. SUBMISSION */}
              <div className="bg-gray-50/60 p-3.5 rounded-xl border border-gray-200 text-xs space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">SUBMISSION</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600 text-[11px]">
                  <div>
                    Submitted By: <strong className="text-gray-900">{selectedAllocation.submittedByName || 'Staff'}</strong>
                  </div>
                  <div>
                    Submitted At:{' '}
                    <strong className="text-gray-900 font-mono">
                      {selectedAllocation.submittedAt ? new Date(selectedAllocation.submittedAt).toLocaleString('en-IN') : '-'}
                    </strong>
                  </div>
                  {selectedAllocation.approvedAt && (
                    <div className="text-emerald-800">
                      Approved By: <strong>{selectedAllocation.approvedByName}</strong> ({new Date(selectedAllocation.approvedAt).toLocaleDateString('en-IN')})
                    </div>
                  )}
                  {selectedAllocation.rejectedAt && (
                    <div className="text-rose-800">
                      Rejected By: <strong>{selectedAllocation.rejectedByName}</strong> ({new Date(selectedAllocation.rejectedAt).toLocaleDateString('en-IN')})
                    </div>
                  )}
                </div>

                {/* Prior Rejection Remarks */}
                {selectedAllocation.rejectionRemarks && (
                  <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs">
                    <span className="font-bold text-rose-900 block text-[10px] uppercase">Rejection Reason</span>
                    <p className="mt-0.5 text-rose-800">{selectedAllocation.rejectionRemarks}</p>
                  </div>
                )}

                {/* Prior Rejection Cycles */}
                {Array.isArray(selectedAllocation.rejectionHistory) && selectedAllocation.rejectionHistory.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
                      Prior Rejection Cycles ({selectedAllocation.rejectionHistory.length})
                    </span>
                    {selectedAllocation.rejectionHistory.map((h, i) => (
                      <div key={i} className="p-2 bg-white rounded border border-gray-200 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-gray-700">
                          <span>Cycle #{h.cycle} by {h.rejectedByName}</span>
                          <span className="font-mono text-[10px] text-gray-400">{new Date(h.rejectedAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        <p className="text-rose-700 italic">"{h.rejectionRemarks}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6. REJECTION COMMENT INPUT (Inline when Reject chosen) */}
              {showRejectInput && selectedAllocation.status === 'SUBMITTED_FOR_APPROVAL' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-rose-900 text-xs">
                      Rejection / Rework Comment <strong className="text-rose-600">*</strong>
                    </label>
                    <span className={`text-[10px] ${rejectionReason.trim().length < 5 ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>
                      {rejectionReason.trim().length} / min 5 chars
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Specify why this request is rejected and what the operator must correct (e.g., incorrect warehouse, modify quantities)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectInput(false);
                        setRejectionReason('');
                      }}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={actionLoading || rejectionReason.trim().length < 5}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {actionLoading ? <RefreshCw size={12} className="animate-spin" /> : <XCircle size={14} />}
                      <span>Confirm Rejection (Rework)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / Actions */}
            <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 shrink-0 flex items-center justify-end">
              {selectedAllocation.status === 'SUBMITTED_FOR_APPROVAL' ? (
                <>
                  {!showRejectInput && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowRejectInput(true)}
                        disabled={actionLoading || !canApprove || selectedAllocation.isVoid}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <XCircle size={15} />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={actionLoading || !canApprove || selectedAllocation.isVoid}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        <span>Approve</span>
                      </button>
                    </div>
                  )}
                </>
              ) : selectedAllocation.status === 'APPROVED' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>Approved — Pending physical stock deduction.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading || !canApprove || selectedAllocation.isVoid}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    <span>Complete Stock Deduction</span>
                  </button>
                </div>
              ) : selectedAllocation.status === 'REWORK_REQUIRED' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span>Request returned to operator for rework.</span>
                  </div>
                  <Link
                    href={`/staff/dashboard/dispatch/post-dispatch/${selectedAllocation.invoiceId}/inventory-deduction`}
                    className="py-2 px-3 bg-[#1A2766] hover:bg-[#121c48] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>View in Deduction Workspace</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ) : selectedAllocation.status === 'DEDUCTED' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full text-xs text-purple-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold">Stock has been decremented atomically.</span>
                    {selectedAllocation.deductedAt && (
                      <span className="text-gray-500 font-normal">
                        ({new Date(selectedAllocation.deductedAt).toLocaleString('en-IN')})
                      </span>
                    )}
                  </div>
                  <Link
                    href="/staff/dashboard/operations/inventory-history"
                    className="underline font-bold text-purple-900 hover:text-purple-950"
                  >
                    View in Inventory History →
                  </Link>
                </div>
              ) : (
                <div className="w-full flex justify-end">
                  <button
                    type="button"
                    onClick={handleCloseReview}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

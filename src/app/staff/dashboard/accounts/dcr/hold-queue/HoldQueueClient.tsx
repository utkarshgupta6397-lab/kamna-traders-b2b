'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle, Loader2, Package, ArrowRightCircle, IndianRupee, FileText, X, ExternalLink, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useDcrStats } from '../layout';
import Link from 'next/link';
import MiniCustomerStatement from '@/components/zoho/MiniCustomerStatement';

interface SerialEntry {
  allocationId: string;
  serialNumber: string;
  status: string;
  vendorDcrStatus: string;
  isEligible: boolean;
  isReleased: boolean;
}

interface SkuGroup {
  itemId: string;
  itemName: string;
  sku: string | null;
  quantity: number;
  selectedForDCR: boolean;
  totalSerials: number;
  eligibleSerials: number;
  releasedSerials: number;
  serials: SerialEntry[];
}

// ─── Helpers matching CustomerStatementView ──────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function fmtBalance(n: number) {
  if (n === 0) return '₹0.00';
  const val = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n > 0 ? val : `-${val}`;
}

function getOpeningBalancePresentation(n: number) {
  if (n < 0) {
    return {
      label: 'Advance Balance',
      amount: fmt(n),
      isCredit: true,
    };
  }
  return {
    label: 'Opening Balance',
    amount: fmtBalance(n),
    isCredit: false,
  };
}

function cleanDescription(desc: string, type: string): string {
  if (!desc) return desc;
  if (type === 'payment') {
    return desc.replace(/^payment\s*[-–]\s*/i, '').trim();
  }
  if (type === 'invoice' || type === 'bill') {
    return desc.replace(/^(invoice|bill)\s+/i, '').trim();
  }
  return desc;
}

function parseRawDate(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, mStr, d] = match;
    const mNum = parseInt(mStr, 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { y, m: months[mNum - 1], d };
  }
  return null;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const raw = parseRawDate(iso);
  if (raw) return `${raw.d} ${raw.m} ${raw.y}`;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const getItemStatus = (group: SkuGroup, invoiceDcrStatus: string) => {
  if (!group.selectedForDCR) {
    return { label: 'Non-DCR Item', color: 'bg-gray-100 text-gray-500 border-gray-200' };
  }
  if (invoiceDcrStatus === 'NO_DCR_REQUIRED' || invoiceDcrStatus === 'SKIPPED') {
    return { label: 'Skipped', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  if (group.totalSerials < group.quantity) {
    return { label: 'Pending Serial Entry', color: 'bg-rose-100 text-rose-700 border-rose-200' };
  }
  const hasPendingDcr = group.serials.some(s => s.vendorDcrStatus !== 'RECEIVED');
  const hasEligible = group.serials.some(s => s.isEligible && !s.isReleased);
  const hasReleased = group.serials.some(s => s.isReleased);

  if (hasPendingDcr) {
    return { label: 'Purchase DCR Pending', color: 'bg-orange-100 text-orange-700 border-orange-200' };
  }
  if (hasEligible) {
    return { label: 'Ready For Release', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  if (hasReleased) {
    return { label: 'Released', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  return { label: 'Hold', color: 'bg-gray-100 text-gray-700 border-gray-200' };
};

interface HoldInvoice {
  id: string;
  invoiceNumber: string;
  zohoInvoiceId?: string;
  customerName: string;
  customerId: string;
  customer_gst_no?: string | null;
  invoiceDate: string;
  invoiceTotal: number;
  dcrStatus: string;
  outstandingBalance: number;
  totalSerials: number;
  totalEligible: number;
  totalReleased: number;
  releasePercentage: number;
  skuGroups: SkuGroup[];
}

interface Kpis {
  invoicesOnHold: number;
  serialsOnHold: number;
  readyToIssue: number;
  outstandingValueOnHold: number;
}

const ZOHO_ORG_ID = process.env.NEXT_PUBLIC_ZOHO_ORG_ID;

// Module-level in-memory cache for customer statements and outstanding balances
const customerBalanceCache: Record<string, { statement: any; fetchedAt: number }> = {};
const CACHE_TTL = 300000; // 5 minutes in milliseconds

export default function HoldQueueClient() {
  const { refreshStats } = useDcrStats();
  const [invoices, setInvoices] = useState<HoldInvoice[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ invoicesOnHold: 0, serialsOnHold: 0, readyToIssue: 0, outstandingValueOnHold: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Live outstanding balances state (indexed by customerId)
  const [liveBalances, setLiveBalances] = useState<Record<string, { balance: number; loading: boolean; error: boolean }>>({});

  // Track in-flight customer statement promises to deduplicate requests
  const inFlightRequests = useRef<Record<string, Promise<any> | undefined>>({});
  
  // Modal states
  const [reviewInvoice, setReviewInvoice] = useState<HoldInvoice | null>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [isReleasing, setIsReleasing] = useState(false);

  // Render counting log for debugging
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  console.log(`[HoldQueueClient] Render count: ${renderCountRef.current}, reviewInvoice open: ${!!reviewInvoice}`);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReviewInvoice(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchData = useCallback(async () => {
    console.log(`[HoldQueueClient] Fetching hold queue invoices... search: "${debouncedSearch}"`);
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/dcr/hold-queue?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setInvoices(data.invoices || []);
      setKpis(data.kpis || {});
      
      // Update reviewInvoice reference using a functional state update to break the loop
      setReviewInvoice(prev => {
        if (!prev) return null;
        const updated = data.invoices?.find((i: HoldInvoice) => i.id === prev.id);
        return updated || null;
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load hold queue');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchLiveBalance = useCallback(async (customerId: string) => {
    // Check cache first
    const cached = customerBalanceCache[customerId];
    const now = Date.now();
    if (cached && (now - cached.fetchedAt < CACHE_TTL)) {
      setLiveBalances(prev => ({
        ...prev,
        [customerId]: { balance: cached.statement.closingBalance, loading: false, error: false }
      }));
      return cached.statement;
    }

    // Check if there's already an in-flight request for this customerId
    if (inFlightRequests.current[customerId]) {
      try {
        const statement = await inFlightRequests.current[customerId];
        setLiveBalances(prev => ({
          ...prev,
          [customerId]: { balance: statement.closingBalance, loading: false, error: false }
        }));
        return statement;
      } catch (err) {
        setLiveBalances(prev => ({
          ...prev,
          [customerId]: { balance: 0, loading: false, error: true }
        }));
        return null;
      }
    }

    // Start a new fetch
    const fetchPromise = (async () => {
      const res = await fetch(`/api/admin/customer-statement/statement?customerId=${customerId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch statement');
      }
      return data.data; // contains closingBalance, transactions, etc.
    })();

    inFlightRequests.current[customerId] = fetchPromise;

    try {
      const statement = await fetchPromise;
      customerBalanceCache[customerId] = {
        statement,
        fetchedAt: Date.now()
      };
      setLiveBalances(prev => ({
        ...prev,
        [customerId]: { balance: statement.closingBalance, loading: false, error: false }
      }));
      return statement;
    } catch (err) {
      console.error(`Error fetching balance for ${customerId}:`, err);
      setLiveBalances(prev => ({
        ...prev,
        [customerId]: { balance: 0, loading: false, error: true }
      }));
      return null;
    } finally {
      delete inFlightRequests.current[customerId];
    }
  }, []);

  useEffect(() => {
    if (invoices.length === 0) return;
    const uniqueIds = Array.from(new Set(invoices.map(inv => inv.customerId)));
    
    // Initialize loading states for those not fresh in cache
    setLiveBalances(prev => {
      const next = { ...prev };
      let updated = false;
      const now = Date.now();
      for (const id of uniqueIds) {
        const cached = customerBalanceCache[id];
        const isFresh = cached && (now - cached.fetchedAt < CACHE_TTL);
        if (isFresh) {
          if (!next[id] || next[id].balance !== cached.statement.closingBalance || next[id].loading) {
            next[id] = { balance: cached.statement.closingBalance, loading: false, error: false };
            updated = true;
          }
        } else {
          if (!next[id] || !next[id].loading) {
            next[id] = { balance: next[id]?.balance || 0, loading: true, error: false };
            updated = true;
          }
        }
      }
      return updated ? next : prev;
    });

    // Trigger background fetches
    uniqueIds.forEach(id => {
      const cached = customerBalanceCache[id];
      const isFresh = cached && (Date.now() - cached.fetchedAt < CACHE_TTL);
      if (!isFresh) {
        fetchLiveBalance(id);
      }
    });
  }, [invoices, fetchLiveBalance]);

  const visibleCustomerIds = useMemo(() => {
    return Array.from(new Set(invoices.map(inv => inv.customerId)));
  }, [invoices]);

  const kpiOutstandingValue = useMemo(() => {
    if (invoices.length === 0) return 0;
    
    let total = 0;
    let anyLoading = false;
    for (const id of visibleCustomerIds) {
      const state = liveBalances[id];
      if (!state || state.loading) {
        anyLoading = true;
        break;
      }
      total += state.balance;
    }
    return anyLoading ? 'loading' : total;
  }, [visibleCustomerIds, liveBalances]);

  const openReview = async (invoice: HoldInvoice) => {
    setReviewInvoice(invoice);
    setSelectedSerials(new Set());
    setExpandedSkus(new Set(invoice.skuGroups.map(g => g.itemId)));
    
    // Check if the statement is already loaded in the cache and is fresh (5 minutes)
    const cached = customerBalanceCache[invoice.customerId];
    const now = Date.now();
    if (cached && (now - cached.fetchedAt < CACHE_TTL)) {
      console.log(`[HoldQueueClient] 0 balance API calls: using cached statement for customer ${invoice.customerId}`);
      setStatementData(cached.statement);
      return;
    }
    
    // Fetch live customer statement
    console.log(`[HoldQueueClient] Fetching customer statement for customerId: ${invoice.customerId}`);
    setStatementLoading(true);
    try {
      const res = await fetch(`/api/admin/customer-statement/statement?customerId=${invoice.customerId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStatementData(data.data);
        // Also cache the result
        customerBalanceCache[invoice.customerId] = {
          statement: data.data,
          fetchedAt: Date.now()
        };
      } else {
        toast.error('Failed to load live statement');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatementLoading(false);
    }
  };

  const toggleSerial = (serialNumber: string) => {
    setSelectedSerials(prev => {
      const next = new Set(prev);
      next.has(serialNumber) ? next.delete(serialNumber) : next.add(serialNumber);
      return next;
    });
  };

  const toggleSkuGroup = (itemId: string) => {
    setExpandedSkus(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const toggleAllEligible = () => {
    if (!reviewInvoice) return;
    const eligible = reviewInvoice.skuGroups.flatMap(g => g.serials.filter(s => s.isEligible && !s.isReleased)).map(s => s.serialNumber);
    if (selectedSerials.size === eligible.length) {
      setSelectedSerials(new Set());
    } else {
      setSelectedSerials(new Set(eligible));
    }
  };

  const handleRelease = async (serialNumbers?: string[], releaseAll?: boolean) => {
    if (!reviewInvoice) return;
    setIsReleasing(true);
    try {
      const res = await fetch('/api/admin/dcr/hold-queue/release', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: reviewInvoice.id, serialNumbers, releaseAll }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.errors ? data.errors.join('; ') : 'Release failed'));
      toast.success(`Successfully released ${data.released} serial(s)`);
      setSelectedSerials(new Set());
      
      // We don't close the modal, we just refresh the data so it updates live
      fetchData();
      refreshStats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsReleasing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6 relative">
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Hold Queue
            </h1>
            <p className="text-sm text-gray-500 mt-1">Management approval before DCR issuance. Review dues and release eligible serials.</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Clock className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Invoices On Hold</p>
              <p className="text-2xl font-black text-amber-700 mt-1">{kpis.invoicesOnHold}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Package className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Serials On Hold</p>
              <p className="text-2xl font-black text-orange-700 mt-1">{kpis.serialsOnHold}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="text-emerald-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ready To Release</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{kpis.readyToIssue}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <IndianRupee className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Outstanding Value</p>
              <p className="text-xl font-bold text-red-700 mt-1">
                {kpiOutstandingValue === 'loading' ? (
                  <span className="text-sm font-normal text-gray-400 italic">— Loading...</span>
                ) : (
                  formatCurrency(kpiOutstandingValue as number)
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice number, customer name, or serial number..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
        </div>

        {/* Data Grid Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
             <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#1A2766]" /></div>
          ) : invoices.length === 0 ? (
            <div className="py-20 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <p className="text-lg font-bold text-gray-800">Queue is Clear</p>
              <p className="text-sm text-gray-500 mt-1">No invoices currently awaiting DCR release.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4 w-12 text-center bg-gray-50">#</th>
                    <th className="px-5 py-4 bg-gray-50">Invoice #</th>
                    <th className="px-5 py-4 bg-gray-50">Customer Name</th>
                    <th className="px-5 py-4 bg-gray-50">Invoice Date</th>
                    <th className="px-5 py-4 text-right bg-gray-50">Invoice Value</th>
                    <th className="px-5 py-4 text-right bg-gray-50">Outstanding</th>
                    <th className="px-5 py-4 text-center bg-gray-50">Eligible</th>
                    <th className="px-5 py-4 text-center bg-gray-50">Released</th>
                    <th className="px-5 py-4 text-center bg-gray-50">Pending</th>
                    <th className="px-5 py-4 text-center bg-gray-50">Status</th>
                    <th className="px-5 py-4 text-right sticky right-0 bg-gray-50 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice, index) => {
                    const hasOutstanding = invoice.outstandingBalance > 0;
                    const pendingRelease = invoice.totalEligible - invoice.totalReleased;
                    const isAllReleased = invoice.totalEligible > 0 && invoice.totalReleased === invoice.totalEligible;

                    return (
                      <tr key={invoice.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-5 py-3 text-center text-gray-500 font-medium">{index + 1}</td>
                        <td className="px-5 py-3 font-semibold text-[#1A2766]">
                          <a href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${invoice.customerId}&invoiceId=${invoice.id}`} className="hover:underline flex items-center gap-1">
                            {invoice.invoiceNumber} <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-800 truncate max-w-xs">
                          <a href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${invoice.customerId}`} className="hover:underline hover:text-[#1A2766]">
                            {invoice.customerName}
                          </a>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-700">{formatCurrency(invoice.invoiceTotal)}</td>
                        <td className="px-5 py-3 text-right">
                          {(() => {
                            const balState = liveBalances[invoice.customerId];
                            if (!balState || balState.loading) {
                              return <span className="text-gray-400 italic text-xs">Loading...</span>;
                            }
                            if (balState.error) {
                              return <span className="text-red-500 font-medium text-xs">Error</span>;
                            }
                            return (
                              <span className={`font-bold ${balState.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formatCurrency(balState.balance)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3 text-center font-bold text-gray-800">{invoice.totalEligible}</td>
                        <td className="px-5 py-3 text-center font-bold text-emerald-600">{invoice.totalReleased}</td>
                        <td className="px-5 py-3 text-center font-bold text-amber-600">{pendingRelease}</td>
                        <td className="px-5 py-3 text-center">
                          {isAllReleased ? (
                            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">Fully Released</span>
                          ) : invoice.totalReleased > 0 ? (
                            <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">Partial Release</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">On Hold</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right sticky right-0 bg-white group-hover:bg-[#f4f7fb] transition-colors z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                          <button
                            onClick={() => openReview(invoice)}
                            className="bg-[#1A2766] hover:bg-[#1A2766]/90 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                          >
                            Review & Release
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Review & Release Modal */}
      {reviewInvoice && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 cursor-pointer"
          onClick={() => setReviewInvoice(null)}
        >
          <div 
            className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Invoice DCR Release Review</h2>
                <p className="text-sm text-gray-500 mt-0.5">Review customer statement and approve serial issuance</p>
              </div>
              <button onClick={() => setReviewInvoice(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body - Dual Pane */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Left Pane: DCR Details */}
              <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-[#1A2766]">
                        <a 
                          href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${reviewInvoice.customerId}&invoiceId=${reviewInvoice.id}`} 
                          className="hover:underline flex items-center gap-1.5"
                        >
                          {reviewInvoice.invoiceNumber} <ExternalLink size={14} />
                        </a>
                      </h3>
                      <p className="font-semibold text-gray-800 mt-1">
                        <a 
                          href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${reviewInvoice.customerId}`} 
                          className="text-[#1A2766] hover:underline flex items-center gap-1.5 w-fit"
                        >
                          {reviewInvoice.customerName} <ExternalLink size={14} />
                        </a>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Invoice Total</p>
                      <p className="text-lg font-black text-gray-900">{formatCurrency(reviewInvoice.invoiceTotal)}</p>
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={toggleAllEligible}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {selectedSerials.size > 0 ? 'Clear Selection' : 'Select All Eligible'}
                    </button>
                    {selectedSerials.size > 0 && (
                      <button
                        onClick={() => handleRelease(Array.from(selectedSerials))}
                        disabled={isReleasing}
                        className="flex items-center gap-1.5 bg-[#1A2766] text-white text-xs font-bold px-4 py-1.5 rounded-md hover:bg-[#1A2766]/90 disabled:opacity-50 transition-colors"
                      >
                        {isReleasing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Release Selected ({selectedSerials.size})
                      </button>
                    )}
                    {selectedSerials.size === 0 && reviewInvoice.totalEligible - reviewInvoice.totalReleased > 0 && (
                      <button
                        onClick={() => handleRelease(undefined, true)}
                        disabled={isReleasing}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {isReleasing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightCircle size={14} />}
                        Release All Eligible
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  <div className="space-y-4">
                    {reviewInvoice.skuGroups.map(group => {
                      const isExpanded = expandedSkus.has(group.itemId);
                      const itemStatusInfo = getItemStatus(group, reviewInvoice.dcrStatus);
                      
                      return (
                        <div key={group.itemId} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          <div 
                            className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => group.selectedForDCR && toggleSkuGroup(group.itemId)}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-800 text-sm">{group.itemName}</span>
                              <span className="text-xs text-gray-500 font-mono mt-0.5">{group.sku || 'No SKU'} • Qty: {group.quantity}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${itemStatusInfo.color}`}>
                                {itemStatusInfo.label}
                              </span>
                              {group.selectedForDCR && (
                                <div className="text-right">
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Released</p>
                                  <p className="text-sm font-black text-emerald-600">{group.releasedSerials} / {group.eligibleSerials}</p>
                                </div>
                              )}
                              {group.selectedForDCR && (
                                isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
                              )}
                            </div>
                          </div>
                          
                          {group.selectedForDCR && isExpanded && (
                            <div className="divide-y divide-gray-100 bg-white">
                              {group.serials.map(serial => {
                                const isChecked = selectedSerials.has(serial.serialNumber);
                                return (
                                  <div key={serial.allocationId} className={`flex items-center gap-4 px-4 py-2.5 transition-colors ${isChecked ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={!serial.isEligible || serial.isReleased}
                                      onChange={() => toggleSerial(serial.serialNumber)}
                                      className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    />
                                    <span className="font-mono text-sm text-gray-700 flex-1">{serial.serialNumber}</span>
                                    <div className="flex gap-2">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        serial.vendorDcrStatus === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                      }`}>
                                        {serial.vendorDcrStatus === 'RECEIVED' ? 'DCR Rcvd' : 'DCR Pndg'}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        serial.isReleased ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                                      }`}>
                                        {serial.isReleased ? 'Released' : serial.status}
                                      </span>
                                    </div>
                                    {serial.isEligible && !serial.isReleased && (
                                      <button
                                        onClick={() => handleRelease([serial.serialNumber])}
                                        disabled={isReleasing}
                                        className="text-xs font-semibold text-[#1A2766] hover:underline whitespace-nowrap ml-2 disabled:opacity-50"
                                      >
                                        Release
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              {group.serials.length === 0 && (
                                <div className="px-4 py-3 text-center text-xs text-gray-400 font-medium">
                                  No serials allocated
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Pane: Mini Customer Statement */}
              <div className="w-1/2 flex flex-col bg-gray-50 border-l border-gray-200">
                <MiniCustomerStatement
                  customerId={reviewInvoice.customerId}
                  statementData={statementData}
                  statementLoading={statementLoading}
                />
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

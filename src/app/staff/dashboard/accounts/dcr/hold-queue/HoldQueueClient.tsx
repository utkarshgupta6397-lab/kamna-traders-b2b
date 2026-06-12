'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, ChevronDown, ChevronUp, Clock, Users, CheckCircle, Loader2, Package, ArrowRightCircle, IndianRupee, FileText, X, ExternalLink, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useDcrStats } from '../layout';
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

interface HoldInvoice {
  id: string;
  invoiceNumber: string;
  zohoInvoiceId?: string;
  invoiceDate: string;
  invoiceTotal: number;
  dcrStatus: string;
  outstandingBalance: number;
  totalSerials: number;
  totalEligible: number;
  totalReleased: number;
  skuGroups: SkuGroup[];
}

interface CustomerHoldRecord {
  customerId: string;
  customerName: string;
  customerGstNo: string | null;
  outstandingBalance: number;
  totalInvoices: number;
  totalSerials: number;
  serialsOnHold: number;
  serialsIssued: number;
  serialsDcrPending: number;
  oldestInvoiceDate: string | null;
  invoices: HoldInvoice[];
}

const getAgeInfo = (dateStr: string | null) => {
  if (!dateStr) return { text: 'N/A', color: 'text-gray-500' };
  const diffTime = Math.max(0, new Date().getTime() - new Date(dateStr).getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return { text: 'Today', color: 'text-emerald-600' };
  if (diffDays === 1) return { text: '1 Day', color: 'text-emerald-600' };
  if (diffDays <= 3) return { text: `${diffDays} Days`, color: 'text-emerald-600' };
  if (diffDays <= 7) return { text: `${diffDays} Days`, color: 'text-orange-500' };
  return { text: `${diffDays} Days`, color: 'text-red-600' };
};

interface Kpis {
  customersOnHold: number;
  invoicesOnHold: number;
  serialsOnHold: number;
  readyToIssue: number;
  outstandingValueOnHold: number;
  zohoApiCallsToday: number;
}

const ZOHO_ORG_ID = process.env.NEXT_PUBLIC_ZOHO_ORG_ID;

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const getItemStatus = (group: SkuGroup, invoiceDcrStatus: string) => {
  if (!group.selectedForDCR) return { label: 'Non-DCR Item', color: 'bg-gray-100 text-gray-500 border-gray-200' };
  if (invoiceDcrStatus === 'NO_DCR_REQUIRED' || invoiceDcrStatus === 'SKIPPED') return { label: 'Skipped', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (group.totalSerials < group.quantity) return { label: 'Pending Serial Entry', color: 'bg-rose-100 text-rose-700 border-rose-200' };
  const hasPendingDcr = group.serials.some(s => s.vendorDcrStatus !== 'RECEIVED');
  const hasEligible = group.serials.some(s => s.isEligible && !s.isReleased);
  const hasReleased = group.serials.some(s => s.isReleased);

  if (hasPendingDcr) return { label: 'Purchase DCR Pending', color: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (hasEligible) return { label: 'Ready For Release', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (hasReleased) return { label: 'Released', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return { label: 'Hold', color: 'bg-gray-100 text-gray-700 border-gray-200' };
};

export default function HoldQueueClient() {
  const searchParams = useSearchParams();
  const { refreshStats } = useDcrStats();
  const [customers, setCustomers] = useState<CustomerHoldRecord[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ customersOnHold: 0, invoicesOnHold: 0, serialsOnHold: 0, readyToIssue: 0, outstandingValueOnHold: 0, zohoApiCallsToday: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('outstanding_desc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal states
  const [reviewCustomer, setReviewCustomer] = useState<CustomerHoldRecord | null>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  
  // Track selections as "invoiceId:serialNumber" to distinguish across invoices
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [isReleasing, setIsReleasing] = useState(false);
  const [showDcrOnly, setShowDcrOnly] = useState(true);
  const [expandedNonDcr, setExpandedNonDcr] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReviewCustomer(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', sort });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/dcr/hold-queue?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      
      setCustomers(data.customers || []);
      setKpis(data.kpis || {});
      
      setReviewCustomer(prev => {
        if (!prev) return null;
        const updated = data.customers?.find((c: CustomerHoldRecord) => c.customerId === prev.customerId);
        return updated || null;
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load hold queue');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefreshOutstanding = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading('Fetching latest balances from Zoho...');
    try {
      const res = await fetch('/api/admin/dcr/hold-queue/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Successfully updated outstanding balances.', { id: toastId });
        await fetchData();
      } else {
        throw new Error(data.error || 'Failed to refresh');
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleSort = (col: 'outstanding' | 'age' | 'date') => {
    if (col === 'outstanding') setSort(prev => prev === 'outstanding_desc' ? 'outstanding_asc' : 'outstanding_desc');
    if (col === 'age') setSort(prev => prev === 'age_desc' ? 'age_asc' : 'age_desc');
    if (col === 'date') setSort(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc');
  };

  const openReview = async (customer: CustomerHoldRecord) => {
    setReviewCustomer(customer);
    setSelectedSerials(new Set());
    
    // Auto-expand all invoices and their SKUs for easier review
    setExpandedInvoices(new Set(customer.invoices.map(i => i.id)));
    const allSkus = customer.invoices.flatMap(inv => inv.skuGroups.map(g => `${inv.id}:${g.itemId}`));
    setExpandedSkus(new Set(allSkus));
    
    setStatementLoading(true);
    try {
      const res = await fetch(`/api/admin/customer-statement/statement?customerId=${customer.customerId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStatementData(data.data);
      } else {
        toast.error('Failed to load live statement');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatementLoading(false);
    }
  };

  const toggleInvoice = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      next.has(invoiceId) ? next.delete(invoiceId) : next.add(invoiceId);
      return next;
    });
  };

  const toggleSkuGroup = (invoiceId: string, itemId: string) => {
    const key = `${invoiceId}:${itemId}`;
    setExpandedSkus(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleSerial = (invoiceId: string, serialNumber: string) => {
    const key = `${invoiceId}:${serialNumber}`;
    setSelectedSerials(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAllEligible = () => {
    if (!reviewCustomer) return;
    const allEligibleKeys = reviewCustomer.invoices.flatMap(inv => 
      inv.skuGroups.flatMap(g => 
        g.serials.filter(s => s.isEligible && !s.isReleased).map(s => `${inv.id}:${s.serialNumber}`)
      )
    );
    
    if (selectedSerials.size === allEligibleKeys.length) {
      setSelectedSerials(new Set());
    } else {
      setSelectedSerials(new Set(allEligibleKeys));
    }
  };

  const handleRelease = async (keys?: string[], releaseAll?: boolean) => {
    if (!reviewCustomer) return;
    setIsReleasing(true);
    
    // Group keys by invoiceId
    const keysToProcess = keys || Array.from(selectedSerials);
    
    try {
      if (releaseAll) {
        // Release all eligible across all invoices for this customer
        for (const inv of reviewCustomer.invoices) {
          const eligibleInThisInv = inv.totalEligible;
          if (eligibleInThisInv > 0) {
            await fetch('/api/admin/dcr/hold-queue/release', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoiceId: inv.id, releaseAll: true }),
            });
          }
        }
      } else {
        // Release specific serials, grouping by invoice
        const byInvoice = new Map<string, string[]>();
        for (const key of keysToProcess) {
          const [invId, sn] = key.split(':');
          if (!byInvoice.has(invId)) byInvoice.set(invId, []);
          byInvoice.get(invId)!.push(sn);
        }
        
        for (const [invId, serials] of Array.from(byInvoice.entries())) {
          await fetch('/api/admin/dcr/hold-queue/release', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: invId, serialNumbers: serials }),
          });
        }
      }
      
      toast.success('Release successful');
      setSelectedSerials(new Set());
      fetchData();
      refreshStats();

      if (searchParams.get('source') === 'customer_lookup') {
        setTimeout(() => window.close(), 1500);
      }
    } catch (err: any) {
      toast.error('Release encountered an error. Please refresh.');
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-4 lg:p-6 relative">
      <div className="max-w-[1400px] mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Hold Queue
            </h1>
            <p className="text-sm text-gray-500 mt-1">Management approval. Review dues across all held invoices for each customer.</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg border border-indigo-200 shadow-sm p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Users className="text-indigo-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customers On Hold</p>
              <p className="text-xl font-black text-indigo-700 mt-0.5">{kpis.customersOnHold || 0}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-amber-200 shadow-sm p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <FileText className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Invoices On Hold</p>
              <p className="text-xl font-black text-amber-700 mt-0.5">{kpis.invoicesOnHold || 0}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-orange-200 shadow-sm p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Package className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Serials On Hold</p>
              <p className="text-xl font-black text-orange-700 mt-0.5">{kpis.serialsOnHold || 0}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-red-200 shadow-sm p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <IndianRupee className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Outstanding Value</p>
              <p className="text-lg font-bold text-red-700 mt-0.5">
                {fmtCurrency(kpis.outstandingValueOnHold || 0)}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Activity className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">API Calls Today</p>
              <p className="text-xl font-black text-blue-700 mt-0.5">{kpis.zohoApiCallsToday || 0}</p>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2 flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative flex-1 w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer name, invoice number, or serial..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <button
            onClick={handleRefreshOutstanding}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded border border-gray-200 disabled:opacity-50"
          >
            {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Refresh Outstanding
          </button>
        </div>

        {/* Compact Customer Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
             <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#1A2766]" /></div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-base font-bold text-gray-800">Queue is Clear</p>
              <p className="text-xs text-gray-500 mt-1">No customers currently on hold.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">#</th>
                    <th className="px-3 py-2">Customer Name</th>
                    <th className="px-3 py-2 text-right cursor-pointer hover:bg-gray-100 transition-colors group select-none" onClick={() => toggleSort('date')}>
                      <div className="flex items-center justify-end gap-1">
                        Oldest Invoice
                        <span className={`text-[9px] ${sort.startsWith('date_') ? 'text-blue-600 font-bold' : 'text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                          {sort === 'date_desc' ? '▼' : sort === 'date_asc' ? '▲' : '↕'}
                        </span>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-right cursor-pointer hover:bg-gray-100 transition-colors group select-none" onClick={() => toggleSort('age')}>
                      <div className="flex items-center justify-end gap-1">
                        Age
                        <span className={`text-[9px] ${sort.startsWith('age_') ? 'text-blue-600 font-bold' : 'text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                          {sort === 'age_desc' ? '▼' : sort === 'age_asc' ? '▲' : '↕'}
                        </span>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-right cursor-pointer hover:bg-gray-100 transition-colors group select-none" onClick={() => toggleSort('outstanding')}>
                      <div className="flex items-center justify-end gap-1">
                        Outstanding Balance
                        <span className={`text-[9px] ${sort.startsWith('outstanding_') ? 'text-blue-600 font-bold' : 'text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                          {sort === 'outstanding_desc' ? '▼' : sort === 'outstanding_asc' ? '▲' : '↕'}
                        </span>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-center">Total Invoices</th>
                    <th className="px-3 py-2 text-center">Total Serials</th>
                    <th className="px-3 py-2 text-center">Serials On Hold</th>
                    <th className="px-3 py-2 text-center">Serials Issued</th>
                    <th className="px-3 py-2 text-center">Serials DCR Pending</th>
                    <th className="px-3 py-2 text-right sticky right-0 bg-gray-50 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((customer, index) => {
                    const hasOutstanding = customer.outstandingBalance > 0;
                    return (
                      <tr key={customer.customerId} className="hover:bg-blue-50/40 transition-colors group">
                        <td className="px-3 py-2.5 text-center text-gray-500 font-medium">{index + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-gray-900 truncate max-w-[200px]" title={customer.customerName}>
                          {customer.customerName}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-600">
                          {customer.oldestInvoiceDate ? format(new Date(customer.oldestInvoiceDate), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold">
                          <span className={getAgeInfo(customer.oldestInvoiceDate).color}>{getAgeInfo(customer.oldestInvoiceDate).text}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-bold text-sm ${hasOutstanding ? 'text-red-600' : 'text-emerald-600'}`}>
                            {fmtCurrency(customer.outstandingBalance)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-gray-700">{customer.totalInvoices}</td>
                        <td className="px-3 py-2.5 text-center font-medium text-gray-600">{customer.totalSerials}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-bold text-amber-600">{customer.serialsOnHold}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-bold text-emerald-600">{customer.serialsIssued}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-bold text-orange-600">{customer.serialsDcrPending}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right sticky right-0 bg-white group-hover:bg-[#f8fafc] transition-colors z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                          <button
                            onClick={() => openReview(customer)}
                            className="bg-[#1A2766] hover:bg-[#1A2766]/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded transition-colors shadow-sm"
                          >
                            Review Customer
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

      {/* Review Customer Modal */}
      {reviewCustomer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 cursor-pointer"
          onClick={() => setReviewCustomer(null)}
        >
          <div 
            className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 truncate max-w-md" title={reviewCustomer.customerName}>
                    {reviewCustomer.customerName}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Review across {reviewCustomer.totalInvoices} held invoices</p>
                </div>
                <div className="h-8 w-px bg-gray-200 mx-2"></div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Held Dues</p>
                  <p className="text-lg font-black text-red-600 leading-tight">{fmtCurrency(reviewCustomer.outstandingBalance)}</p>
                </div>
              </div>
              <button onClick={() => setReviewCustomer(null)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body - Dual Pane */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Left Pane: Customer Invoices & Serials */}
              <div className="w-[70%] flex flex-col border-r border-gray-200 bg-white">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-shrink-0 items-center justify-between">
                  <div className="text-xs text-gray-600 font-medium">
                    <span className="text-amber-600 font-bold">{reviewCustomer.serialsOnHold}</span> Serials On Hold • <span className="text-emerald-600 font-bold">{reviewCustomer.totalSerials - reviewCustomer.serialsOnHold}</span> Ready/Issued
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={showDcrOnly} 
                        onChange={(e) => setShowDcrOnly(e.target.checked)} 
                        className="w-3.5 h-3.5 text-[#1A2766] rounded border-gray-300 focus:ring-[#1A2766]" 
                      />
                      Show DCR Items Only
                    </label>
                    <button
                      onClick={toggleAllEligible}
                      className="px-2.5 py-1 border border-gray-300 rounded text-[11px] font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {selectedSerials.size > 0 ? 'Clear Selection' : 'Select All Eligible'}
                    </button>
                    {selectedSerials.size > 0 && (
                      <button
                        onClick={() => handleRelease()}
                        disabled={isReleasing}
                        className="flex items-center gap-1 bg-[#1A2766] text-white text-[11px] font-bold px-3 py-1 rounded hover:bg-[#1A2766]/90 disabled:opacity-50 transition-colors"
                      >
                        {isReleasing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Release Selected ({selectedSerials.size})
                      </button>
                    )}
                    {selectedSerials.size === 0 && reviewCustomer.invoices.some(inv => inv.totalEligible > 0) && (
                      <button
                        onClick={() => handleRelease(undefined, true)}
                        disabled={isReleasing}
                        className="flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {isReleasing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />}
                        Release All Eligible
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                  {reviewCustomer.invoices.map(invoice => {
                    const invExpanded = expandedInvoices.has(invoice.id);
                    const hasEligible = invoice.totalEligible > 0;
                    const dcrPending = invoice.totalSerials - invoice.totalEligible - invoice.totalReleased;
                    
                    return (
                      <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                        {/* Invoice Header */}
                        <div 
                          className="px-4 py-3 bg-gray-100 flex items-center justify-between cursor-pointer border-b border-gray-200 hover:bg-gray-200/70 transition-colors"
                          onClick={() => toggleInvoice(invoice.id)}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm">{invoice.invoiceNumber}</span>
                              <span className="text-[11px] text-gray-500 font-medium">{format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}</span>
                              <span className="text-[11px] text-gray-400">•</span>
                              <span className={`text-[11px] font-bold ${getAgeInfo(invoice.invoiceDate).color}`}>{getAgeInfo(invoice.invoiceDate).text}</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className="text-[11px] text-gray-500 font-medium">Outst: {fmtCurrency(invoice.outstandingBalance)}</span>
                              <span className="text-[11px] text-gray-500 font-medium px-2.5 border-l border-gray-300">Total: {invoice.totalSerials}</span>
                              <span className="text-[11px] text-emerald-600 font-bold">Ready: {invoice.totalEligible}</span>
                              <span className="text-[11px] text-orange-500 font-bold">Vendor DCR Pending: {dcrPending}</span>
                              <span className="text-[11px] text-blue-600 font-bold">Released: {invoice.totalReleased}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                            {hasEligible && (
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const eligibleKeys = invoice.skuGroups.flatMap(g => g.serials.filter(s => s.isEligible && !s.isReleased).map(s => `${invoice.id}:${s.serialNumber}`));
                                  if (eligibleKeys.length > 0) handleRelease(eligibleKeys);
                                }}
                                disabled={isReleasing}
                                className="bg-[#1A2766] text-white text-[10px] font-bold px-2 py-1 rounded hover:bg-[#1A2766]/90 disabled:opacity-50 transition-colors shadow-sm"
                              >
                                Release Invoice
                              </button>
                            )}
                            <button onClick={() => toggleInvoice(invoice.id)} className="p-1">
                              {invExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                            </button>
                          </div>
                        </div>

                        {/* SKUs & Serials */}
                        {invExpanded && (
                          <div className="p-3 bg-white">
                            {/* DCR Items */}
                            <div className="space-y-3">
                              {invoice.skuGroups.filter(g => g.selectedForDCR).map(group => {
                                const itemKey = `${invoice.id}:${group.itemId}`;
                                const skuExpanded = expandedSkus.has(itemKey);
                                const skuDcrPending = group.totalSerials - group.eligibleSerials - group.releasedSerials;
                                const skuHasEligible = group.eligibleSerials > 0;
                                
                                return (
                                  <div key={group.itemId} className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                                    <div 
                                      className="bg-gray-50/80 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                                      onClick={() => toggleSkuGroup(invoice.id, group.itemId)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="font-semibold text-gray-800 text-xs truncate max-w-[180px]">{group.itemName}</span>
                                        <span className="text-[10px] text-gray-500 font-mono border-l pl-2">{group.sku || 'No SKU'}</span>
                                        <span className="text-[10px] text-gray-500 font-medium px-2 border-l border-gray-300">Total: {group.totalSerials}</span>
                                        <span className="text-[10px] text-emerald-600 font-bold">Ready: {group.eligibleSerials}</span>
                                        <span className="text-[10px] text-orange-500 font-bold">Vendor DCR Pending: {skuDcrPending}</span>
                                        <span className="text-[10px] text-blue-600 font-bold">Released: {group.releasedSerials}</span>
                                      </div>
                                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                        {skuHasEligible && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const eligibleKeys = group.serials.filter(s => s.isEligible && !s.isReleased).map(s => `${invoice.id}:${s.serialNumber}`);
                                              if (eligibleKeys.length > 0) handleRelease(eligibleKeys);
                                            }}
                                            disabled={isReleasing}
                                            className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                                          >
                                            Release Item
                                          </button>
                                        )}
                                        <button onClick={() => toggleSkuGroup(invoice.id, group.itemId)} className="p-1">
                                          {skuExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {skuExpanded && (
                                      <div className="p-3 bg-white">
                                        <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-2">
                                          {group.serials.map(serial => {
                                            const key = `${invoice.id}:${serial.serialNumber}`;
                                            const isChecked = selectedSerials.has(key);
                                            
                                            let chipClass = 'bg-gray-100 text-gray-700 border-gray-200';
                                            if (serial.isReleased) chipClass = 'bg-blue-50 text-blue-700 border-blue-200';
                                            else if (serial.isEligible) chipClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm';
                                            else if (serial.vendorDcrStatus !== 'RECEIVED') chipClass = 'bg-orange-50 text-orange-700 border-orange-200';
                                            else chipClass = 'bg-red-50 text-red-700 border-red-200';

                                            return (
                                              <label 
                                                key={serial.allocationId} 
                                                className={`flex items-center gap-1.5 px-2 py-1 border rounded cursor-pointer transition-colors ${chipClass} ${serial.isEligible && !serial.isReleased ? 'hover:bg-emerald-100' : ''}`}
                                              >
                                                {serial.isEligible && !serial.isReleased && (
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleSerial(invoice.id, serial.serialNumber)}
                                                    className="rounded-sm border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-3 h-3 cursor-pointer"
                                                  />
                                                )}
                                                <span className="font-mono text-[10px] tracking-tight">{serial.serialNumber}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                        {group.serials.length === 0 && (
                                          <div className="text-center text-[10px] text-gray-400 font-medium">
                                            No serials allocated
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Non-DCR Items */}
                            {!showDcrOnly && invoice.skuGroups.some(g => !g.selectedForDCR) && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <div 
                                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 py-1.5 px-2 -mx-2 rounded transition-colors w-max"
                                  onClick={() => setExpandedNonDcr(prev => {
                                    const next = new Set(prev);
                                    next.has(invoice.id) ? next.delete(invoice.id) : next.add(invoice.id);
                                    return next;
                                  })}
                                >
                                  {expandedNonDcr.has(invoice.id) ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    Non-DCR Items ({invoice.skuGroups.filter(g => !g.selectedForDCR).length})
                                  </h4>
                                </div>
                                
                                {expandedNonDcr.has(invoice.id) && (
                                  <div className="space-y-2 mt-3">
                                    {invoice.skuGroups.filter(g => !g.selectedForDCR).map(group => (
                                      <div key={group.itemId} className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                                        <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="font-semibold text-gray-600 text-[11px] truncate flex-1">{group.itemName}</span>
                                        <span className="text-[10px] text-gray-500 font-mono border-l pl-2">{group.sku || 'No SKU'}</span>
                                        <span className="text-[10px] text-gray-500 font-medium px-2 border-l border-gray-300">Qty: {group.quantity}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Mini Customer Statement */}
              <div className="w-[30%] flex flex-col bg-gray-50 border-l border-gray-200">
                <MiniCustomerStatement
                  customerId={reviewCustomer.customerId}
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

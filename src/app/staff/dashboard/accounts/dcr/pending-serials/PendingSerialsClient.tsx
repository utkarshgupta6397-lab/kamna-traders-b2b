'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, ChevronLeft, ChevronRight, ExternalLink, Inbox, CheckCircle2, AlertCircle, X, ListTodo } from 'lucide-react';

const ZOHO_ORG_ID = process.env.NEXT_PUBLIC_ZOHO_ORG_ID || '';

export default function PendingSerialsClient() {
  const router = useRouter();
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewState, setViewState] = useState<'active' | 'completed'>('active');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalInvoices, setTotalInvoices] = useState(0);

  // Modal State
  const [viewItemsModal, setViewItemsModal] = useState<any | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    setLoadingInvoiceId(null);
  }, []);

  // KPIs
  const [kpis, setKpis] = useState({
    invoicesWaiting: 0,
    totalSerialsPending: 0,
    partiallyAllocated: 0,
    completedToday: 0
  });

  useEffect(() => {
    fetchPendingInvoices();
  }, [viewState, page, limit, searchQuery, sortOrder]);

  const fetchPendingInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/dcr/pending-serials?view=${viewState}&page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&sort=${sortOrder}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setInvoices(data.invoices || []);
      setTotalInvoices(data.total || 0);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch pending serials list');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_SERIALS': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'PARTIALLY_ALLOCATED': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'READY_FOR_DCR': return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'READY_TO_ISSUE': return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'ISSUED': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent === 0) return 'bg-red-500';
    if (percent === 100) return 'bg-green-500';
    return 'bg-orange-500';
  };

  const totalPages = Math.ceil(totalInvoices / limit) || 1;
  const startRow = (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, totalInvoices);

  const openZohoInvoice = (e: React.MouseEvent, inv: any) => {
    e.preventDefault();
    if (!inv.zohoInvoiceId) {
      toast.error('Zoho Invoice ID unavailable');
      return;
    }
    console.log({ invoiceId: inv.zohoInvoiceId, invoiceNumber: inv.invoiceNumber });
    window.open(`https://books.zoho.in/app${ZOHO_ORG_ID ? '/' + ZOHO_ORG_ID : ''}#/invoices/${inv.zohoInvoiceId}`, '_blank');
  };

  const openZohoCustomer = (e: React.MouseEvent, inv: any) => {
    e.preventDefault();
    if (!inv.customerId) {
      toast.error('Customer ID unavailable');
      return;
    }
    console.log({ customerId: inv.customerId, customerName: inv.customerName });
    window.open(`https://books.zoho.in/app${ZOHO_ORG_ID ? '/' + ZOHO_ORG_ID : ''}#/contacts/${inv.customerId}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Top Controls Row */}
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shrink-0">
        {/* View Toggles */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
          <button
            onClick={() => { setViewState('active'); setPage(1); }}
            className={`px-6 py-2 text-sm font-semibold rounded-md transition-all ${
              viewState === 'active' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Queue
          </button>
          <button
            onClick={() => { setViewState('completed'); setPage(1); }}
            className={`px-6 py-2 text-sm font-semibold rounded-md transition-all ${
              viewState === 'completed' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Completed
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-3 w-full xl:w-auto">
          {/* Global Search */}
          <div className="relative w-full xl:w-72">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search invoice or customer..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500 font-medium">Sort By:</span>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="border border-gray-300 rounded-md px-2.5 py-2 text-xs font-semibold focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766] bg-white text-gray-700 cursor-pointer shadow-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white py-5 px-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Total Serials Pending</span>
            <span className="text-2xl font-bold text-red-500 mt-1">{kpis.totalSerialsPending}</span>
          </div>
          <div className="p-3 bg-red-50 text-red-500 rounded-lg">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-white py-5 px-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Partially Allocated</span>
            <span className="text-2xl font-bold text-orange-600 mt-1">{kpis.partiallyAllocated}</span>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
            <ListTodo size={20} />
          </div>
        </div>

        <div className="bg-white py-5 px-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Invoices Waiting</span>
            <span className="text-2xl font-bold text-purple-600 mt-1">{kpis.invoicesWaiting}</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Inbox size={20} />
          </div>
        </div>

        <div className="bg-white py-5 px-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Completed Today</span>
            <span className="text-2xl font-bold text-teal-600 mt-1">{kpis.completedToday}</span>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Invoice Table Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[400px]">
        <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
          <h3 className="font-semibold text-gray-800 text-sm">
            {viewState === 'active' ? 'Active Serials Queue' : 'Completed Serials Queue'}
          </h3>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider w-12 text-center">#</th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider w-40">Invoice Number</th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider w-28">Invoice Date</th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-center w-32">DCR Items</th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider w-48 text-center">Allocation Progress</th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-center w-36">Status</th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-center w-36">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded mx-auto w-4"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded mx-auto w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                    <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-8 bg-gray-200 rounded w-full"></div></td>
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500 text-sm bg-gray-50/50">
                    No invoices found in {viewState === 'active' ? 'Active Queue' : 'Completed Queue'}.
                  </td>
                </tr>
              ) : (
                invoices.map((inv, idx) => {
                  const percent = inv.totalRequired > 0 ? Math.round((inv.totalAllocated / inv.totalRequired) * 100) : 0;
                  return (
                    <tr key={inv.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-4 py-3 text-center text-gray-400 text-xs font-medium align-middle">{startRow + idx}</td>
                      <td className="px-4 py-3 font-medium text-xs align-middle">
                        <button 
                          onClick={(e) => openZohoInvoice(e, inv)}
                          className="text-[#1A2766] hover:underline inline-flex items-center gap-1 focus:outline-none text-left"
                        >
                          {inv.invoiceNumber} <ExternalLink size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-800 text-xs align-middle leading-snug whitespace-normal break-words">
                        <button onClick={(e) => openZohoCustomer(e, inv)} className="hover:underline hover:text-[#1A2766] focus:outline-none text-left">
                          {inv.customerName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs align-middle">
                        {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-gray-800 text-sm">{inv.dcrItems.length} {inv.dcrItems.length === 1 ? 'SKU' : 'SKUs'}</span>
                          <button 
                            onClick={() => setViewItemsModal(inv)}
                            className="text-xs text-[#1A2766] hover:underline"
                          >
                            View Items
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        <div className="flex flex-col gap-1.5 w-full items-center">
                          <div className="text-[10px] font-medium text-gray-600 flex justify-between w-full max-w-[120px]">
                            <span>{inv.totalAllocated} / {inv.totalRequired}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full max-w-[120px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${getProgressColor(percent)}`} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(inv.dcrStatus)}`}>
                          {inv.dcrStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                        {inv.dcrStatus === 'PENDING_SERIALS' || inv.dcrStatus === 'PARTIALLY_ALLOCATED' ? (
                          <button
                            onClick={() => {
                              if (loadingInvoiceId) return;
                              if (!inv.id) {
                                toast.error('Local Invoice ID unavailable');
                                return;
                              }
                              setLoadingInvoiceId(inv.id);
                              const currentParams = new URLSearchParams({
                                view: viewState,
                                page: page.toString(),
                                limit: limit.toString(),
                                search: searchQuery,
                                sort: sortOrder
                              }).toString();
                              router.push(`/staff/dashboard/accounts/dcr/pending-serials/${inv.id}?${currentParams}`);
                            }}
                            disabled={loadingInvoiceId !== null}
                            className="bg-[#1A2766] text-white hover:bg-[#1A2766]/90 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors w-full flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loadingInvoiceId === inv.id ? (
                              <>
                                ⏳ Opening Allocation...
                              </>
                            ) : (
                              'Allocate Serials'
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (loadingInvoiceId) return;
                              if (!inv.id) {
                                toast.error('Local Invoice ID unavailable');
                                return;
                              }
                              setLoadingInvoiceId(inv.id);
                              const currentParams = new URLSearchParams({
                                view: viewState,
                                page: page.toString(),
                                limit: limit.toString(),
                                search: searchQuery,
                                sort: sortOrder
                              }).toString();
                              router.push(`/staff/dashboard/accounts/dcr/pending-serials/${inv.id}?${currentParams}`);
                            }}
                            disabled={loadingInvoiceId !== null}
                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors w-full flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loadingInvoiceId === inv.id ? (
                              <>
                                ⏳ Loading...
                              </>
                            ) : (
                              'View Allocations'
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-900">{totalInvoices > 0 ? startRow : 0}</span> to <span className="font-semibold text-gray-900">{endRow}</span> of <span className="font-semibold text-gray-900">{totalInvoices}</span> invoices
          </span>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* View Items Modal */}
      {viewItemsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Invoice DCR Items</h3>
                <p className="text-sm text-gray-500">Invoice {viewItemsModal.invoiceNumber}</p>
              </div>
              <button 
                onClick={() => setViewItemsModal(null)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <div className="space-y-4">
                {viewItemsModal.dcrItems.map((item: any, idx: number) => (
                  <div key={item.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50/30 flex flex-col gap-3">
                    <div className="flex gap-3 items-start">
                      <div className="bg-blue-100 text-[#1A2766] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{item.itemName}</h4>
                        {item.sku && <p className="text-xs text-gray-500 font-mono mt-0.5">SKU: {item.sku}</p>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pl-9">
                      <div className="bg-white rounded-md border border-gray-200 p-2 text-center shadow-sm">
                        <div className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Required</div>
                        <div className="font-bold text-gray-800">{item.required}</div>
                      </div>
                      <div className="bg-white rounded-md border border-gray-200 p-2 text-center shadow-sm">
                        <div className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Allocated</div>
                        <div className="font-bold text-[#1A2766]">{item.allocated}</div>
                      </div>
                      <div className="bg-white rounded-md border border-gray-200 p-2 text-center shadow-sm">
                        <div className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Balance</div>
                        <div className="font-bold text-orange-600">{item.balance}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setViewItemsModal(null)}
                className="bg-gray-800 text-white hover:bg-gray-700 px-5 py-2 rounded-md text-sm font-semibold shadow-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

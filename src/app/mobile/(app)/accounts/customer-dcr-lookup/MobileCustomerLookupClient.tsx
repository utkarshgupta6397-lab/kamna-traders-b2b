'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronDown, X, Activity, RefreshCw , FileText} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function MobileCustomerLookupClient() {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Data States
  const [customer, setCustomer] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);
  const [isError, setIsError] = useState(false);

  // Search Sheet State
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Filters State
  const [filterMode, setFilterMode] = useState<'PENDING' | 'ALL'>('PENDING');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);

  // Inline Expansion State
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [inlineFilter, setInlineFilter] = useState('ALL');
  const [invoiceSerialData, setInvoiceSerialData] = useState<Record<string, {
    status: 'idle' | 'loading' | 'success' | 'error',
    items: any[],
    total: number,
    page: number,
    hasMore: boolean,
  }>>({});

  const INLINE_STATUS_OPTIONS = [
    { label: 'All', value: 'ALL' },
    { label: 'Serial Pending', value: 'SERIAL_PENDING' },
    { label: 'Vendor DCR Pending', value: 'VENDOR_PENDING' },
    { label: 'On Hold', value: 'HOLD' },
    { label: 'Ready to Issue', value: 'READY_TO_ISSUE' },
    { label: 'Issued', value: 'ISSUED' },
  ];

  const fetchInvoiceSerials = async (invId: string, pageNum: number, filterType: string) => {
    setInvoiceSerialData(prev => ({
      ...prev,
      [invId]: {
        ...(prev[invId] || { items: [], total: 0, hasMore: false }),
        status: 'loading',
        page: pageNum
      }
    }));

    try {
      const params = new URLSearchParams({
        invoiceId: invId,
        page: pageNum.toString(),
        limit: '50'
      });

      if (filterType === 'VENDOR_PENDING') {
        params.append('vendorDcrStatus', 'NOT_RECEIVED');
      } else if (filterType === 'SERIAL_PENDING') {
        params.append('status', 'AVAILABLE'); 
      } else if (filterType !== 'ALL') {
        params.append('status', filterType);
      }

      const res = await fetch(`/api/admin/dcr/serial-registry?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setInvoiceSerialData(prev => {
        const existingItems = pageNum === 1 ? [] : (prev[invId]?.items || []);
        const newItems = [...existingItems, ...(data.serials || [])];
        return {
          ...prev,
          [invId]: {
            status: 'success',
            items: newItems,
            total: data.total || 0,
            page: pageNum,
            hasMore: newItems.length < (data.total || 0)
          }
        };
      });
    } catch (err) {
      setInvoiceSerialData(prev => ({
        ...prev,
        [invId]: {
          ...(prev[invId] || { items: [], total: 0, page: 1, hasMore: false }),
          status: 'error'
        }
      }));
    }
  };

  const toggleInvoiceExpanded = (invId: string) => {
    if (expandedInvoiceId === invId) {
      setExpandedInvoiceId(null);
    } else {
      setExpandedInvoiceId(invId);
      setInlineFilter('ALL');
      const existing = invoiceSerialData[invId];
      if (!existing || existing.status === 'error') {
        fetchInvoiceSerials(invId, 1, 'ALL');
      }
    }
  };


  const STATUS_OPTIONS = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'UNPROCESSED', value: 'UNPROCESSED' },
    { label: 'PENDING SERIALS', value: 'PENDING_SERIALS' },
    { label: 'HOLD', value: 'HOLD' },
    { label: 'READY TO ISSUE', value: 'READY_TO_ISSUE' },
    { label: 'ISSUED', value: 'ISSUED' },
    { label: 'PROCESSED_NO_DCR', value: 'PROCESSED_NO_DCR' },
  ];

  // Initialize from LocalStorage
  useEffect(() => {
    const savedId = localStorage.getItem('mobile_dcr_customer_id');
    if (savedId) {
      setSelectedCustomerId(savedId);
      fetchSummary(savedId);
    }
  }, []);

  const fetchSummary = async (customerId: string) => {
    setIsFetchingSummary(true);
    setIsError(false);
    try {
      const res = await fetch(`/api/admin/dcr/customer/${customerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch summary');
      
      setSummary(data.data);
      if (data.data.customer) setCustomer(data.data.customer);
      if (data.data.summary?.kpis?.closingBalance !== undefined) {
        setBalance(data.data.summary.kpis.closingBalance);
      }
    } catch (err) {
      setIsError(true);
      toast.error('Unable to load customer DCR information.');
    } finally {
      setIsFetchingSummary(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/dcr/customer-lookup/search?q=${encodeURIComponent(query)}&list=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResults(data.customers || []);
    } catch (err: any) {
      toast.error('Unable to load customers.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const onSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      handleSearch(val);
    }, 400);
  };

  const selectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    localStorage.setItem('mobile_dcr_customer_id', cust.id);
    setCustomer(cust);
    setExpandedInvoiceId(null);
    setSummary(null);
    setBalance(null);
    setIsSearchSheetOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    fetchSummary(cust.id);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const isPendingInvoice = (inv: any) => {
    if (filterMode === 'PENDING') {
      return inv.processingStatus === 'UNPROCESSED' || inv.issued !== inv.dcrPanels;
    }
    return true;
  };

  const matchesStatusFilter = (inv: any) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'UNPROCESSED') return inv.processingStatus === 'UNPROCESSED';
    if (statusFilter === 'PROCESSED_NO_DCR') return inv.processingStatus === 'PROCESSED_NO_DCR';
    if (statusFilter === 'HOLD') return inv.onHold > 0;
    if (statusFilter === 'READY_TO_ISSUE') return inv.readyToIssue > 0;
    if (statusFilter === 'ISSUED') return inv.dcrPanels > 0 && inv.issued === inv.dcrPanels;
    if (statusFilter === 'PENDING_SERIALS') return inv.serialEntryPending > 0 || inv.vendorDcrPending > 0;
    return true;
  };

  const allInvoicesList = summary ? [...(summary.dcrRequiredInvoices || []), ...(summary.noDcrInvoices || [])] : [];
  const filteredInvoices = allInvoicesList.filter(isPendingInvoice).filter(matchesStatusFilter);

  // Calculate dynamic totals for the filtered subset (similar to desktop Section A, but applied to current view)
  const dcrOnlyFiltered = summary?.dcrRequiredInvoices 
    ? summary.dcrRequiredInvoices.filter(isPendingInvoice).filter(matchesStatusFilter) 
    : [];

  const dynamicTotals = {
    dcrPanels: dcrOnlyFiltered.reduce((sum: number, inv: any) => sum + inv.dcrPanels, 0),
    serialEntryPending: dcrOnlyFiltered.reduce((sum: number, inv: any) => sum + inv.serialEntryPending, 0),
    vendorDcrPending: dcrOnlyFiltered.reduce((sum: number, inv: any) => sum + inv.vendorDcrPending, 0),
    onHold: dcrOnlyFiltered.reduce((sum: number, inv: any) => sum + inv.onHold, 0),
    readyToIssue: dcrOnlyFiltered.reduce((sum: number, inv: any) => sum + inv.readyToIssue, 0),
    issued: dcrOnlyFiltered.reduce((sum: number, inv: any) => sum + inv.issued, 0),
  };


  const getSerialStatusBadge = (status: string) => {
    let colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
    switch (status) {
      case 'AVAILABLE': colorClass = 'bg-blue-50 text-blue-600 border-blue-200'; break;
      case 'ALLOCATED': colorClass = 'bg-purple-50 text-purple-600 border-purple-200'; break;
      case 'HOLD': colorClass = 'bg-red-50 text-red-600 border-red-200'; break;
      case 'READY_TO_ISSUE': colorClass = 'bg-teal-50 text-teal-600 border-teal-200'; break;
      case 'ISSUED': colorClass = 'bg-green-50 text-green-600 border-green-200'; break;
      case 'RETURNED': colorClass = 'bg-orange-50 text-orange-600 border-orange-200'; break;
    }
    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap ${colorClass}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const getVendorDcrBadge = (status: string) => {
    let colorClass = 'text-gray-600';
    switch (status) {
      case 'NOT_RECEIVED': colorClass = 'text-orange-600 font-bold'; break;
      case 'RECEIVED': colorClass = 'text-green-600 font-bold'; break;
      case 'EXEMPT': colorClass = 'text-blue-600 font-bold'; break;
    }
    return <span className={colorClass}>{status.replace(/_/g, ' ')}</span>;
  };

  const getWorkflowBadge = (inv: any) => {
    let colorClass = 'bg-gray-50 text-gray-700 border-gray-200';
    if (inv.displayStatus === 'FULLY ISSUED') { colorClass = 'bg-green-50 text-green-600 border-green-200'; }
    else if (inv.displayStatus === 'READY TO ISSUE') { colorClass = 'bg-teal-50 text-teal-600 border-teal-200'; }
    else if (inv.displayStatus === 'HOLD QUEUE') { colorClass = 'bg-red-50 text-red-600 border-red-200'; }
    else if (inv.displayStatus === 'VENDOR DCR PENDING') { colorClass = 'bg-orange-50 text-orange-600 border-orange-200'; }
    else if (inv.displayStatus === 'SERIAL ENTRY PENDING') { colorClass = 'bg-orange-50 text-orange-600 border-orange-200'; }
    else if (inv.displayStatus === 'UNPROCESSED') { colorClass = 'bg-red-50 text-red-600 border-red-200'; }
    else if (inv.displayStatus === 'PROCESSED - NO DCR REQUIRED') { colorClass = 'bg-gray-100 text-gray-600 border-gray-300'; }
    else if (inv.displayStatus === 'DCR IDENTIFIED') { colorClass = 'bg-blue-50 text-blue-600 border-blue-200'; }

    return (
      <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border inline-block ${colorClass}`}>
        {inv.displayStatus === 'HOLD QUEUE' ? '🔴 ' : ''}
        {inv.displayStatus}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-24 text-sm w-full">
      
      {/* INITIAL STATE / EMPTY STATE */}
      {!selectedCustomerId && !isFetchingSummary && (
        <div className="flex flex-col items-center justify-center p-8 mt-10 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 border border-blue-100">
            <Search className="text-blue-500" size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">No customer selected</h2>
          <p className="text-sm text-slate-500 mb-6">Select a customer to view DCR information.</p>
          <button 
            onClick={() => setIsSearchSheetOpen(true)}
            className="bg-[#1A2766] text-white px-6 py-3 rounded-xl font-bold w-full shadow-md active:scale-95 transition-transform"
          >
            Select Customer
          </button>
        </div>
      )}

      {/* SELECTED CUSTOMER VIEW */}
      {selectedCustomerId && (
        <>
          <div className="px-4 pt-4 flex items-stretch gap-2">
            <button 
              onClick={() => setIsSearchSheetOpen(true)}
              className="flex-1 flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm active:bg-slate-50 transition-colors min-w-0"
            >
              <div className="flex flex-col items-start truncate pr-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Select Customer</span>
                {customer ? (
                  <span className="font-bold text-slate-800 truncate w-full text-left">{customer.name}</span>
                ) : (
                  <span className="font-bold text-slate-800">Loading...</span>
                )}
              </div>
              <ChevronDown className="text-slate-400 shrink-0" size={20} />
            </button>
            {customer && (
              <button
                onClick={(e) => {
                   e.stopPropagation();
                   const customerMeta = {
                     id: selectedCustomerId,
                     name: customer.name,
                     gstNumber: customer.gstNumber || 'NOT_AVAILABLE',
                     status: customer.status || 'active'
                   };
                   sessionStorage.setItem('mobile-stmt-customerId', selectedCustomerId!);
                   sessionStorage.setItem(`mobile-stmt-customerMeta-${selectedCustomerId}`, JSON.stringify(customerMeta));
                   router.push('/mobile/accounts/customer-statement?backTo=/mobile/accounts/customer-dcr-lookup');
                }}
                className="shrink-0 aspect-square bg-white border border-slate-200 rounded-xl shadow-sm text-indigo-600 active:bg-indigo-50 transition-colors flex items-center justify-center"
                title="View Customer Statement"
                aria-label="View Customer Statement"
              >
                <FileText size={20} />
              </button>
            )}
          </div>

          {isError ? (
            <div className="p-4 mx-4 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center justify-center text-center">
              <p className="text-red-600 font-medium mb-3">Unable to load customer DCR information.</p>
              <button 
                onClick={() => fetchSummary(selectedCustomerId)}
                className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-lg text-sm"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300 px-4">
              
              {/* COMPACT HEADER */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#1A2766]" />
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    {isFetchingSummary && !customer ? (
                      <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-2" />
                    ) : (
                      <h2 className="text-[15px] font-bold text-slate-900 leading-tight mb-1 pr-2">{customer?.name}</h2>
                    )}
                    {isFetchingSummary && !customer ? (
                      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">{customer?.gstNumber || 'NO GST'}</span>
                    )}
                  </div>
                  <div className="text-right shrink-0 pl-2 border-l border-slate-100">
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Outstanding</div>
                    <div className="text-lg font-bold text-red-600 leading-tight">
                      {isFetchingSummary ? (
                        <span className="text-slate-300 text-sm animate-pulse">Loading...</span>
                      ) : balance !== null ? (
                        formatCurrency(balance)
                      ) : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI SECTION */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'DCR PANELS', value: dynamicTotals.dcrPanels, color: 'blue' },
                  { label: 'SERIAL PENDING', value: dynamicTotals.serialEntryPending, color: 'orange' },
                  { label: 'VENDOR PENDING', value: dynamicTotals.vendorDcrPending, color: 'yellow' },
                  { label: 'ON HOLD', value: dynamicTotals.onHold, color: 'red' },
                  { label: 'READY TO ISSUE', value: dynamicTotals.readyToIssue, color: 'teal' },
                  { label: 'ISSUED', value: dynamicTotals.issued, color: 'green' },
                ].map((kpi, idx) => (
                  <div key={idx} className={`bg-${kpi.color}-50/50 border border-${kpi.color}-100 p-3 rounded-xl shadow-sm flex flex-col justify-between`}>
                    <div className={`text-[10px] uppercase font-bold text-${kpi.color}-700 tracking-wider mb-1`}>{kpi.label}</div>
                    {isFetchingSummary ? (
                      <div className="h-6 w-8 bg-slate-200 rounded animate-pulse mt-1" />
                    ) : (
                      <div className={`text-xl font-extrabold text-${kpi.color}-950`}>{kpi.value}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* TABS & FILTERS */}
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    onClick={() => { setFilterMode('PENDING'); setExpandedInvoiceId(null); }}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                      filterMode === 'PENDING' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Pending DCR
                  </button>
                  <button
                    onClick={() => { setFilterMode('ALL'); setExpandedInvoiceId(null); }}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                      filterMode === 'ALL' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    All Invoices
                  </button>
                </div>
                
                <button 
                  onClick={() => setIsStatusSheetOpen(true)}
                  className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 shadow-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Status:</span>
                    <span>{STATUS_OPTIONS.find(o => o.value === statusFilter)?.label || 'All'}</span>
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
              </div>

              {/* INVOICE LIST */}
              <div className="flex flex-col gap-3 pb-8">
                {isFetchingSummary ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2" />
                      <div className="h-3 w-24 bg-slate-100 rounded animate-pulse mb-4" />
                      <div className="h-6 w-full bg-slate-50 rounded animate-pulse" />
                    </div>
                  ))
                ) : filteredInvoices.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
                    No invoices match the selected filters.
                  </div>
                ) : (
                  filteredInvoices.map((inv: any) => (
                    <div key={inv.id} className="bg-white border border-slate-200 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                      <div 
                        className="p-4 border-b border-slate-100 flex justify-between items-start active:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => toggleInvoiceExpanded(inv.id)}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1A2766]">{inv.invoiceNumber}</span>
                            <ChevronDown 
                              size={16} 
                              className={`text-[#1A2766] transition-transform duration-200 ${expandedInvoiceId === inv.id ? 'rotate-180' : ''}`} 
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })} · {inv.salesperson}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800 text-sm">{formatCurrency(inv.invoiceTotal)}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50/50">
                        <div className="mb-3">
                          {getWorkflowBadge(inv)}
                        </div>
                        {inv.dcrPanels > 0 && (
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-100/50">
                              <span className="text-slate-500">DCR Panels</span>
                              <span className="font-bold text-slate-700">{inv.dcrPanels}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-100/50">
                              <span className="text-slate-500">Serial Pending</span>
                              <span className={`font-bold ${inv.serialEntryPending > 0 ? 'text-orange-600' : 'text-slate-700'}`}>{inv.serialEntryPending}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-100/50">
                              <span className="text-slate-500">Vendor Pending</span>
                              <span className={`font-bold ${inv.vendorDcrPending > 0 ? 'text-orange-600' : 'text-slate-700'}`}>{inv.vendorDcrPending}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-100/50">
                              <span className="text-slate-500">On Hold</span>
                              <span className={`font-bold ${inv.onHold > 0 ? 'text-red-600' : 'text-slate-700'}`}>{inv.onHold}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-slate-500">Ready to Issue</span>
                              <span className={`font-bold ${inv.readyToIssue > 0 ? 'text-teal-600' : 'text-slate-700'}`}>{inv.readyToIssue}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-slate-500">Issued</span>
                              <span className={`font-bold ${inv.issued > 0 ? 'text-green-600' : 'text-slate-700'}`}>{inv.issued}</span>
                            </div>
                          </div>
                        )}
                      </div>

                        {/* EXPANDED SOLAR ITEMS SECTION */}
                        {expandedInvoiceId === inv.id && (
                          <div className="border-t border-slate-200 bg-white p-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">Invoice Solar Items</h4>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{inv.dcrPanels} Total</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mb-4 text-[10px] font-medium">
                              <div className="flex justify-between bg-orange-50/50 p-1.5 rounded border border-orange-100/50">
                                <span className="text-slate-500">Serial Pending</span>
                                <span className="font-bold text-orange-700">{inv.serialEntryPending}</span>
                              </div>
                              <div className="flex justify-between bg-yellow-50/50 p-1.5 rounded border border-yellow-100/50">
                                <span className="text-slate-500">Vendor Pending</span>
                                <span className="font-bold text-yellow-700">{inv.vendorDcrPending}</span>
                              </div>
                              <div className="flex justify-between bg-red-50/50 p-1.5 rounded border border-red-100/50">
                                <span className="text-slate-500">On Hold</span>
                                <span className="font-bold text-red-700">{inv.onHold}</span>
                              </div>
                              <div className="flex justify-between bg-teal-50/50 p-1.5 rounded border border-teal-100/50">
                                <span className="text-slate-500">Ready to Issue</span>
                                <span className="font-bold text-teal-700">{inv.readyToIssue}</span>
                              </div>
                              <div className="flex justify-between bg-green-50/50 p-1.5 rounded col-span-2 border border-green-100/50">
                                <span className="text-slate-500">Issued</span>
                                <span className="font-bold text-green-700">{inv.issued}</span>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Status:</span>
                                <select 
                                  value={inlineFilter}
                                  onChange={(e) => {
                                    const newFilter = e.target.value;
                                    setInlineFilter(newFilter);
                                    fetchInvoiceSerials(inv.id, 1, newFilter);
                                  }}
                                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1A2766]"
                                >
                                  {INLINE_STATUS_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {invoiceSerialData[inv.id]?.status === 'loading' && invoiceSerialData[inv.id]?.page === 1 ? (
                              <div className="flex flex-col gap-2">
                                {[1,2,3].map(i => (
                                  <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                                ))}
                              </div>
                            ) : invoiceSerialData[inv.id]?.status === 'error' ? (
                              <div className="text-center p-4 border border-red-100 bg-red-50 rounded-lg">
                                <p className="text-xs text-red-600 font-bold mb-2">Unable to load invoice solar items.</p>
                                <button 
                                  onClick={() => fetchInvoiceSerials(inv.id, 1, inlineFilter)}
                                  className="text-[11px] bg-white border border-red-200 text-red-700 px-3 py-1.5 rounded shadow-sm font-bold"
                                >
                                  Retry
                                </button>
                              </div>
                            ) : invoiceSerialData[inv.id]?.items?.length === 0 ? (
                              <div className="text-center p-6 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                                No solar items found for this invoice.
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {invoiceSerialData[inv.id]?.items?.map(serial => (
                                  <div key={serial.id} className="border border-slate-200 rounded-lg bg-slate-50 p-2.5 flex flex-col gap-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="font-mono text-[11px] font-bold text-slate-800 break-all leading-tight">{serial.serialNumber}</span>
                                      {getSerialStatusBadge(serial.status)}
                                    </div>
                                    <div className="text-[10px] text-slate-500 leading-tight font-medium">
                                      {serial.computedProduct || serial.skuId || 'Unknown Product'}
                                    </div>
                                    <div className="text-[10px] font-medium mt-1 pt-1.5 border-t border-slate-200/60 flex items-center">
                                      <span className="text-slate-400 mr-1.5">Vendor DCR:</span>
                                      {getVendorDcrBadge(serial.vendorDcrStatus)}
                                    </div>
                                  </div>
                                ))}
                                
                                {invoiceSerialData[inv.id]?.hasMore && (
                                  <button 
                                    onClick={() => fetchInvoiceSerials(inv.id, (invoiceSerialData[inv.id]?.page || 1) + 1, inlineFilter)}
                                    disabled={invoiceSerialData[inv.id]?.status === 'loading'}
                                    className="w-full mt-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#1A2766] active:bg-slate-50 disabled:opacity-50 transition-colors"
                                  >
                                    {invoiceSerialData[inv.id]?.status === 'loading' ? 'Loading...' : 'Load More'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                    </div>
                  ))
                )}
              </div>

              {/* SECONDARY INFO */}
              {!isFetchingSummary && summary && (
                <div className="flex flex-col gap-3 pb-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Customer Activity</h3>
                    <div className="flex justify-between items-center border-b border-slate-100 py-1.5">
                      <span className="text-sm font-medium text-slate-700">Reviewed Invoices</span>
                      <span className="font-bold text-slate-900">{summary.summary?.kpis?.invoicesReviewed || 0}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 py-1.5">
                      <span className="text-sm font-medium text-slate-700">Pending Review</span>
                      <span className="font-bold text-slate-900">{summary.summary?.kpis?.invoicesPendingReview || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-sm font-medium text-slate-700">DCR Invoices</span>
                      <span className="font-bold text-slate-900">{summary.dcrRequiredInvoices?.length || 0}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}

      {/* SEARCH BOTTOM SHEET */}
      {isSearchSheetOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 animate-in fade-in">
          <div className="absolute inset-0" onClick={() => setIsSearchSheetOpen(false)} />
          <div className="bg-white w-full max-h-[85vh] rounded-t-2xl shadow-xl flex flex-col relative animate-in slide-in-from-bottom-full duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">Select Customer</h3>
              <button onClick={() => setIsSearchSheetOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 active:scale-95">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search by Name or GST"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1A2766]"
                  value={searchQuery}
                  onChange={onSearchInputChange}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isSearching ? (
                <div className="p-8 flex justify-center">
                  <RefreshCw size={24} className="animate-spin text-slate-400" />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map(cust => (
                  <button 
                    key={cust.id} 
                    onClick={() => selectCustomer(cust)}
                    className="w-full text-left p-3 flex flex-col gap-1 border-b border-slate-100 last:border-0 active:bg-slate-50 transition-colors rounded-lg"
                  >
                    <span className="font-bold text-slate-800 text-[15px]">{cust.name}</span>
                    <span className="text-xs font-medium text-slate-500">{cust.gstNumber || 'NO GST'}</span>
                  </button>
                ))
              ) : searchQuery.length > 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No customers found.
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Start typing to search...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STATUS FILTER BOTTOM SHEET */}
      {isStatusSheetOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 animate-in fade-in">
          <div className="absolute inset-0" onClick={() => setIsStatusSheetOpen(false)} />
          <div className="bg-white w-full rounded-t-2xl shadow-xl flex flex-col relative animate-in slide-in-from-bottom-full duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">Filter Status</h3>
              <button onClick={() => setIsStatusSheetOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 active:scale-95">
                <X size={20} />
              </button>
            </div>
            <div className="p-2 pb-[env(safe-area-inset-bottom)]">
              {STATUS_OPTIONS.map(opt => (
                <button 
                  key={opt.value}
                  onClick={() => {
                    setStatusFilter(opt.value);
                    setIsStatusSheetOpen(false);
                  }}
                  className={`w-full text-left p-4 rounded-lg font-bold text-[15px] mb-1 ${statusFilter === opt.value ? 'bg-[#1A2766] text-white' : 'text-slate-700 active:bg-slate-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

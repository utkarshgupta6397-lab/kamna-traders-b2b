'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, ChevronDown, ChevronUp, ExternalLink, Copy, AlertCircle, RefreshCw, X, Activity, ChevronRight } from 'lucide-react';

const ZOHO_ORG_ID = process.env.NEXT_PUBLIC_ZOHO_ORG_ID || '';

export default function CustomerLookupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Data States
  const [customer, setCustomer] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  
  // Loaders
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);

  
  // Statement
  const [showStatement, setShowStatement] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [isFetchingStatement, setIsFetchingStatement] = useState(false);
  
  // Invoice Modal
  const [modalInvoiceId, setModalInvoiceId] = useState<string | null>(null);
  const [modalInvoiceDetails, setModalInvoiceDetails] = useState<any[] | null>(null);
  const [isFetchingInvoiceDetails, setIsFetchingInvoiceDetails] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showNonDcrSection, setShowNonDcrSection] = useState(false);
  
  // Zoho API Meter
  const [zohoMeter, setZohoMeter] = useState<{ today: number, page: number }>({ today: 0, page: 0 });

  // Pagination and Filters
  const [page, setPage] = useState(1);
  const [filterMode, setFilterMode] = useState<'ALL' | 'PENDING'>('ALL');
  const limit = 25;

  const getSessionCache = (key: string) => {
    try {
      const data = sessionStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return null;
  };
  
  const setSessionCache = (key: string, data: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  };

  const incrementPageApiMeter = () => {
    setZohoMeter(prev => ({ ...prev, page: prev.page + 1 }));
  };

  const fetchApiMeter = async () => {
    try {
      const res = await fetch('/api/admin/debug/zoho-api-usage');
      if (res.ok) {
        const data = await res.json();
        setZohoMeter(prev => ({ ...prev, today: data.data.today }));
      }
    } catch (e) {}
  };



  const fetchSummary = async (customerId: string) => {
    setIsFetchingSummary(true);
    try {
      const cachedSummary = getSessionCache(`dcr_summary_${customerId}`);
      if (cachedSummary) {
        setSummary(cachedSummary);
        setIsFetchingSummary(false);
        return;
      }
      
      const res = await fetch(`/api/admin/dcr/customer/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.data);
        if (data.data.kpis?.closingBalance !== undefined) {
          setBalance(data.data.kpis.closingBalance);
          setSessionCache(`dcr_balance_${customerId}`, data.data.kpis.closingBalance);
        }
        setSessionCache(`dcr_summary_${customerId}`, data.data);
      }
    } catch (err) {
      toast.error('Failed to fetch summary');
    } finally {
      setIsFetchingSummary(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.trim() === '') return;
    
    setIsSearching(true);
    setCustomer(null);
    setSummary(null);
    setBalance(null);
    setShowStatement(false);
    setStatementData(null);
    setPage(1);
    setFilterMode('ALL');

    try {
      const res = await fetch(`/api/admin/dcr/customer-lookup/search?q=${encodeURIComponent(query)}`);
      incrementPageApiMeter();
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to find customer');

      setCustomer(data.customer);
      setSessionCache(`dcr_customer_${data.customer.id}`, data.customer);
      
      fetchSummary(data.customer.id);
      
      const cachedBal = getSessionCache(`dcr_balance_${data.customer.id}`);
      if (cachedBal !== null) {
        setBalance(cachedBal);
      }

      fetchApiMeter();

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const cid = searchParams.get('customerId');
    if (cid) {
      setSearchQuery(cid);
      const cachedCustomer = getSessionCache(`dcr_customer_${cid}`);
      if (cachedCustomer && cachedCustomer.id === cid) {
        setCustomer(cachedCustomer);
        fetchSummary(cid);
        const cachedBal = getSessionCache(`dcr_balance_${cid}`);
        if (cachedBal !== null) setBalance(cachedBal);
        fetchApiMeter();
      } else {
        handleSearch(cid);
      }
    } else {
      fetchApiMeter();
    }
  }, [searchParams, handleSearch]);

  const loadStatement = async () => {
    if (!customer) return;
    const cached = getSessionCache(`dcr_statement_${customer.id}`);
    if (cached) {
      setStatementData(cached);
      return;
    }
    setIsFetchingStatement(true);
    try {
      const res = await fetch(`/api/admin/customer-statement/quick?customerId=${customer.id}`);
      incrementPageApiMeter();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setStatementData(data.data);
      setSessionCache(`dcr_statement_${customer.id}`, data.data);
      fetchApiMeter();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch statement');
    } finally {
      setIsFetchingStatement(false);
    }
  };

  const toggleStatement = () => {
    const willShow = !showStatement;
    setShowStatement(willShow);
    if (willShow && !statementData) {
      loadStatement();
    }
  };

  const closeModal = () => {
    setModalInvoiceId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalInvoiceId) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalInvoiceId]);

  const openInvoiceModal = async (invoiceId: string) => {
    setModalInvoiceId(invoiceId);
    setModalInvoiceDetails(null);
    setExpandedItems(new Set());
    setShowNonDcrSection(false);
    setIsFetchingInvoiceDetails(true);

    const cached = getSessionCache(`dcr_invoice_${invoiceId}_v2`);
    if (cached) {
      setModalInvoiceDetails(cached);
      const dcrItemIds = new Set<string>();
      cached.forEach((item: any) => {
        if (item.selectedForDCR) dcrItemIds.add(item.itemId);
      });
      setExpandedItems(dcrItemIds);
      setShowNonDcrSection(true);
      setIsFetchingInvoiceDetails(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/dcr/customer/${customer.id}/invoice/${invoiceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setModalInvoiceDetails(data.data);
      const dcrItemIds = new Set<string>();
      data.data.forEach((item: any) => {
        if (item.selectedForDCR) dcrItemIds.add(item.itemId);
      });
      setExpandedItems(dcrItemIds);
      setShowNonDcrSection(true);
      setSessionCache(`dcr_invoice_${invoiceId}_v2`, data.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch invoice details');
      setModalInvoiceId(null);
    } finally {
      setIsFetchingInvoiceDetails(false);
    }
  };

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const copyDcrSummary = () => {
    if (!customer || !summary) return;
    let text = `${customer.name}\n\n`;
    text += `Outstanding:\n${balance !== null ? '₹' + balance.toLocaleString('en-IN') : 'Unknown'}\n\n`;
    text += `Invoices Reviewed:\n${summary.kpis.invoicesReviewed}\n\n`;
    text += `Invoices Pending Review:\n${summary.kpis.invoicesPendingReview}\n\n`;
    text += `Vendor DCR Pending:\n${summary.kpis.vendorDcrPending}\n\n`;
    text += `On Hold:\n${summary.kpis.onHold}\n\n`;
    text += `Issued:\n${summary.kpis.issued}\n\n`;
    text += `Invoice Breakdown\n\n`;
    summary.invoices.forEach((inv: any) => {
      if (inv.dcrPanels > 0 || inv.processingStatus === 'NOT_REVIEWED') {
        text += `${inv.invoiceNumber}\n\n`;
        text += `Panels: ${inv.dcrPanels}\n`;
        text += `Vendor DCR Pending: ${inv.vendorDcrPending}\n`;
        text += `On Hold: ${inv.onHold}\n`;
        text += `Issued: ${inv.issued}\n\n`;
      }
    });
    navigator.clipboard.writeText(text.trim());
    toast.success('DCR Summary Copied');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const isPendingInvoice = (inv: any) => inv.processingStatus === 'UNPROCESSED' || inv.issued !== inv.dcrPanels;
  const filteredInvoices = summary ? (filterMode === 'PENDING' ? summary.invoices.filter(isPendingInvoice) : summary.invoices) : [];
  const displayedInvoices = filteredInvoices.slice(0, page * limit);
  const hasMore = filteredInvoices.length > page * limit;

  const activeInvoice = summary?.invoices.find((i: any) => i.id === modalInvoiceId);

  // Compute footer aggregations from actual item data in the modal
  let modalAggs = { panels: 0, entryPending: 0, vendorPending: 0, hold: 0, ready: 0, issued: 0 };
  
  let dcrItems: any[] = [];
  let nonDcrItems: any[] = [];

  if (modalInvoiceDetails) {
    modalInvoiceDetails.forEach(item => {
      if (item.selectedForDCR) {
        modalAggs.panels += item.metrics.panels;
        modalAggs.entryPending += item.metrics.serialEntryPending;
        modalAggs.vendorPending += item.metrics.vendorDcrPending;
        modalAggs.hold += item.metrics.onHold;
        modalAggs.ready += item.metrics.readyToIssue;
        modalAggs.issued += item.metrics.issued;
        dcrItems.push(item);
      } else {
        nonDcrItems.push(item);
      }
    });
  }

  const getProcessingStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-green-50 text-green-700 border-green-200">COMPLETED</span>;
      case 'NO_DCR_REQUIRED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-gray-100 text-gray-600 border-gray-300">NO DCR REQUIRED</span>;
      case 'DCR_IDENTIFIED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200">DCR IDENTIFIED</span>;
      case 'IN_PROGRESS': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-orange-50 text-orange-700 border-orange-200">IN PROGRESS</span>;
      case 'NOT_REVIEWED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-red-50 text-red-700 border-red-200">NOT REVIEWED</span>;
      default: return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-gray-50 text-gray-700 border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-[1400px] mx-auto w-full text-sm">
      
      {/* SEARCH SECTION */}
      <div className="bg-white p-4 rounded border border-gray-200 flex flex-col sm:flex-row gap-4 items-center shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Enter Customer ID, Name, or GST"
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch(searchQuery)}
          />
        </div>
        <button
          onClick={() => handleSearch(searchQuery)}
          disabled={isSearching}
          className="bg-[#1A2766] text-white px-6 py-2 rounded font-semibold text-sm hover:bg-[#1A2766]/90 disabled:opacity-70 whitespace-nowrap"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {customer && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          
          {/* COMPACT HEADER */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="p-4 flex flex-col md:flex-row justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{customer.name}</h2>
                  <a href={`https://books.zoho.in/app${ZOHO_ORG_ID ? '/' + ZOHO_ORG_ID : ''}#/contacts/${customer.id}`} target="_blank" rel="noreferrer" className="text-[#1A2766] hover:text-blue-700">
                    <ExternalLink size={14} />
                  </a>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>ID: <span className="font-mono text-gray-800">{customer.id}</span></span>
                  <span>GST: <span className="text-gray-800 font-semibold">{customer.gstNumber || 'N/A'}</span></span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Outstanding</div>
                  <div className="text-xl font-bold text-red-600 leading-tight">
                    {isFetchingSummary ? (
                      <span className="text-gray-300 text-sm animate-pulse">Loading...</span>
                    ) : balance !== null ? (
                      formatCurrency(balance)
                    ) : '-'}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={copyDcrSummary} className="flex items-center justify-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    <Copy size={12} /> Copy Summary
                  </button>
                  <a href={`/staff/dashboard/accounts?customerId=${customer.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    <ExternalLink size={12} /> Full Statement
                  </a>
                </div>
                <div className="pl-4 border-l border-gray-100 flex flex-col items-end text-[10px]">
                  <div className="text-gray-400 font-bold uppercase flex items-center gap-1 mb-0.5"><Activity size={10} /> Zoho API</div>
                  <div>Today: <span className="font-bold text-gray-800">{zohoMeter.today}</span></div>
                  <div>Page: <span className="font-bold text-[#1A2766]">{zohoMeter.page}</span></div>
                </div>
              </div>
            </div>

            {/* KPI ROW */}
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex flex-wrap gap-x-8 gap-y-2">
              {isFetchingSummary || !summary ? (
                <div className="text-xs text-gray-400 animate-pulse">Loading summary...</div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Reviewed:</span>
                    <span className="font-bold text-gray-900">{summary.kpis.invoicesReviewed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Pending Review:</span>
                    <span className="font-bold text-gray-900">{summary.kpis.invoicesPendingReview}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">DCR Panels:</span>
                    <span className="font-bold text-gray-900">{summary.kpis.dcrPanels}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Vendor Pending:</span>
                    <span className="font-bold text-orange-600">{summary.kpis.vendorDcrPending}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">On Hold:</span>
                    <span className="font-bold text-red-600">{summary.kpis.onHold}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Ready:</span>
                    <span className="font-bold text-teal-600">{summary.kpis.readyToIssue}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Issued:</span>
                    <span className="font-bold text-green-600">{summary.kpis.issued}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* CUSTOMER STATEMENT */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <button onClick={toggleStatement} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100">
              <span className="font-bold text-gray-800 text-xs flex items-center gap-2">
                {showStatement ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Customer Statement Snapshot
              </span>
            </button>
            {showStatement && (
              <div className="border-t border-gray-200">
                {isFetchingStatement ? (
                  <div className="p-4 flex justify-center"><RefreshCw size={16} className="animate-spin text-gray-400" /></div>
                ) : statementData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-white border-b border-gray-200 text-gray-500">
                        <tr>
                          <th className="px-4 py-2 font-semibold uppercase">Date</th>
                          <th className="px-4 py-2 font-semibold uppercase">Type</th>
                          <th className="px-4 py-2 font-semibold uppercase">Details</th>
                          <th className="px-4 py-2 font-semibold uppercase text-right">Invoice</th>
                          <th className="px-4 py-2 font-semibold uppercase text-right">Payment</th>
                          <th className="px-4 py-2 font-semibold uppercase text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {statementData.transactions.map((tx: any, idx: number) => (
                          <tr key={tx.id || idx} className="hover:bg-gray-50">
                            <td className="px-4 py-1.5 text-gray-600">{new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="px-4 py-1.5">
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${tx.type === 'invoice' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{tx.type}</span>
                            </td>
                            <td className="px-4 py-1.5 font-medium text-gray-800 truncate max-w-[200px]">{tx.description}</td>
                            <td className="px-4 py-1.5 text-right font-medium text-orange-600">{tx.netEffect > 0 ? formatCurrency(tx.netEffect) : '-'}</td>
                            <td className="px-4 py-1.5 text-right font-medium text-green-600">{tx.netEffect < 0 ? formatCurrency(Math.abs(tx.netEffect)) : '-'}</td>
                            <td className={`px-4 py-1.5 text-right font-bold ${tx.balanceAfter > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {tx.balanceAfter !== undefined ? formatCurrency(tx.balanceAfter) : '-'}
                              {tx.balanceAfter > 0 && <span className="text-[9px] ml-1 text-gray-500 font-normal">Dr</span>}
                              {tx.balanceAfter < 0 && <span className="text-[9px] ml-1 text-gray-500 font-normal">Cr</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-red-500">Failed to load statement.</div>
                )}
              </div>
            )}
          </div>

          {/* FILTER TOGGLE */}
          <div className="flex items-center gap-4 py-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="invoiceFilter" value="ALL" checked={filterMode === 'ALL'} onChange={() => { setFilterMode('ALL'); setPage(1); }} className="text-[#1A2766] focus:ring-[#1A2766]" />
              <span className="font-medium text-gray-700">All Invoices</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="invoiceFilter" value="PENDING" checked={filterMode === 'PENDING'} onChange={() => { setFilterMode('PENDING'); setPage(1); }} className="text-[#1A2766] focus:ring-[#1A2766]" />
              <span className="font-medium text-gray-700">Pending Only</span>
            </label>
          </div>

          {/* MAIN INVOICES TABLE */}
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold uppercase">#</th>
                    <th className="px-3 py-2 font-semibold uppercase" style={{ width: '150px', minWidth: '150px' }}>Invoice Number</th>
                    <th className="px-3 py-2 font-semibold uppercase">Invoice Date</th>
                    <th className="px-3 py-2 font-semibold uppercase">Salesperson</th>
                    <th className="px-3 py-2 font-semibold uppercase text-right">Invoice Value</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">Processing Status</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">DCR Panels</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">Serial Entry Pending</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">Vendor DCR Pending</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">On Hold</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">Ready To Issue</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">Issued</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center">Status</th>
                    <th className="px-3 py-2 font-semibold uppercase text-center w-16 sticky right-0 z-20 bg-gray-50 border-l border-gray-200 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isFetchingSummary && !summary ? (
                    <tr><td colSpan={14} className="p-4 text-center text-gray-400">Loading invoices...</td></tr>
                  ) : displayedInvoices.map((inv: any, index: number) => (
                    <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-3 py-2 text-gray-500 align-middle">{index + 1}</td>
                      <td className="px-3 py-2 font-bold text-[#1A2766] align-middle whitespace-nowrap">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-gray-600 align-middle whitespace-nowrap">{new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                      <td className="px-3 py-2 text-gray-600 align-middle whitespace-nowrap">{inv.salesperson}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800 align-middle">{formatCurrency(inv.invoiceTotal)}</td>
                      <td className="px-3 py-2 text-center align-middle whitespace-nowrap">
                        {getProcessingStatusBadge(inv.processingStatus)}
                      </td>
                      <td className="px-3 py-2 text-center font-bold align-middle">{inv.dcrPanels}</td>
                      <td className="px-3 py-2 text-center text-orange-600 font-bold align-middle">{inv.serialEntryPending}</td>
                      <td className="px-3 py-2 text-center text-orange-600 font-bold align-middle">{inv.vendorDcrPending}</td>
                      <td className="px-3 py-2 text-center text-red-600 font-bold align-middle">{inv.onHold}</td>
                      <td className="px-3 py-2 text-center text-teal-600 font-bold align-middle">{inv.readyToIssue}</td>
                      <td className="px-3 py-2 text-center text-green-600 font-bold align-middle">{inv.issued}</td>
                      <td className="px-3 py-2 text-center align-middle whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                          inv.displayStatus === 'FULLY ISSUED' ? 'bg-green-50 text-green-600 border-green-200' :
                          inv.displayStatus === 'PROCESSED - NO DCR REQUIRED' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                          inv.displayStatus === 'UNPROCESSED' ? 'bg-red-50 text-red-600 border-red-200' :
                          'bg-orange-50 text-orange-600 border-orange-200'
                        }`}>
                          {inv.displayStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center align-middle sticky right-0 z-10 bg-white group-hover:bg-[#f0f4fa] transition-colors border-l border-gray-100 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                        <button onClick={() => openInvoiceModal(inv.id)} className="text-[#1A2766] bg-blue-50 px-2 py-1 rounded text-xs font-semibold hover:bg-blue-100 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">View</button>
                      </td>
                    </tr>
                  ))}
                  {!isFetchingSummary && summary && displayedInvoices.length === 0 && (
                    <tr><td colSpan={14} className="text-center py-6 text-gray-500 italic bg-gray-50">No invoices found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                <button onClick={() => setPage(p => p + 1)} className="text-xs font-semibold text-[#1A2766] hover:underline">Load More</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL */}
      {modalInvoiceId && activeInvoice && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] flex flex-col border border-gray-300 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="absolute top-4 right-4 z-20">
              <button onClick={closeModal} className="p-1.5 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors shadow-sm border border-gray-200">
                <X size={18} />
              </button>
            </div>

            {/* SECTION 1 - INVOICE HEADER (Sticky) */}
            <div className="p-5 bg-white border-b border-gray-200 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.05)] flex items-center justify-between z-10 shrink-0 sticky top-0">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 pr-10">
                  <h3 className="text-xl font-bold text-[#1A2766]">{activeInvoice.invoiceNumber}</h3>
                  {getProcessingStatusBadge(activeInvoice.processingStatus)}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                  <span>Date: {new Date(activeInvoice.invoiceDate).toLocaleDateString()}</span>
                  <span>Customer: {customer?.name}</span>
                  <span>Value: <span className="font-bold text-gray-800">{formatCurrency(activeInvoice.invoiceTotal)}</span></span>
                  <span>Salesperson: {activeInvoice.salesperson}</span>
                </div>
              </div>
            </div>

            {/* SECTION 2 - INVOICE ITEMS */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {isFetchingInvoiceDetails ? (
                <div className="flex items-center justify-center h-full text-gray-400 gap-2">
                  <RefreshCw size={18} className="animate-spin" /> Loading invoice items...
                </div>
              ) : modalInvoiceDetails && modalInvoiceDetails.length > 0 ? (
                <div className="p-6 flex flex-col gap-6">
                  
                  {/* DCR ELIGIBLE ITEMS TABLE */}
                  <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex-shrink-0">
                    <div className="px-4 py-2 bg-blue-50/50 border-b border-gray-200 flex items-center">
                      <h4 className="font-bold text-[#1A2766] text-sm uppercase tracking-wider flex items-center gap-2">
                        DCR Eligible Items <span className="bg-[#1A2766] text-white px-2 py-0.5 rounded-full text-[10px]">{dcrItems.length}</span>
                      </h4>
                    </div>
                    {dcrItems.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs bg-white">
                          <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm">
                            <tr>
                              <th className="px-4 py-2 font-semibold">Item</th>
                              <th className="px-4 py-2 font-semibold">SKU</th>
                              <th className="px-4 py-2 font-semibold">Vendor</th>
                              <th className="px-4 py-2 font-semibold text-center">Qty</th>
                              <th className="px-4 py-2 font-semibold text-center">DCR Eligible</th>
                              <th className="px-4 py-2 font-semibold text-center">DCR Panels</th>
                              <th className="px-4 py-2 font-semibold text-center">Entry Pending</th>
                              <th className="px-4 py-2 font-semibold text-center">Vendor DCR Pending</th>
                              <th className="px-4 py-2 font-semibold text-center">On Hold</th>
                              <th className="px-4 py-2 font-semibold text-center">Ready</th>
                              <th className="px-4 py-2 font-semibold text-center">Issued</th>
                              <th className="px-4 py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {dcrItems.map((item: any) => {
                              const isExpanded = expandedItems.has(item.itemId);
                              const canExpand = item.serials && item.serials.length > 0;
                              
                              return (
                                <React.Fragment key={item.itemId}>
                                  <tr className="hover:bg-blue-50/20 transition-colors">
                                    <td className="px-4 py-2 font-medium text-gray-800">
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={() => toggleItemExpansion(item.itemId)}
                                          disabled={!canExpand}
                                          className={`p-0.5 rounded ${canExpand ? 'text-[#1A2766] hover:bg-blue-100' : 'text-gray-300 cursor-default'}`}
                                        >
                                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <span className="truncate max-w-[200px]" title={item.itemName}>{item.itemName}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs">{item.sku || '-'}</td>
                                    <td className="px-4 py-2 font-medium">{item.vendor}</td>
                                    <td className="px-4 py-2 text-center font-bold text-gray-700">{item.quantity}</td>
                                    <td className="px-4 py-2 text-center">
                                      <span className="text-green-600 font-bold">Yes</span>
                                    </td>
                                    <td className="px-4 py-2 text-center font-bold text-gray-800">{item.metrics.panels}</td>
                                    <td className="px-4 py-2 text-center font-bold text-orange-600">{item.metrics.serialEntryPending}</td>
                                    <td className="px-4 py-2 text-center font-bold text-orange-600">{item.metrics.vendorDcrPending}</td>
                                    <td className="px-4 py-2 text-center font-bold text-red-600">{item.metrics.onHold}</td>
                                    <td className="px-4 py-2 text-center font-bold text-teal-600">{item.metrics.readyToIssue}</td>
                                    <td className="px-4 py-2 text-center font-bold text-green-600">{item.metrics.issued}</td>
                                    <td className="px-4 py-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                        item.metrics.serialEntryPending > 0 ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                        item.metrics.panels === item.metrics.issued ? 'bg-green-50 text-green-700 border-green-200' :
                                        'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}>
                                        {item.itemStatus}
                                      </span>
                                    </td>
                                  </tr>
                                  
                                  {isExpanded && canExpand && (
                                    <tr className="bg-gray-50">
                                      <td colSpan={12} className="p-0 border-b border-gray-200">
                                        <div className="pl-12 pr-4 py-3 bg-blue-50/30 border-l-4 border-[#1A2766]">
                                          <table className="w-full text-left text-xs bg-white border border-gray-200 rounded shadow-sm">
                                            <thead className="bg-gray-100 text-gray-600">
                                              <tr>
                                                <th className="px-3 py-1.5 font-semibold">Serial</th>
                                                <th className="px-3 py-1.5 font-semibold">Vendor</th>
                                                <th className="px-3 py-1.5 font-semibold">Workflow Status</th>
                                                <th className="px-3 py-1.5 font-semibold">Vendor DCR Status</th>
                                                <th className="px-3 py-1.5 font-semibold">Allocation Date</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                              {item.serials.map((s: any) => (
                                                <tr key={s.id} className="hover:bg-gray-50">
                                                  <td className="px-3 py-1.5 font-mono font-medium text-gray-800">{s.serialNumber}</td>
                                                  <td className="px-3 py-1.5 text-gray-600">{s.vendorName || item.vendor}</td>
                                                  <td className="px-3 py-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${s.status === 'ISSUED' ? 'bg-green-50 text-green-700 border-green-200' : s.status === 'HOLD' ? 'bg-red-50 text-red-700 border-red-200' : s.status === 'READY_TO_ISSUE' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{s.status}</span>
                                                  </td>
                                                  <td className="px-3 py-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${s.vendorDcrStatus === 'RECEIVED' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{s.vendorDcrStatus}</span>
                                                  </td>
                                                  <td className="px-3 py-1.5 text-gray-400">{new Date(s.allocatedAt).toLocaleDateString()}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-500 italic">No DCR eligible items found in this invoice.</div>
                    )}
                  </div>

                  {/* NON DCR ITEMS TABLE */}
                  {nonDcrItems.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex-shrink-0">
                      <div 
                        className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setShowNonDcrSection(!showNonDcrSection)}
                      >
                        <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider flex items-center gap-2">
                          <span className="text-gray-400">
                            {showNonDcrSection ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                          Non-DCR Items <span className="bg-gray-300 text-gray-700 px-2 py-0.5 rounded-full text-[10px]">{nonDcrItems.length}</span>
                        </h4>
                      </div>
                      
                      {showNonDcrSection && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs bg-white">
                            <thead className="bg-gray-100 text-gray-600 shadow-sm">
                              <tr>
                                <th className="px-4 py-2 font-semibold">Item</th>
                                <th className="px-4 py-2 font-semibold">SKU</th>
                                <th className="px-4 py-2 font-semibold">Vendor</th>
                                <th className="px-4 py-2 font-semibold text-center">Qty</th>
                                <th className="px-4 py-2 font-semibold text-center">DCR Eligible</th>
                                <th className="px-4 py-2 font-semibold text-center text-gray-400">DCR Panels</th>
                                <th className="px-4 py-2 font-semibold text-center text-gray-400">Entry Pending</th>
                                <th className="px-4 py-2 font-semibold text-center text-gray-400">Vendor DCR Pending</th>
                                <th className="px-4 py-2 font-semibold text-center text-gray-400">On Hold</th>
                                <th className="px-4 py-2 font-semibold text-center text-gray-400">Ready</th>
                                <th className="px-4 py-2 font-semibold text-center text-gray-400">Issued</th>
                                <th className="px-4 py-2 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {nonDcrItems.map((item: any) => (
                                <tr key={item.itemId} className="bg-gray-50/30 text-gray-600">
                                  <td className="px-4 py-2 font-medium">
                                    <div className="flex items-center gap-2 pl-[22px]">
                                      <span className="truncate max-w-[200px]" title={item.itemName}>{item.itemName}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs">{item.sku || '-'}</td>
                                  <td className="px-4 py-2 font-medium">{item.vendor}</td>
                                  <td className="px-4 py-2 text-center font-bold">{item.quantity}</td>
                                  <td className="px-4 py-2 text-center">
                                    <span className="text-gray-400">No</span>
                                  </td>
                                  <td className="px-4 py-2 text-center text-gray-400">-</td>
                                  <td className="px-4 py-2 text-center text-gray-400">-</td>
                                  <td className="px-4 py-2 text-center text-gray-400">-</td>
                                  <td className="px-4 py-2 text-center text-gray-400">-</td>
                                  <td className="px-4 py-2 text-center text-gray-400">-</td>
                                  <td className="px-4 py-2 text-center text-gray-400">-</td>
                                  <td className="px-4 py-2">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-gray-100 text-gray-500 border-gray-200">
                                      Non-DCR
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 bg-white">
                  <div className="text-center max-w-sm">
                    <AlertCircle className="mx-auto mb-2 text-gray-400" size={32} />
                    <p className="font-medium text-gray-700">Invoice Not Reviewed</p>
                    <p className="text-xs text-gray-500 mt-1">This invoice has not yet been reviewed for DCR eligibility. Process it through the Process Invoices workflow to allocate serial numbers.</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* SECTION 5 - FOOTER SUMMARY */}
            <div className="bg-[#1A2766] text-white border-t border-gray-200 px-6 py-2 shrink-0 flex flex-wrap items-center justify-center gap-x-8 gap-y-1 h-[48px]">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase font-semibold text-blue-200 tracking-wider">DCR Panels:</span>
                 <span className="text-sm font-bold">{modalAggs.panels}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase font-semibold text-blue-200 tracking-wider">Entry Pending:</span>
                 <span className="text-sm font-bold text-orange-300">{modalAggs.entryPending}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase font-semibold text-blue-200 tracking-wider">Vendor Pending:</span>
                 <span className="text-sm font-bold text-orange-300">{modalAggs.vendorPending}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase font-semibold text-blue-200 tracking-wider">Hold:</span>
                 <span className="text-sm font-bold text-red-300">{modalAggs.hold}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase font-semibold text-blue-200 tracking-wider">Ready:</span>
                 <span className="text-sm font-bold text-teal-300">{modalAggs.ready}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase font-semibold text-blue-200 tracking-wider">Issued:</span>
                 <span className="text-sm font-bold text-green-300">{modalAggs.issued}</span>
               </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

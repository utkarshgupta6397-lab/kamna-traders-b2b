'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, Phone, FileText, Download, Check, X, Building2, Calendar, FileBox, Banknote, CreditCard, Filter, ChevronUp, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Utility: extractSolarPanelWattage
 * Fallback extraction for Solar Panel wattage since the raw Zoho Books invoice line items API
 * genuinely does not contain the internal Prisma category or wattage attributes.
 */
function extractSolarPanelWattage(productName: string): number | null {
  if (!productName) return null;
  const name = productName.toLowerCase();
  const isSolarPanel = (name.includes('solar') || name.includes('panel') || name.includes('bifacial') || name.includes('dcr')) && 
                       !name.includes('structure') && 
                       !name.includes('wire') && 
                       !name.includes('cable') && 
                       !name.includes('inverter');
  if (!isSolarPanel) return null;
  const match = name.match(/(\d+)\s*(?:w|wp|watt)/i);
  if (match && match[1]) return parseInt(match[1], 10);
  return null;
}
import { renderStatementToPdf, cleanDescription } from '@/lib/zoho/pdf-statement-renderer';

interface Customer {
  id: string;
  name: string;
  gstNumber: string;
  mobile?: string;
  status: string;
}

export default function MobileCustomerStatementClient({ userName }: { userName: string }) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Statement state
  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState<any>(null);
  
  // Get local date string YYYY-MM-DD
  const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Pagination & Filtering
  const [visibleCount, setVisibleCount] = useState(15);
  const [filterType, setFilterType] = useState<string>('all');
  const [textSearch, setTextSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(getLocalDateString(firstDayOfMonth));
  const [dateTo, setDateTo] = useState(getLocalDateString(today));
  const [quickRange, setQuickRange] = useState<string>('This Month');
  
  // Expand state
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [txLineItems, setTxLineItems] = useState<Record<string, any>>({});
  const [loadingTxId, setLoadingTxId] = useState<string | null>(null);

  // PDF
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const searchCache = useMemo(() => new Map<string, Customer[]>(), []);

  // Restore session
  useEffect(() => {
    const savedId = sessionStorage.getItem('mobile-stmt-customerId');
    const savedMetaStr = sessionStorage.getItem(`mobile-stmt-customerMeta-${savedId}`);
    
    if (savedId && savedMetaStr) {
      try {
        const meta = JSON.parse(savedMetaStr);
        setSelectedCustomer(meta);
        fetchStatement(savedId, meta, false);
      } catch (e) {}
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      if (q.length >= 3) {
        const normalized = q.toLowerCase();
        if (searchCache.has(normalized)) {
          setSuggestions(searchCache.get(normalized) || []);
          setShowSuggestions(true);
          return;
        }

        setIsSearching(true);
        try {
          const res = await fetch(`/api/admin/customer-statement/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              const activeCustomers = data.customers.filter((c: Customer) => c.status && c.status.toLowerCase() === 'active');
              searchCache.set(normalized, activeCustomers);
              setSuggestions(activeCustomers);
              setShowSuggestions(true);
            }
          }
        } catch (e) {
          console.error('Search failed', e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCache]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowSuggestions(false);
    setSearchQuery('');
    
    sessionStorage.setItem('mobile-stmt-customerId', customer.id);
    sessionStorage.setItem(`mobile-stmt-customerMeta-${customer.id}`, JSON.stringify(customer));
    
    fetchStatement(customer.id, customer, true);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setStatement(null);
    sessionStorage.removeItem('mobile-stmt-customerId');
  };

  const fetchStatement = async (id: string, meta: Customer, forceFresh: boolean) => {
    setLoading(true);
    setStatement(null);
    setExpandedTxId(null);
    setVisibleCount(15);
    setFilterType('all');
    setTextSearch('');
    setDateFrom(getLocalDateString(firstDayOfMonth));
    setDateTo(getLocalDateString(today));
    setQuickRange('This Month');
    
    // Check mobile-specific cache
    const mobileCacheKey = `mobile-customer-statement-${id}`;
    if (!forceFresh) {
      const cached = sessionStorage.getItem(mobileCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.data) {
            setStatement({ success: true, data: parsed.data });
            setLoading(false);
            return;
          }
        } catch (e) {}
      }
    }
    
    try {
      const res = await fetch(`/api/admin/customer-statement/statement?customerId=${id}`);
      const data = await res.json();
      
      if (data.success) {
        setStatement(data);
        sessionStorage.setItem(mobileCacheKey, JSON.stringify({ data: data.data, cachedAt: Date.now() }));
      } else {
        toast.error(data.error || 'Failed to fetch statement');
      }
    } catch (e) {
      toast.error('Network error fetching statement');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (n: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Math.abs(n));
  };

  const handleQuickRangeChange = (range: string) => {
    const t = new Date();
    let fDate = new Date();
    let tDate = new Date();

    switch (range) {
      case 'This Month':
        fDate = new Date(t.getFullYear(), t.getMonth(), 1);
        tDate = t;
        break;
      case 'Last Month':
        fDate = new Date(t.getFullYear(), t.getMonth() - 1, 1);
        tDate = new Date(t.getFullYear(), t.getMonth(), 0);
        break;
      case 'Last 3 Months':
        fDate = new Date(t.getFullYear(), t.getMonth() - 3, 1);
        tDate = t;
        break;
      case 'Last 6 Months':
        fDate = new Date(t.getFullYear(), t.getMonth() - 6, 1);
        tDate = t;
        break;
      case 'This Financial Year':
        const fm = t.getMonth(); // 0-11
        const fyStartYear = fm >= 3 ? t.getFullYear() : t.getFullYear() - 1;
        fDate = new Date(fyStartYear, 3, 1); // April 1st
        tDate = t;
        break;
      default:
        break;
    }

    setQuickRange(range);
    if (range !== 'Custom') {
      setDateFrom(getLocalDateString(fDate));
      setDateTo(getLocalDateString(tDate));
      setVisibleCount(15);
    }
  };

  const { dateFilteredTransactions, filteredTransactions } = useMemo(() => {
    if (!statement?.data?.transactions) return { dateFilteredTransactions: [], filteredTransactions: [] };
    let txs = statement.data.transactions;
    
    // 1. Apply Date Filter (Chronological Window)
    let dateFilteredTxs = txs;
    if (dateFrom || dateTo) {
      const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
      // Add 24h to dateTo to include the end date fully
      const toTime = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
      dateFilteredTxs = txs.filter((t: any) => {
        const dTime = new Date(t.date || t.datetime || 0).getTime();
        return dTime >= fromTime && dTime < toTime;
      });
    }
    
    // 2. Apply Type & Text Filters
    let finalTxs = dateFilteredTxs;
    if (filterType !== 'all') {
      finalTxs = finalTxs.filter((t: any) => t.type === filterType);
    }
    if (textSearch.trim()) {
      const q = textSearch.toLowerCase();
      finalTxs = finalTxs.filter((t: any) => 
        (t.description || '').toLowerCase().includes(q) ||
        (t.referenceNumber || '').toLowerCase().includes(q)
      );
    }
    
    // Sort finalTxs by timestamp descending (newest first)
    finalTxs = [...finalTxs].sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
    // Also sort dateFilteredTransactions so KPIs and PDF run in correct order, though PDF might want chronological, wait PDF usually shows oldest to newest?
    // Instruction: "The Customer Statement transaction list must ALWAYS be displayed in descending chronological order."
    // Let's sort finalTxs descending for display, but leave dateFilteredTxs chronological for Opening Balance and PDF, OR wait, if dateFilteredTxs is chronological, it's correct for OpeningBalance.
    
    return { dateFilteredTransactions: dateFilteredTxs, filteredTransactions: finalTxs };
  }, [statement, filterType, textSearch, dateFrom, dateTo]);

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = visibleTransactions.length < filteredTransactions.length;

  // KPI Calculations
  const dynamicOpeningBalance = dateFilteredTransactions.length > 0
    ? (dateFilteredTransactions[0].balanceAfter - dateFilteredTransactions[0].netEffect)
    : (statement?.data?.closingBalance || 0);

  const dynamicClosingBalance = dynamicOpeningBalance + dateFilteredTransactions.reduce((sum: number, t: any) => sum + t.netEffect, 0);

  const totalDebitAmount = dateFilteredTransactions
    .filter((t: any) => t.type === 'invoice' || t.type === 'vendor_payment' || (t.type === 'journal' && t.netEffect > 0))
    .reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0);

  const totalCreditAmount = dateFilteredTransactions
    .filter((t: any) => t.type === 'payment' || t.type === 'bill' || (t.type === 'journal' && t.netEffect <= 0))
    .reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0);

  const toggleExpand = async (tx: any) => {
    if (expandedTxId === tx.id) {
      setExpandedTxId(null);
      return;
    }
    
    setExpandedTxId(tx.id);
    
    // Only fetch for invoice or bill types
    if (tx.type !== 'invoice' && tx.type !== 'bill') return;
    
    // Use cached if available
    if (txLineItems[tx.id]) return;
    
    setLoadingTxId(tx.id);
    try {
      const endpoint = tx.type === 'invoice' ? 'invoice' : 'bill';
      const res = await fetch(`/api/admin/customer-statement/${endpoint}/${tx.id}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        setTxLineItems(prev => ({ ...prev, [tx.id]: data.data }));
      }
    } catch (e) {
      toast.error('Failed to load transaction details');
    } finally {
      setLoadingTxId(null);
    }
  };

  const handleDownloadPDF = async () => {
    if (!statement?.data) return;
    setPdfGenerating(true);
    const tId = toast.loading('Generating PDF...');
    
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      // Clone statement and replace transactions with the date filtered transactions
      const pdfStatementData = {
        ...statement.data,
        transactions: dateFilteredTransactions,
        openingBalance: dynamicOpeningBalance,
        closingBalance: dynamicClosingBalance,
      };
      
      await renderStatementToPdf(doc, autoTable, pdfStatementData, {
        isExpanded: false,
        clipFromIndex: null,
        firmColors: {},
        generatedBy: userName
      });
      
      let safeName = statement.data.customer.contactName || 'CUSTOMER';
      safeName = safeName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const dateStr = new Date().toISOString().slice(0, 10);
      
      doc.save(`${safeName}_STATEMENT_${dateStr}.pdf`);
      toast.success('Downloaded successfully', { id: tId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF', { id: tId });
    } finally {
      setPdfGenerating(false);
    }
  };

  const renderInvoiceSummary = (tx: any) => {
    const txId = tx.id;
    const details = txLineItems[txId];
    if (loadingTxId === txId) {
      return <div className="p-4 text-center text-xs text-slate-500 animate-pulse">Loading details...</div>;
    }
    if (!details) {
      return <div className="p-4 text-center text-xs text-slate-500">Details not found.</div>;
    }
    
    const items = details.line_items || [];
    
    return (
      <div className="bg-slate-50 p-3 text-xs border-t border-slate-100 flex flex-col gap-3">
        {tx.zohoUrl && (
          <a 
            href={tx.zohoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-600 font-bold hover:underline mb-1 w-fit"
          >
            Open in Zoho Books <ExternalLink size={12} strokeWidth={2.5} />
          </a>
        )}
        
        <div className="flex flex-col gap-1 border-b border-slate-200 pb-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Invoice Summary</div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-slate-600">Total Amount</span>
            <span className="font-bold text-slate-800">{formatMoney(details.total || 0)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-slate-500">Total Tax</span>
            <span className="font-medium text-slate-600">{formatMoney(details.tax_total || 0)}</span>
          </div>
        </div>
        
        <div>
          <div className="font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-1 flex justify-between">
            <span>Item</span>
            <span>Amount</span>
          </div>
          <div className="space-y-2">
            {items.map((item: any, idx: number) => {
              const wattage = extractSolarPanelWattage(item.name || '');
              let displayRateStr = '';
              if (wattage && item.rate) {
                const perWatt = item.rate / wattage;
                displayRateStr = `${item.quantity} pcs × ${wattage} Watt × ${formatMoney(perWatt)}`;
              } else if (item.unit) {
                displayRateStr = `${item.quantity} ${item.unit} × ${formatMoney(item.rate)}`;
              } else {
                displayRateStr = `${item.quantity} × ${formatMoney(item.rate)}`;
              }
              
              if (item.tax_percentage) {
                displayRateStr += ` @${item.tax_percentage}% GST`;
              }

              return (
                <div key={idx} className="flex justify-between items-start gap-2">
                  <div className="flex-1 leading-tight flex flex-col gap-0.5">
                    <span className="text-slate-800 font-bold">{item.name || 'Item'}</span>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {displayRateStr}
                    </div>
                    {item.description && (
                      <div className="text-[10px] text-yellow-600/90 italic leading-snug mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div className="font-bold text-slate-800 shrink-0">{formatMoney(item.item_total)}</div>
                </div>
              );
            })}
            {items.length === 0 && <div className="text-slate-400">No items found.</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 p-4 pb-24 space-y-4 relative">
      {/* Customer Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible relative z-30">
        {!selectedCustomer ? (
          <div className="p-3 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search Customer Name or ID..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-[#1A2766] rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-[250px] overflow-y-auto">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex flex-col gap-0.5 active:bg-slate-100"
                  >
                    <span className="font-bold text-sm text-slate-800 truncate">{c.name}</span>
                    <span className="text-[11px] font-medium text-slate-500">GSTIN: {c.gstNumber || 'N/A'}</span>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && suggestions.length === 0 && searchQuery.length >= 3 && !isSearching && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-sm text-slate-500">
                No customers found matching "{searchQuery}"
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 flex items-start justify-between">
            <div className="flex-1 pr-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Selected Customer</div>
              <h2 className="font-bold text-slate-800 text-sm leading-snug">{selectedCustomer.name}</h2>
              <div className="text-xs text-slate-500 font-medium mt-0.5 flex flex-col gap-0.5">
                {selectedCustomer.gstNumber && selectedCustomer.gstNumber !== 'NOT_AVAILABLE' && (
                  <span>GSTIN: {selectedCustomer.gstNumber}</span>
                )}
                {statement?.data?.customer?.mobile && (
                  <span className="flex items-center gap-1 text-slate-600 mt-1">
                    <Phone size={12} /> {statement.data.customer.mobile}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end shrink-0">
              <button 
                onClick={handleClearCustomer}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 px-2 py-1 rounded transition-colors"
              >
                Change
              </button>
              {statement?.data?.customer?.mobile && (
                <a 
                  href={`tel:${statement.data.customer.mobile}`}
                  className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center active:bg-green-200"
                >
                  <Phone size={14} fill="currentColor" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-[#1A2766] rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Fetching statement...</span>
        </div>
      )}

      {!loading && statement?.data && (
        <>
          {/* Filters & Date Range */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3 relative z-20">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'This Financial Year', 'Custom'].map(r => (
                <button
                  key={r}
                  onClick={() => handleQuickRangeChange(r)}
                  className={`px-3 py-1.5 rounded-full shrink-0 border text-[11px] font-bold transition-colors ${
                    quickRange === r 
                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                      : 'bg-white text-slate-500 border-slate-200 active:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            
            {quickRange === 'Custom' && (
              <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                <input 
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setVisibleCount(15); }}
                  className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700 font-medium"
                />
                <span className="text-slate-300 font-bold text-xs shrink-0">to</span>
                <input 
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => { setDateTo(e.target.value); setVisibleCount(15); }}
                  className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700 font-medium"
                />
              </div>
            )}
            
            <div className="relative border-t border-slate-100 pt-3">
              <Search className="absolute left-2.5 top-[22px] text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search references..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1A2766]/30"
                value={textSearch}
                onChange={(e) => { setTextSearch(e.target.value); setVisibleCount(15); }}
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
              {[
                { id: 'all', label: 'All' },
                { id: 'invoice', label: 'Invoices' },
                { id: 'payment', label: 'Payments' },
                { id: 'bill', label: 'Bills' },
                { id: 'vendor_payment', label: 'Vendor Pmts' }
              ].map(ft => (
                <button
                  key={ft.id}
                  onClick={() => { setFilterType(ft.id); setVisibleCount(15); }}
                  className={`px-3 py-1.5 rounded-full shrink-0 border transition-colors ${
                    filterType === ft.id 
                      ? 'bg-[#1A2766] text-white border-[#1A2766]' 
                      : 'bg-white text-slate-600 border-slate-200 active:bg-slate-50'
                  }`}
                >
                  {ft.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 relative z-10">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Opening Balance</div>
              <div className={`font-bold text-base ${dynamicOpeningBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatMoney(dynamicOpeningBalance)}
                <span className="text-[10px] ml-1 opacity-70 font-semibold">{dynamicOpeningBalance >= 0 ? 'Dr' : 'Cr'}</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Closing Balance</div>
              <div className={`font-bold text-base ${dynamicClosingBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatMoney(dynamicClosingBalance)}
                <span className="text-[10px] ml-1 opacity-70 font-semibold">{dynamicClosingBalance >= 0 ? 'Dr' : 'Cr'}</span>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Debit</div>
              <div className="font-bold text-slate-700 text-base">
                {formatMoney(totalDebitAmount)}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Credit</div>
              <div className="font-bold text-slate-700 text-base">
                {formatMoney(totalCreditAmount)}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-3 relative z-0">
            {visibleTransactions.map((tx: any) => {
              const isExpanded = expandedTxId === tx.id;
              const isDebit = tx.netEffect > 0;
              const hasDetails = tx.type === 'invoice' || tx.type === 'bill';
              
              let dateDisplay = tx.date;
              try {
                const d = new Date(tx.date || tx.datetime);
                dateDisplay = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              } catch(e) {}
              
              const displayDesc = cleanDescription(tx.description || '', tx.type);

              return (
                <div key={tx.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div 
                    className={`p-3 flex items-start gap-3 ${hasDetails ? 'active:bg-slate-50 cursor-pointer' : ''}`}
                    onClick={() => hasDetails && toggleExpand(tx)}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                      tx.type === 'invoice' ? 'bg-blue-50 text-blue-500' :
                      tx.type === 'payment' ? 'bg-emerald-50 text-emerald-500' :
                      tx.type === 'bill' ? 'bg-orange-50 text-orange-500' :
                      'bg-purple-50 text-purple-500'
                    }`}>
                      {tx.type === 'invoice' ? <FileText size={14} strokeWidth={2.5} /> :
                       tx.type === 'payment' ? <Banknote size={14} strokeWidth={2.5} /> :
                       tx.type === 'bill' ? <FileBox size={14} strokeWidth={2.5} /> :
                       <CreditCard size={14} strokeWidth={2.5} />}
                    </div>
                    
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <div className="font-bold text-sm text-slate-800 pr-2 leading-snug">
                          {tx.type === 'invoice' ? `Invoice ${displayDesc}` :
                           tx.type === 'payment' ? `Payment - ${displayDesc}` : displayDesc}
                        </div>
                        <div className={`font-bold text-sm shrink-0 ${isDebit ? 'text-slate-800' : 'text-emerald-600'}`}>
                          {isDebit ? '' : '-'}{formatMoney(Math.abs(tx.netEffect))}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-slate-500 font-medium mt-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} /> {dateDisplay}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Balance:</span>
                          <span className={`font-bold ${tx.balanceAfter >= 0 ? 'text-slate-700' : 'text-emerald-600'}`}>
                            {formatMoney(tx.balanceAfter)}
                            <span className="text-[9px] ml-0.5 opacity-60 font-semibold">{tx.balanceAfter >= 0 ? 'Dr' : 'Cr'}</span>
                          </span>
                        </div>
                      </div>
                      
                      {/* Payment extras */}
                      {tx.type === 'payment' && (
                        <div className="mt-2 flex flex-col items-start gap-1">
                          {tx.referenceNumber && (
                            <div className="text-[11px] text-slate-600 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-2">
                              Ref: {tx.referenceNumber}
                              {tx.isVerified && (
                                <span title="Verified payment" aria-label="Verified payment" className="inline-flex items-center justify-center bg-emerald-500 text-white rounded-full w-3.5 h-3.5 shrink-0 ml-1.5">
                                  <Check size={10} strokeWidth={3.5} />
                                </span>
                              )}
                            </div>
                          )}
                          {!tx.referenceNumber && tx.isVerified && (
                            <div className="text-[11px] font-medium mt-0.5 flex items-center">
                              Payment <span title="Verified payment" aria-label="Verified payment" className="inline-flex items-center justify-center bg-emerald-500 text-white rounded-full w-3.5 h-3.5 shrink-0 ml-1.5">
                                <Check size={10} strokeWidth={3.5} />
                              </span>
                            </div>
                          )}
                          {tx.notes && (
                            <div className="text-[11px] text-slate-400 italic break-words whitespace-normal mt-0.5 leading-tight">
                              {tx.notes}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Invoice extras */}
                      
                    </div>
                    
                    {hasDetails && (
                      <div className="mt-1 shrink-0 text-slate-300">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    )}
                  </div>
                  
                  {isExpanded && hasDetails && renderInvoiceSummary(tx)}
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <Filter size={24} className="text-slate-300" />
                <div className="font-medium">No transactions found</div>
                <div className="text-xs">Try adjusting your filters or search query.</div>
              </div>
            )}
          </div>

          {/* Load More */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + 15)}
              className="w-full py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-600 active:bg-slate-50 transition-colors"
            >
              Load More ({filteredTransactions.length - visibleTransactions.length} remaining)
            </button>
          )}

          {/* PDF Floating Button */}
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+70px)] right-4 z-40">
            <button
              onClick={handleDownloadPDF}
              disabled={pdfGenerating}
              className="px-4 py-3 bg-[#1A2766] border border-[#121B47] rounded-full shadow-[0_4px_16px_rgba(26,39,102,0.4)] text-sm font-bold text-white flex items-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:scale-100 hover:bg-[#121B47]"
            >
              {pdfGenerating ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Download size={16} strokeWidth={2.5} />
              )}
              {pdfGenerating ? 'Generating...' : 'PDF'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

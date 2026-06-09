'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ExternalLink, Calendar, Search, ChevronLeft, ChevronRight, Activity, X } from 'lucide-react';
import { useDcrStats } from './layout';

const ZOHO_ORG_ID = process.env.NEXT_PUBLIC_ZOHO_ORG_ID || '';

export default function DcrClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sortBy = searchParams.get('sortBy') || '';
  const sortOrder = searchParams.get('sortOrder') || '';
  const searchParam = searchParams.get('search') || '';
  const { refreshStats } = useDcrStats();
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [kpis, setKpis] = useState({ totalImported: 0, newCount: 0, totalReviewPending: 0 });
  const [apiUsage, setApiUsage] = useState<any>({
    syncCalls: 0,
    detailCalls: 0,
    customerCalls: 0,
    itemCalls: 0,
    totalCalls: 0,
    lastUpdated: null,
    rateLimit: { used: 0, remaining: 2000, health: 'Healthy' },
    lastSyncDetails: { lastSyncTime: null, syncRange: 'N/A', invoicesImported: 0 },
    recentCalls: []
  });
  const [showDrawer, setShowDrawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParam);
  
  const [viewState, setViewState] = useState<'active' | 'archived'>('active');
  const [selectedQuickSync, setSelectedQuickSync] = useState<'today' | 'yesterday' | '3days' | '7days' | '15days' | 'custom' | null>('today');
  const [lastUpdatedText, setLastUpdatedText] = useState<string>('');

  const nextRefreshTimeRef = useRef<number>(Date.now() + 60 * 60 * 1000);

  const formatLastUpdated = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = pad(date.getDate());
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    let hours = date.getHours();
    const minutes = pad(date.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const h = pad(hours);
    return `${d} ${m} ${y}, ${h}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    setLastUpdatedText(formatLastUpdated(new Date()));
  }, []);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalInvoices, setTotalInvoices] = useState(0);

  // Sync Cooldown State
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // Custom Sync Modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customDate, setCustomDate] = useState('');

  // Manual Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [isPrechecking, setIsPrechecking] = useState(false);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);

  useEffect(() => {
    fetchInvoices();
  }, [viewState, page, limit, sortBy, sortOrder, searchParam]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const currentSearch = params.get('search') || '';
      
      if (searchQuery.trim() !== currentSearch) {
        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        } else {
          params.delete('search');
        }
        params.set('page', '1');
        router.push(`${window.location.pathname}?${params.toString()}`);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, router]);

  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, [cooldown]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedQuickSync !== 'today') return;
      if (viewState !== 'active') return;
      if (typeof window !== 'undefined' && window.location.pathname !== '/staff/dashboard/accounts/dcr') return;

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const isWithinWindow = hours >= 9 && (hours < 20 || (hours === 20 && minutes === 0));
      if (!isWithinWindow) return;

      if (document.hidden) return;

      if (Date.now() >= nextRefreshTimeRef.current) {
        const activeEl = document.activeElement;
        const isUserTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        if (isUserTyping) {
          nextRefreshTimeRef.current = Date.now() + 5 * 60 * 1000;
        } else {
          fetchInvoices();
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedQuickSync, viewState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDrawer(false);
      }
    };
    if (showDrawer) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDrawer]);

  const getHealthIndicator = (health: string) => {
    switch (health) {
      case 'Healthy': return '🟢';
      case 'Warning': return '🟡';
      case 'Error': return '🔴';
      default: return '🟢';
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/dcr/invoices?view=${viewState}&page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(searchParam)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setInvoices(data.invoices || []);
      setTotalInvoices(data.total || 0);
      setLastSyncTime(data.lastSyncTime || null);
      if (data.kpis) setKpis(data.kpis);
      if (data.apiUsage) setApiUsage(data.apiUsage);
      setLastUpdatedText(formatLastUpdated(new Date()));
      nextRefreshTimeRef.current = Date.now() + 60 * 60 * 1000;
      refreshStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'date' | 'total') => {
    const params = new URLSearchParams(window.location.search);
    const currentSortBy = params.get('sortBy');
    const currentSortOrder = params.get('sortOrder');

    setPage(1);

    if (field === 'date') {
      if (!currentSortBy || currentSortBy !== 'date') {
        params.set('sortBy', 'date');
        params.set('sortOrder', 'asc');
      } else if (currentSortOrder === 'asc') {
        params.set('sortBy', 'date');
        params.set('sortOrder', 'desc');
      } else {
        params.delete('sortBy');
        params.delete('sortOrder');
      }
    } else if (field === 'total') {
      if (!currentSortBy || currentSortBy !== 'total') {
        params.set('sortBy', 'total');
        params.set('sortOrder', 'desc');
      } else if (currentSortOrder === 'desc') {
        params.set('sortBy', 'total');
        params.set('sortOrder', 'asc');
      } else {
        params.delete('sortBy');
        params.delete('sortOrder');
      }
    }

    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const startCooldown = () => {
    setCooldown(60);
  };

  const handleQuickSync = async (days: number) => {
    if (cooldown > 0) return;
    if (days === 0) setSelectedQuickSync('today');
    else if (days === 1) setSelectedQuickSync('yesterday');
    else if (days === 3) setSelectedQuickSync('3days');
    else if (days === 7) setSelectedQuickSync('7days');
    else if (days === 15) setSelectedQuickSync('15days');

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    await executeSync(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  };

  const handleCustomSync = async () => {
    if (cooldown > 0) return;
    if (!customDate) return;
    const selectedDate = new Date(customDate);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (selectedDate < sixMonthsAgo) {
      toast.error('Date must be within the last 6 months');
      return;
    }
    
    setShowCustomModal(false);
    setSelectedQuickSync('custom');
    await executeSync(customDate, customDate);
  };

  const executeSync = async (startDate: string, endDate: string) => {
    try {
      setSyncing(true);
      const res = await fetch('/api/admin/dcr/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_start: startDate, date_end: endDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Synced! Created: ${data.created}, Updated: ${data.updated}`);
      startCooldown();
      setLastUpdatedText(formatLastUpdated(new Date()));
      nextRefreshTimeRef.current = Date.now() + 60 * 60 * 1000;
      // Reset page to 1 on sync
      if (page !== 1) setPage(1);
      else fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handlePrecheck = async () => {
    if (!importInput.trim()) return;
    const numbers = importInput.split('\n').map(n => n.trim()).filter(Boolean);
    if (numbers.length === 0) return;

    try {
      setIsPrechecking(true);
      const res = await fetch('/api/admin/dcr/manual-import/precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumbers: numbers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportResults(data.results);
      setImportSummary(null);
    } catch (err: any) {
      toast.error(err.message || 'Precheck failed');
    } finally {
      setIsPrechecking(false);
    }
  };

  const handleManualImport = async () => {
    const toImport = importResults.filter(r => r.status === 'FOUND_IN_ZOHO').map(r => r.invoiceId);
    if (toImport.length === 0) return;

    try {
      setIsImporting(true);
      const res = await fetch('/api/admin/dcr/manual-import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: toImport })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const summary = {
        imported: data.imported,
        alreadyImported: importResults.filter(r => r.status === 'ALREADY_IMPORTED').length,
        notFound: importResults.filter(r => r.status === 'NOT_FOUND').length,
        failed: data.failed
      };
      
      setImportSummary(summary);
      toast.success(`Imported ${data.imported} invoices`);
      
      setLastUpdatedText(formatLastUpdated(new Date()));
      nextRefreshTimeRef.current = Date.now() + 60 * 60 * 1000;
      if (page !== 1) setPage(1);
      else fetchInvoices();
      
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopySummary = () => {
    if (!importSummary) return;
    let text = `Imported: ${importSummary.imported}\nAlready Imported: ${importSummary.alreadyImported}\nNot Found: ${importSummary.notFound}\nFailed: ${importSummary.failed}`;
    if (importSummary.results && importSummary.results.length > 0) {
      text += '\n\nDetails:\n' + importSummary.results.map((r: any) => `${r.invoiceNumber || r.invoiceId} | ${r.status} | ${r.reason}`).join('\n');
    }
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'UNDER_REVIEW': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'DCR_IDENTIFIED': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'PENDING_SERIALS': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'NO_DCR_REQUIRED': return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'READY_TO_ISSUE': return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'ISSUED': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const totalPages = Math.ceil(totalInvoices / limit) || 1;
  const startRow = (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, totalInvoices);
  const isSyncDisabled = syncing || cooldown > 0;

  return (
    <div className="flex flex-col gap-6">
      
      {/* Top Controls Row */}
      <div className="flex flex-col min-[1200px]:flex-row gap-6 items-stretch min-[1200px]:items-center justify-between shrink-0">
        
        {/* View Toggles */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 shrink-0 h-9 items-center">
          <button
            onClick={() => { setViewState('active'); setPage(1); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewState === 'active' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Queue
          </button>
          <button
            onClick={() => { setViewState('archived'); setPage(1); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewState === 'archived' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Archived
          </button>
        </div>

        {/* Sync Controls Toolbar */}
        <div className="bg-white px-[20px] py-[16px] rounded-xl shadow-sm border border-gray-200 flex flex-wrap min-[1200px]:flex-nowrap items-center gap-4 text-xs">
          {/* API Status Section */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowDrawer(true)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                apiUsage.rateLimit?.health === 'Healthy' 
                  ? 'bg-[#E8F8EE] text-[#16A34A] border-[#E8F8EE] hover:bg-[#D1F2DD]'
                  : apiUsage.rateLimit?.health === 'Warning'
                    ? 'bg-[#FEF9C3] text-[#CA8A04] border-[#FEF9C3] hover:bg-[#FEF08A]'
                    : 'bg-[#FEE2E2] text-[#DC2626] border-[#FEE2E2] hover:bg-[#FCA5A5]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              <span>API: {apiUsage.rateLimit?.health || 'Healthy'}</span>
            </button>
            
            {lastSyncTime && (
              <span className="text-[13px] text-[#6B7280] font-medium whitespace-nowrap">
                Last Sync: {new Date(lastSyncTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            )}

            {cooldown > 0 && !syncing && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-[13px] text-[#F97316] font-semibold whitespace-nowrap">
                  Cooldown: {cooldown}s
                </span>
              </>
            )}
          </div>

          <div className="hidden min-[1200px]:block w-px h-6 bg-gray-200"></div>

          {/* Quick Sync Group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[#6B7280] mr-1">Quick Sync:</span>
            <button onClick={() => handleQuickSync(0)} disabled={isSyncDisabled} className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors disabled:opacity-50 ${selectedQuickSync === 'today' ? 'bg-[#1A2766] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Today</button>
            <button onClick={() => handleQuickSync(1)} disabled={isSyncDisabled} className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors disabled:opacity-50 ${selectedQuickSync === 'yesterday' ? 'bg-[#1A2766] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Yesterday</button>
            <button onClick={() => handleQuickSync(3)} disabled={isSyncDisabled} className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors disabled:opacity-50 ${selectedQuickSync === '3days' ? 'bg-[#1A2766] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Last 3 Days</button>
            <button onClick={() => handleQuickSync(7)} disabled={isSyncDisabled} className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors disabled:opacity-50 ${selectedQuickSync === '7days' ? 'bg-[#1A2766] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Last 7 Days</button>
            
            <button onClick={() => setShowCustomModal(true)} disabled={isSyncDisabled} className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors flex items-center gap-1 disabled:opacity-50 ${selectedQuickSync === 'custom' ? 'bg-[#1A2766] text-white' : 'bg-[#1A2766]/10 hover:bg-[#1A2766]/20 text-[#1A2766]'}`}>
              <Calendar size={12} /> Custom
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <button 
              onClick={() => { setShowImportModal(true); setImportResults([]); setImportSummary(null); setImportInput(''); }} 
              disabled={isSyncDisabled} 
              className="px-2.5 py-1 text-xs rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              Import Invoice
            </button>
            {syncing && <span className="ml-2 text-xs text-blue-600 animate-pulse font-medium">Syncing...</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full">
        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 animate-in fade-in duration-300">
          <div className="bg-white py-5 px-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-start justify-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Imported</span>
            <span className="text-3xl font-bold text-[#1A2766] mt-1">{kpis.totalImported}</span>
          </div>
          <div className="bg-white py-5 px-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-start justify-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">New</span>
            <span className="text-3xl font-bold text-gray-700 mt-1">{kpis.newCount}</span>
          </div>
          <div className="bg-white py-5 px-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-start justify-center">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Review Pending</span>
            <span className="text-3xl font-bold text-orange-500 mt-1">{kpis.totalReviewPending}</span>
          </div>
        </div>

        {/* Invoice Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
            <h3 className="font-semibold text-gray-800 text-sm">{viewState === 'active' ? 'Active Review Queue' : 'Archived Invoices'}</h3>
            <div className="flex items-center gap-4">
              {searchParam && (
                <span className="text-xs font-semibold text-[#1A2766] bg-[#1A2766]/10 px-3 py-1.5 rounded-full">
                  Found {totalInvoices} invoices
                </span>
              )}
              <div className="relative w-72">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search invoice or customer..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider w-12 text-center border-b border-gray-200">#</th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-200 w-44">Invoice Number</th>
                  <th 
                    className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-200 w-32 cursor-pointer select-none hover:bg-gray-200/50 transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1 justify-start">
                      <span>Date</span>
                      {sortBy === 'date' && sortOrder === 'desc' && <span className="text-[#1A2766] font-bold">↓</span>}
                      {sortBy === 'date' && sortOrder === 'asc' && <span className="text-[#1A2766] font-bold">↑</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-200 w-28">Location</th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-200">Customer</th>
                  <th 
                    className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-200 w-28 cursor-pointer select-none hover:bg-gray-200/50 transition-colors text-right"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>Total</span>
                      {sortBy === 'total' && sortOrder === 'desc' && <span className="text-[#1A2766] font-bold">↓</span>}
                      {sortBy === 'total' && sortOrder === 'asc' && <span className="text-[#1A2766] font-bold">↑</span>}
                    </div>
                  </th>
                    <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-center border-b border-gray-200 w-36">Status</th>
                    <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-center border-b border-gray-200 w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded mx-auto w-4"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12 mx-auto"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                        <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded w-20 mx-auto"></div></td>
                        <td className="px-4 py-4"><div className="h-8 bg-gray-200 rounded w-full"></div></td>
                      </tr>
                    ))
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-500 text-sm bg-gray-50/50">
                        {searchParam ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className="font-semibold text-gray-700">No invoices found.</span>
                            <span>Try searching by:</span>
                            <ul className="list-disc text-left mt-2">
                              <li>Invoice Number</li>
                              <li>Customer Name</li>
                              <li>Location</li>
                            </ul>
                          </div>
                        ) : (
                          `No invoices found in ${viewState === 'active' ? 'Active Queue' : 'Archive'}.`
                        )}
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv, idx) => (
                      <tr key={inv.id} className="hover:bg-blue-50/40 transition-colors group">
                        <td className="px-4 py-3 text-center text-gray-400 text-xs font-medium align-middle">{startRow + idx}</td>
                        <td className="px-4 py-3 font-medium text-xs align-middle">
                          <a 
                            href={`https://books.zoho.in/app${ZOHO_ORG_ID ? '/' + ZOHO_ORG_ID : ''}#/invoices/${inv.zohoInvoiceId}`} 
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#1A2766] hover:underline inline-flex items-center gap-1"
                          >
                            {inv.invoiceNumber} <ExternalLink size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs align-middle">{new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-gray-50 text-gray-600 border-gray-200">
                            {inv.locationName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-800 text-xs align-middle leading-snug whitespace-normal break-words">{inv.customerName}</td>
                        <td className="px-4 py-3 text-gray-900 text-right font-medium text-xs align-middle whitespace-nowrap">₹{inv.invoiceTotal.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                          {inv.processingReason === 'AUTO_LOW_VALUE' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-700 border-slate-300">
                                AUTO NO DCR
                              </span>
                              <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap">Value &lt; ₹5,000</span>
                            </div>
                          ) : (
                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(inv.dcrStatus)}`}>
                              {inv.dcrStatus.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                          {inv.dcrStatus === 'NEW' || inv.dcrStatus === 'UNDER_REVIEW' ? (
                            <button
                              onClick={() => router.push(`/staff/dashboard/accounts/dcr/review/${inv.id}`)}
                              className="bg-[#1A2766] text-white hover:bg-[#1A2766]/90 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors w-full"
                            >
                              Review Invoice
                            </button>
                          ) : (
                            <button
                              onClick={() => router.push(`/staff/dashboard/accounts/dcr/review/${inv.id}`)}
                              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors w-full"
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">
                  Showing <span className="font-semibold text-gray-900">{totalInvoices > 0 ? startRow : 0}</span> to <span className="font-semibold text-gray-900">{endRow}</span> of <span className="font-semibold text-gray-900">{totalInvoices}</span> invoices
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Rows per page:</span>
                  <select 
                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
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
        </div>

      {/* API Diagnostics Drawer */}
      {showDrawer && (
        <div 
          className="fixed inset-0 bg-black/40 z-50 flex justify-end animate-in fade-in duration-200"
          onClick={() => setShowDrawer(false)}
        >
          <div 
            className="bg-white w-[400px] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-[#1A2766]" />
                <h2 className="font-bold text-gray-900 text-base">Zoho API Diagnostics</h2>
              </div>
              <button 
                onClick={() => setShowDrawer(false)}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Today's Usage */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Today's Usage</h3>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Invoices Sync Calls</span>
                    <span className="font-semibold text-gray-900">{apiUsage.syncCalls || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Invoice Detail Calls</span>
                    <span className="font-semibold text-gray-900">{apiUsage.detailCalls || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Customer Calls</span>
                    <span className="font-semibold text-gray-900">{apiUsage.customerCalls || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Item Calls</span>
                    <span className="font-semibold text-gray-900">{apiUsage.itemCalls || 0}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-800">Total API Calls</span>
                    <span className="text-[#1A2766]">{apiUsage.totalCalls || 0}</span>
                  </div>
                </div>
              </div>

              {/* Last Sync Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Last Sync Details</h3>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Last Sync Time</span>
                    <span className="font-medium text-gray-900">
                      {apiUsage.lastSyncDetails?.lastSyncTime 
                        ? new Date(apiUsage.lastSyncDetails.lastSyncTime).toLocaleTimeString('en-IN', { timeStyle: 'short' }) + ' ' + new Date(apiUsage.lastSyncDetails.lastSyncTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Sync Range</span>
                    <span className="font-medium text-gray-900">{apiUsage.lastSyncDetails?.syncRange || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Invoices Imported</span>
                    <span className="font-semibold text-gray-950">{apiUsage.lastSyncDetails?.invoicesImported || 0}</span>
                  </div>
                </div>
              </div>

              {/* Rate Limit Status */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Rate Limit Status</h3>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Used Today</span>
                    <span className="font-semibold text-gray-900">{apiUsage.rateLimit?.used || 0} / 2,000</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Remaining</span>
                    <span className="font-semibold text-gray-900">{apiUsage.rateLimit?.remaining || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Health</span>
                    <span className="inline-flex items-center gap-1 font-bold text-xs">
                      {apiUsage.rateLimit?.health === 'Healthy' && <span className="text-green-600">🟢 Healthy</span>}
                      {apiUsage.rateLimit?.health === 'Warning' && <span className="text-yellow-600">🟡 Warning</span>}
                      {apiUsage.rateLimit?.health === 'Error' && <span className="text-red-600">🔴 Error</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Calls */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recent Calls (Last 20)</h3>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden text-xs">
                  {!apiUsage.recentCalls || apiUsage.recentCalls.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">No recent API calls logged.</div>
                  ) : (
                    apiUsage.recentCalls.map((call: any, idx: number) => (
                      <div key={idx} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-800 font-mono">{call.endpoint}</div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(call.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                          {call.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/55 text-[10px] text-gray-400 text-center uppercase tracking-wider">
              Last Updated: {apiUsage.lastUpdated ? new Date(apiUsage.lastUpdated).toLocaleTimeString('en-IN', { timeStyle: 'short' }) : 'Never'}
            </div>
          </div>
        </div>
      )}

      {/* Manual Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">Manual Invoice Import</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Enter Invoice Numbers or Zoho IDs</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] min-h-[100px] resize-y"
                  placeholder="KT/26-27/1001&#10;KT/26-27/1002&#10;982347000000123456"
                  value={importInput}
                  onChange={e => setImportInput(e.target.value)}
                  disabled={isPrechecking || isImporting || !!importSummary}
                />
                <p className="text-xs text-gray-500">One per line. Bypasses date sync restrictions.</p>
              </div>

              {!importSummary && importResults.length === 0 && (
                <div>
                  <button 
                    onClick={handlePrecheck}
                    disabled={!importInput.trim() || isPrechecking}
                    className="px-4 py-2 text-sm font-medium bg-[#1A2766] text-white rounded-lg hover:bg-[#1A2766]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPrechecking ? 'Checking...' : 'Preview Import'}
                  </button>
                </div>
              )}

              {importResults.length > 0 && !importSummary && (
                <div className="flex flex-col gap-3">
                  <h4 className="font-semibold text-sm text-gray-800 border-b pb-2">Preview Results</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Input</th>
                          <th className="px-3 py-2 font-semibold">Customer</th>
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Total</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 font-semibold">DCR Status</th>
                          <th className="px-3 py-2 font-semibold text-center">Zoho</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importResults.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 font-medium">{r.invoiceNumber || r.input}</td>
                            <td className="px-3 py-2 text-gray-600">{r.customer || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : '-'}</td>
                            <td className="px-3 py-2 font-medium">{r.total ? `₹${r.total.toLocaleString('en-IN')}` : '-'}</td>
                            <td className="px-3 py-2">
                              {r.status === 'FOUND_IN_ZOHO' && <span className="text-green-600 font-bold">FOUND IN ZOHO</span>}
                              {r.status === 'ALREADY_IMPORTED' && <span className="text-orange-600 font-bold">ALREADY IMPORTED</span>}
                              {r.status === 'NOT_FOUND' && <span className="text-red-600 font-bold">NOT FOUND</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-500 font-medium">{r.currentDcrStatus || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              {r.invoiceId ? (
                                <a 
                                  href={`https://books.zoho.in/app${ZOHO_ORG_ID ? '/' + ZOHO_ORG_ID : ''}#/invoices/${r.invoiceId}`} 
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#1A2766] hover:underline inline-flex"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-2">
                    <button 
                      onClick={() => setImportResults([])}
                      disabled={isImporting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Clear & Edit
                    </button>
                    <button 
                      onClick={handleManualImport}
                      disabled={isImporting || importResults.filter(r => r.status === 'FOUND_IN_ZOHO').length === 0}
                      className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {isImporting ? 'Importing...' : `Import Valid Invoices (${importResults.filter(r => r.status === 'FOUND_IN_ZOHO').length})`}
                    </button>
                  </div>
                </div>
              )}

              {importSummary && (
                <div className="flex flex-col items-center justify-center py-6 gap-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-bold text-gray-800 border-b pb-2 w-full text-center">Import Complete</h4>
                  <div className="grid grid-cols-4 gap-4 w-full px-6 text-sm">
                    <div className="bg-white p-3 rounded shadow-sm border border-gray-100 flex flex-col items-center"><span className="text-gray-500 text-xs uppercase">Imported</span><span className="font-bold text-xl text-green-600">{importSummary.imported}</span></div>
                    <div className="bg-white p-3 rounded shadow-sm border border-gray-100 flex flex-col items-center"><span className="text-gray-500 text-xs uppercase">Already Imported</span><span className="font-bold text-xl text-orange-500">{importSummary.alreadyImported}</span></div>
                    <div className="bg-white p-3 rounded shadow-sm border border-gray-100 flex flex-col items-center"><span className="text-gray-500 text-xs uppercase">Not Found</span><span className="font-bold text-xl text-gray-700">{importSummary.notFound}</span></div>
                    <div className="bg-white p-3 rounded shadow-sm border border-gray-100 flex flex-col items-center"><span className="text-gray-500 text-xs uppercase">Failed</span><span className="font-bold text-xl text-red-600">{importSummary.failed}</span></div>
                  </div>
                  
                  {importSummary.results && importSummary.results.length > 0 && (
                    <div className="w-full px-6 mt-2 max-h-[250px] overflow-y-auto">
                      <table className="w-full text-left text-xs bg-white border border-gray-200 rounded-lg">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 border-b">Invoice</th>
                            <th className="px-3 py-2 border-b">Status</th>
                            <th className="px-3 py-2 border-b">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {importSummary.results.map((res: any, idx: number) => (
                            <tr key={idx} className={res.status === 'FAILED' ? 'bg-red-50' : 'bg-green-50'}>
                              <td className="px-3 py-2 font-medium">{res.invoiceNumber || res.invoiceId}</td>
                              <td className="px-3 py-2 font-bold text-[10px] uppercase">
                                <span className={res.status === 'FAILED' ? 'text-red-600' : 'text-green-600'}>{res.status}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-700">{res.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button onClick={handleCopySummary} className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
                      Copy Results
                    </button>
                    <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm font-semibold bg-[#1A2766] text-white rounded-lg shadow-sm hover:bg-[#1A2766]/90 transition-colors">
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Sync Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Custom Date Sync</h3>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Date</label>
              <input 
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500 mt-2">Date must be within the previous 6 months.</p>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button 
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCustomSync}
                disabled={!customDate}
                className="px-4 py-2 text-sm font-medium bg-[#1A2766] text-white rounded-lg hover:bg-[#1A2766]/90 transition-colors disabled:opacity-50"
              >
                Sync Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

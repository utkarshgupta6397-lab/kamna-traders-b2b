'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RefreshCw, Terminal, CheckCircle2, AlertCircle, Building2, ChevronDown, ChevronUp, ArrowUpDown, PieChart, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface ZohoTransaction {
  transaction_id?: string;
  statement_id?: string;
  payment_id?: string;
  date: string; // YYYY-MM-DD
  amount: number;
  payee?: string;
  description: string;
  reference_number: string;
  debit_or_credit: 'debit' | 'credit';
  status: string;
  transaction_type?: string;
  account_id: string;
  rule_name?: string;
  party_name?: string;
  contact_name?: string;
  customer_name?: string;
  imported_transactions?: { date?: string; amount?: number }[];
  _source?: 'BANK FEED' | 'MANUAL PAYMENT' | 'MERGED';
  _normalizedParty?: string;
  _timestamp?: number;
  displayDate?: string;
}

interface TelemetryData {
  accountName: string;
  accountId: string;
  endpoint?: string;
  method: string;
  status: number;
  durationMs: number;
  recordCount?: number;
  statementsCount?: number;
  paymentsCount?: number;
  pagesFetched?: number;
}

const CACHE_KEY = 'kamna_bank_feed_v2_cache';
const CACHE_TIME_KEY = 'kamna_bank_feed_v2_time';
const CACHE_DURATION_MS = 120 * 1000; // 120 seconds
const ICICI_ACCOUNT_ID = '1759923000003416718';

type SortOption = 'Latest First' | 'Oldest First' | 'Highest Amount' | 'Lowest Amount';

function getTodayIST(): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const d = parts.find(p => p.type === 'day')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const y = parts.find(p => p.type === 'year')?.value;
  return `${y}-${m}-${d}`;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

function parsePaymentMethod(description: string): string {
  const desc = (description || '').toUpperCase();
  if (desc.includes('RTGS') || desc.includes('NEFT') || desc.includes('IMPS') || desc.includes('UPI')) return 'BANK TRANSFER';
  if (desc.includes('CASH') || desc.includes('CSH')) return 'CASH';
  return 'OTHER';
}

function parseCompanyName(description: string): string | null {
  if (!description) return null;

  // Handle RTGS/NEFT dash separated format
  // e.g. RTGS-UTIBR52026052100363771-SHREE SIDHBALI TRADERS...
  if (description.includes('-')) {
    const parts = description.split('-');
    if (parts.length >= 3) {
      const candidate = parts[2].trim();
      if (candidate.length > 2) return candidate;
    }
  }

  // Handle IMPS slash separated format
  // e.g. MMT/IMPS/314118542915/A M ASSOCI/HDFC Bank
  if (description.includes('/')) {
    const parts = description.split('/');
    if (parts.length >= 4) {
      const candidate = parts[3].trim();
      if (candidate.length > 2) return candidate;
    }
  }

  return null;
}

// Safely extract datetime combined string
function extractDateTime(txn: any): { displayDate: string, timestamp: number } {
  let day = '01';
  let month = 'Jan';
  let year = '2026';
  
  const rawDate = txn.date || txn.created_time || '';
  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  
  if (match) {
    const [, y, mStr, d] = match;
    const mNum = parseInt(mStr, 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    year = y;
    month = months[mNum - 1];
    day = d;
  } else {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      day = d.getDate().toString().padStart(2, '0');
      month = d.toLocaleString('en-IN', { month: 'short' });
      year = d.getFullYear().toString();
    }
  }

  let timeStr = '—';
  let timestamp = new Date(rawDate).getTime();
  if (isNaN(timestamp)) timestamp = 0;

  // If it's a customer payment with created_time
  if (txn.created_time) {
    const parsed = new Date(txn.created_time);
    if (!isNaN(parsed.getTime())) {
      timestamp = parsed.getTime();
      timeStr = parsed.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    }
  }
  // Try to find time in imported_transactions if it's an ISO string
  else if (txn.imported_transactions && txn.imported_transactions.length > 0) {
    const importedDate = txn.imported_transactions[0].date;
    if (importedDate && importedDate.includes('T')) {
      const parsed = new Date(importedDate);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed.getTime();
        timeStr = parsed.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
      }
    }
  }
  // Fallback to description regex if timeStr is still default
  else if (timeStr === '—' && txn.description) {
    const timeMatch = txn.description.match(/(\d{1,2}:\d{2}\s*[ap]m)/i);
    if (timeMatch) {
      timeStr = timeMatch[1].toLowerCase();
      // Rough timestamp adjustment for sorting
      const isPM = timeStr.includes('pm');
      const [hm] = timeStr.split(' ');
      const [hStr, mStr] = hm.split(':');
      let hours = parseInt(hStr, 10);
      const minutes = parseInt(mStr, 10);
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      timestamp += (hours * 3600000) + (minutes * 60000);
    }
  }

  const displayDate = timeStr !== '—' 
    ? `${day}-${month}-${year} ${timeStr}`
    : `${day}-${month}-${year}`;

  return { displayDate, timestamp };
}

function DonutChart({ data }: { data: any[] }) {
  let cumulativePercent = 0;
  const colors = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  function getCoordinatesForPercent(percent: number) {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  }

  return (
    <svg viewBox="-1 -1 2 2" className="w-16 h-16 transform -rotate-90">
      {data.map((slice, i) => {
        const percent = slice.percentage / 100;
        if (percent === 0) return null;
        if (percent === 1) {
          return <circle key={slice.name} r="1" cx="0" cy="0" fill={colors[i % colors.length]} />;
        }
        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;
        const pathData = [
          `M ${startX} ${startY}`,
          `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
          'L 0 0',
        ].join(' ');
        return <path key={slice.name} d={pathData} fill={colors[i % colors.length]} />;
      })}
      <circle r="0.65" cx="0" cy="0" fill="white" />
    </svg>
  );
}

export default function LiveBankTransactionsView() {
  const [statements, setStatements] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [debugOpen, setDebugOpen] = useState(false);
  
  const [sortOption, setSortOption] = useState<SortOption>('Highest Amount');

  // Interactive Client-Side Filters
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [uncategorizedOnly, setUncategorizedOnly] = useState<boolean>(false);
  const [activeViewingDate, setActiveViewingDate] = useState<string>(getTodayIST());
  const dateInputRef = useRef<HTMLInputElement>(null);

  const fetchTriggered = useRef(false);

  // Load from cache on mount
  useEffect(() => {
    if (fetchTriggered.current) return;
    fetchTriggered.current = true;

    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    
    if (cachedData && cachedTime) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed.data)) {
          setStatements(parsed.data);
          setPayments([]);
        } else if (parsed.data) {
          setStatements(parsed.data.statements || []);
          setPayments(parsed.data.payments || []);
        }
        setTelemetry(parsed.telemetry || null);
        setLastRefresh(parseInt(cachedTime, 10));
        // Reset cooldown since we loaded from cache instantly
        setCooldownRemaining(0);
        return; // ALWAYS render from cache. Never auto-fetch.
      } catch (e) {
        console.error('Cache parse error', e);
      }
    }
    
    // Only fetch if absolutely no cache exists
    handleFetch();
  }, []);

  // Merge and Deduplicate Logic
  const { mergedTransactions, mergeStats } = useMemo(() => {
    let feedCount = 0;
    let manualCount = 0;
    let duplicatesRemoved = 0;

    // Process Bank Statements
    const bankFeed = statements.filter(txn => 
      txn.account_id === ICICI_ACCOUNT_ID &&
      txn.debit_or_credit === 'debit' &&
      txn.date === activeViewingDate
    ).map(txn => {
      feedCount++;
      const { displayDate, timestamp } = extractDateTime(txn);
      return {
        ...txn,
        _source: 'BANK FEED' as const,
        _normalizedParty: (txn.party_name || txn.contact_name || txn.payee || parseCompanyName(txn.description) || '').toUpperCase().trim(),
        _timestamp: timestamp,
        displayDate
      };
    });

    // Process Customer Payments
    const customerPayments = payments.filter(p => p.date === activeViewingDate).map(p => {
      manualCount++;
      const { displayDate, timestamp } = extractDateTime(p);
      return {
        payment_id: p.payment_id,
        date: p.date,
        amount: p.amount,
        description: p.description || p.payment_mode || 'Customer Payment',
        reference_number: p.reference_number || p.payment_number || '',
        debit_or_credit: 'debit' as const,
        status: p.payment_status === 'paid' ? 'categorized' : 'uncategorized',
        account_id: p.account_id || ICICI_ACCOUNT_ID,
        party_name: p.customer_name,
        _source: 'MANUAL PAYMENT' as const,
        _normalizedParty: (p.customer_name || parseCompanyName(p.description) || '').toUpperCase().trim(),
        _timestamp: timestamp,
        displayDate
      };
    });

    // Deduplicate
    const merged = new Map<string, any>();
    
    // Add all bank feeds first
    bankFeed.forEach(b => {
      // Use unique key for the transaction itself to avoid collisions between same-amount/same-party txns
      // but for lookup we'll scan values
      merged.set(b.statement_id || b.transaction_id || Math.random().toString(), b);
    });

    // Merge manual payments safely
    customerPayments.forEach(p => {
      // Check if it exists in bank feed
      // Match by exact amount AND (either reference matches OR normalized party matches)
      // Within few minutes tolerance (we skip exact time tolerance for now as dates match and amount/party is usually unique enough for a single day)
      let duplicateKey = null;
      let duplicateItem = null;

      for (const [key, b] of merged.entries()) {
        if (b._source === 'BANK FEED' && b.amount === p.amount) {
          const isRefMatch = p.reference_number && b.reference_number && p.reference_number === b.reference_number;
          const isPartyMatch = p._normalizedParty && b._normalizedParty && (p._normalizedParty.includes(b._normalizedParty) || b._normalizedParty.includes(p._normalizedParty));
          
          if (isRefMatch || isPartyMatch) {
            duplicateKey = key;
            duplicateItem = b;
            break;
          }
        }
      }

      if (duplicateKey && duplicateItem) {
        duplicatesRemoved++;
        merged.set(duplicateKey, {
          ...duplicateItem,
          _source: 'MERGED',
          party_name: p.party_name || duplicateItem.party_name,
          payment_id: p.payment_id
        });
      } else {
        merged.set(p.payment_id || Math.random().toString(), p);
      }
    });

    return { 
      mergedTransactions: Array.from(merged.values()) as ZohoTransaction[], 
      mergeStats: { feedCount, manualCount, duplicatesRemoved, finalCount: merged.size }
    };
  }, [statements, payments, activeViewingDate]);


  // Apply Sorting
  const sortedTransactions = useMemo(() => {
    return [...mergedTransactions].sort((a, b) => {
      const idA = a.transaction_id || a.statement_id || a.payment_id || '';
      const idB = b.transaction_id || b.statement_id || b.payment_id || '';
      const timeA = a._timestamp || 0;
      const timeB = b._timestamp || 0;
      
      if (sortOption === 'Latest First') return timeB - timeA || idB.localeCompare(idA);
      if (sortOption === 'Oldest First') return timeA - timeB || idA.localeCompare(idB);
      if (sortOption === 'Highest Amount') return Math.abs(b.amount) - Math.abs(a.amount);
      if (sortOption === 'Lowest Amount') return Math.abs(a.amount) - Math.abs(b.amount);
      return 0;
    });
  }, [mergedTransactions, sortOption]);

  // Client-side Filter Application
  const filteredTransactions = useMemo(() => {
    return sortedTransactions.filter(txn => {
      // 1. Payment Method Filter
      if (selectedMethod) {
        const method = parsePaymentMethod(txn.description);
        if (method !== selectedMethod) return false;
      }
      // 2. Party Filter
      if (selectedParty) {
        const isUncategorized = txn.status !== 'categorized';
        let companyName = null;
        if (!isUncategorized) {
          companyName = txn.party_name || txn.contact_name || txn.payee || txn.rule_name || parseCompanyName(txn.description);
        } else {
          companyName = parseCompanyName(txn.description);
        }
        const partyKey = companyName || 'UNKNOWN PARTY';
        if (partyKey !== selectedParty) return false;
      }
      // 3. Uncategorized Only Filter
      if (uncategorizedOnly) {
        const isUncat = txn.status?.toLowerCase() !== 'categorized';
        if (!isUncat) return false;
      }
      return true;
    });
  }, [sortedTransactions, selectedMethod, selectedParty, uncategorizedOnly]);

  const handleFetch = async (targetDate?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let url = '/api/staff/bank/transactions';
      if (targetDate) {
        url += `?from_date=${targetDate}&to_date=${targetDate}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch bank feed');
      }

      if (json.data && json.data.statements) {
        setStatements(json.data.statements);
        setPayments(json.data.payments);
        setActiveViewingDate(targetDate || getTodayIST());
      } else {
        // Fallback for old API format
        setStatements(Array.isArray(json.data) ? json.data : []);
        setActiveViewingDate(targetDate || getTodayIST());
      }
      
      setTelemetry(json.telemetry);
      
      const now = Date.now();
      setLastRefresh(now);
      
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.data, telemetry: json.telemetry }));
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
      
      toast.success('Live feed synchronized');
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to sync bank feed');
    } finally {
      setLoading(false);
    }
  };

  // Summary Calcs
  const totalCredits = useMemo(() => filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0), [filteredTransactions]);
  const categorizedCount = useMemo(() => filteredTransactions.filter(t => t.status === 'categorized').length, [filteredTransactions]);
  const uncategorizedCount = filteredTransactions.length - categorizedCount;
  const avgTransaction = filteredTransactions.length > 0 ? totalCredits / filteredTransactions.length : 0;
  const largestTransaction = filteredTransactions.length > 0 ? Math.max(...filteredTransactions.map(t => Math.abs(t.amount))) : 0;

  // Party Calcs
  const topParties = useMemo(() => {
    const parties: Record<string, { count: number, total: number }> = {};
    filteredTransactions.forEach(t => {
      const isUncategorized = t.status !== 'categorized';
      let companyName = null;
      
      if (!isUncategorized) {
         companyName = t.party_name || t.contact_name || t.payee || t.rule_name || parseCompanyName(t.description);
      } else {
         companyName = parseCompanyName(t.description);
      }
      
      const key = companyName || 'UNKNOWN PARTY';
      
      if (!parties[key]) parties[key] = { count: 0, total: 0 };
      parties[key].count += 1;
      parties[key].total += Math.abs(t.amount);
    });
    
    return Object.entries(parties)
      .map(([name, stats]) => ({ name, ...stats }))
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total); // Show ALL parties without truncation
  }, [filteredTransactions]);

  const paymentMethods = useMemo(() => {
    const methods = { 
      'BANK TRANSFER': { count: 0, total: 0 }, 
      CASH: { count: 0, total: 0 }, 
      OTHER: { count: 0, total: 0 } 
    };
    let totalAmount = 0;
    
    filteredTransactions.forEach(t => {
      const method = parsePaymentMethod(t.description);
      if (methods[method as keyof typeof methods]) {
        methods[method as keyof typeof methods].count += 1;
        methods[method as keyof typeof methods].total += Math.abs(t.amount);
        totalAmount += Math.abs(t.amount);
      }
    });
    
    return Object.entries(methods).map(([name, stats]) => ({
      name,
      count: stats.count,
      total: stats.total,
      percentage: totalAmount > 0 ? (stats.total / totalAmount) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  const methodColors = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const isToday = activeViewingDate === getTodayIST();
  const displayDateStr = isToday ? "Today" : new Date(activeViewingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-[#1A2766]" />
            Unified Feed
          </h2>
          <p className="text-sm text-gray-500">
            Showing incoming credits for <span className="font-semibold text-gray-700">KAMNA TRADERS ICICI</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100">
              Last synced at {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(lastRefresh))}
            </span>
          )}
          <div className="flex items-center ml-2 mr-2">
            <button 
              onClick={() => dateInputRef.current?.showPicker()} 
              disabled={loading} 
              className="px-3 py-2 text-sm rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 bg-[#1A2766]/10 hover:bg-[#1A2766]/20 text-[#1A2766]"
            >
              <Calendar size={16} /> Fetch Previous Date
            </button>
            <input 
              type="date" 
              ref={dateInputRef} 
              className="w-0 h-0 p-0 m-0 border-0 absolute" 
              max={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
              onChange={(e) => {
                 if (e.target.value) {
                   handleFetch(e.target.value);
                 }
              }}
            />
          </div>

          <button
            onClick={() => handleFetch()}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
              loading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#1A2766] text-white hover:bg-[#003347]'
            }`}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Syncing...' : 'Fetch Feed'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <div>
            <h3 className="font-semibold text-sm">Failed to load feed</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        
        {/* Left: Table (70%) */}
        <div className="w-full lg:w-[70%] bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[600px]">
          
          {/* Quick Filter Status Toggler */}
          <div className="bg-gray-50/50 p-3 border-b border-gray-200 flex flex-col gap-2 select-none shrink-0">
            <div className="flex items-center gap-6 text-xs font-semibold text-gray-700">
              <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px] bg-gray-200/60 px-1.5 py-0.5 rounded">
                Show
              </span>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="statusFilter"
                  checked={!uncategorizedOnly}
                  onChange={() => setUncategorizedOnly(false)}
                  className="w-4 h-4 text-[#1A2766] border-gray-300 focus:ring-[#1A2766] cursor-pointer transition-all accent-[#1A2766]"
                />
                <span className="group-hover:text-gray-900 transition-colors">All Transactions</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="statusFilter"
                  checked={uncategorizedOnly}
                  onChange={() => setUncategorizedOnly(true)}
                  className="w-4 h-4 text-[#1A2766] border-gray-300 focus:ring-[#1A2766] cursor-pointer transition-all accent-[#1A2766]"
                />
                <span className="group-hover:text-gray-900 transition-colors flex items-center gap-1.5">
                  Uncategorized Only
                  {uncategorizedCount > 0 && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-black tracking-wider animate-pulse">
                      {uncategorizedCount}
                    </span>
                  )}
                </span>
              </label>
            </div>

            {/* Filter Chips Bar */}
            {(selectedMethod || selectedParty || uncategorizedOnly) && (
              <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Active Filters:</span>
                {selectedMethod && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-800 shadow-sm transition-all hover:bg-blue-100/70">
                    Payment Method: {selectedMethod}
                    <button 
                      onClick={() => setSelectedMethod(null)} 
                      className="hover:bg-blue-200/60 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold ml-1 transition-colors focus:outline-none"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedParty && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 border border-purple-200 text-purple-800 shadow-sm transition-all hover:bg-purple-100/70">
                    Party: {selectedParty}
                    <button 
                      onClick={() => setSelectedParty(null)} 
                      className="hover:bg-purple-200/60 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold ml-1 transition-colors focus:outline-none"
                    >
                      ×
                    </button>
                  </span>
                )}
                {uncategorizedOnly && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 border border-amber-250 text-amber-800 shadow-sm transition-all hover:bg-amber-100/70">
                    UNCATEGORIZED
                    <button 
                      onClick={() => setUncategorizedOnly(false)} 
                      className="hover:bg-amber-200/60 rounded-full w-4 h-4 inline-flex items-center justify-center font-bold ml-1 transition-colors focus:outline-none"
                    >
                      ×
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedMethod(null);
                    setSelectedParty(null);
                    setUncategorizedOnly(false);
                  }}
                  className="text-[11px] font-black text-red-600 hover:text-red-750 ml-2 hover:underline focus:outline-none transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Table Toolbar */}
          <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-2">
              {filteredTransactions.length} Transactions
            </span>
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} className="text-gray-400" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="text-xs font-semibold bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#1A2766]"
              >
                <option value="Latest First">Latest First</option>
                <option value="Oldest First">Oldest First</option>
                <option value="Highest Amount">Highest Amount</option>
                <option value="Lowest Amount">Lowest Amount</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Party / Description</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      <RefreshCw className="mx-auto animate-spin mb-2" size={24} />
                      Syncing live data...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      No matching transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((txn) => {
                    const isUncategorized = txn.status !== 'categorized';
                    
                    let companyName = null;
                    if (!isUncategorized) {
                       companyName = txn.party_name || txn.contact_name || txn.payee || txn.rule_name || parseCompanyName(txn.description);
                    } else {
                       companyName = parseCompanyName(txn.description);
                    }

                    return (
                      <tr key={txn.transaction_id || txn.statement_id || txn.payment_id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-3 py-1.5 text-xs text-gray-600 font-medium whitespace-nowrap align-top">
                          {txn.displayDate}
                        </td>
                        <td className="px-3 py-1.5 align-top whitespace-nowrap">
                          {txn._source === 'BANK FEED' && <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Bank Feed</span>}
                          {txn._source === 'MANUAL PAYMENT' && <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Manual</span>}
                          {txn._source === 'MERGED' && <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Merged</span>}
                        </td>
                        <td className="px-3 py-1.5 text-xs align-top">
                          {companyName ? (
                            <>
                              <div className="font-bold text-gray-900 leading-tight mb-0.5">
                                {companyName}
                              </div>
                              <div className="leading-snug text-gray-500 text-[10px]">
                                {txn.description}
                              </div>
                            </>
                          ) : (
                            <div className="leading-snug font-medium text-gray-800 text-[11px]">
                              {txn.description}
                            </div>
                          )}
                          {txn.reference_number && (
                            <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                              Ref: {txn.reference_number}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-xs font-medium align-top">
                          {isUncategorized ? (
                            <span className="inline-block bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
                              Uncategorized
                            </span>
                          ) : (
                            <span className="inline-block bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
                              Categorized
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-sm text-right font-bold text-emerald-600 whitespace-nowrap align-top">
                          {formatINR(Math.abs(txn.amount))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Summary Sidebar (30%) */}
        <div className="w-full lg:w-[30%] space-y-4 sticky top-4 h-fit">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-2">
              {isToday ? "Today's" : displayDateStr} Overview
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Credits</p>
                <p className="text-lg font-black text-emerald-600 leading-none mt-1">{formatINR(totalCredits)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Txns</p>
                <p className="text-lg font-black text-gray-800 leading-none mt-1">{filteredTransactions.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Avg Txn</p>
                <p className="text-sm font-bold text-gray-700 mt-1">{formatINR(avgTransaction)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Largest Txn</p>
                <p className="text-sm font-bold text-emerald-600 mt-1">{formatINR(largestTransaction)}</p>
              </div>
            </div>
          </div>

          {/* Top Parties */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[320px] select-none">
            <div className="p-3 border-b border-gray-100 bg-white z-10 sticky top-0">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest">
                Top Parties
              </h3>
            </div>
            <div className="p-3 overflow-y-auto space-y-2 flex-1 scroll-smooth">
              {topParties.length === 0 ? (
                <p className="text-xs text-gray-400 text-center">No party data available.</p>
              ) : (
                topParties.map(p => (
                  <div 
                    key={p.name} 
                    onClick={() => setSelectedParty(selectedParty === p.name ? null : p.name)}
                    className={`flex justify-between items-start p-2 rounded-lg border cursor-pointer transition-all duration-150 pl-2.5 border-l-4 ${
                      selectedParty === p.name 
                        ? 'bg-purple-50 border-purple-200 border-l-purple-600 text-purple-900 font-bold shadow-sm ring-1 ring-purple-300/30' 
                        : 'bg-white border-gray-100 hover:bg-slate-50 hover:border-gray-250 border-l-transparent'
                    }`}
                  >
                    <div className="flex-1 pr-2 overflow-hidden">
                      <p className="text-xs font-bold text-gray-800 leading-tight truncate" title={p.name}>{p.name}</p>
                      <p className="text-[10px] text-gray-405 font-medium">{p.count} transaction{p.count > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                      {formatINR(p.total)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment Methods Analytics */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3 flex justify-between">
              Payment Methods
              <PieChart size={14} className="text-gray-400" />
            </h3>
            
            {paymentMethods.length > 0 ? (
              <div className="flex items-center gap-3 mb-3 select-none">
                <div className="scale-90 origin-left">
                  <DonutChart data={paymentMethods} />
                </div>
                <div className="flex-1 space-y-1.5">
                  {paymentMethods.slice(0, 3).map((m, i) => (
                    <div 
                      key={m.name} 
                      onClick={() => setSelectedMethod(selectedMethod === m.name ? null : m.name)}
                      className={`flex items-center text-[11px] cursor-pointer hover:underline ${
                        selectedMethod === m.name ? 'text-[#1A2766] font-bold' : 'text-gray-700'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: methodColors[i % methodColors.length] }}></span>
                      <span className="flex-1 truncate">{m.name}</span>
                      <span className="text-gray-500 font-medium ml-1">{m.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3 text-center">No payment methods found.</p>
            )}

             <div className="space-y-1.5 select-none">
              {paymentMethods.map((m, i) => (
                <div 
                  key={m.name} 
                  onClick={() => setSelectedMethod(selectedMethod === m.name ? null : m.name)}
                  className={`flex justify-between items-center p-2 rounded-lg border cursor-pointer transition-all duration-150 pl-2.5 border-l-4 ${
                    selectedMethod === m.name 
                      ? 'bg-emerald-50 border-emerald-200 border-l-emerald-600 text-emerald-900 font-bold shadow-sm ring-1 ring-emerald-300/30' 
                      : 'bg-white border-gray-100 hover:bg-slate-50 hover:border-gray-250 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: methodColors[i % methodColors.length] }}></span>
                    <span className="text-[11px] font-bold">{m.name}</span>
                    <span className="text-[9px] text-gray-400 px-1 py-0.5 bg-white rounded border border-gray-205">
                      {m.count} txn{m.count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700">{formatINR(m.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Debug Telemetry */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setDebugOpen(!debugOpen)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-[10px] font-black text-gray-500 hover:text-gray-700 uppercase tracking-widest hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Terminal size={14} /> Telemetry
              </div>
              {debugOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            
            {debugOpen && (
              <div className="p-3 bg-white border-t border-gray-200 text-[10px] font-mono space-y-1.5">
                {telemetry && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account ID:</span>
                      <span className="text-gray-800">{telemetry.accountId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-gray-800">{telemetry.durationMs}ms</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                      <span className="text-gray-400">Total Raw Statements:</span>
                      <span className="text-gray-800 font-bold">{telemetry.statementsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Raw Payments:</span>
                      <span className="text-gray-800 font-bold">{telemetry.paymentsCount}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">Bank Feed ({isToday ? 'Today' : displayDateStr}):</span>
                  <span className="font-semibold text-gray-900">{mergeStats.feedCount}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">Manual Payments ({isToday ? 'Today' : displayDateStr}):</span>
                  <span className="font-semibold text-gray-900">{mergeStats.manualCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duplicates Removed:</span>
                  <span className="text-amber-600 font-bold">{mergeStats.duplicatesRemoved}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                  <span className="text-gray-400">Final Merged Count:</span>
                  <span className="text-emerald-600 font-bold">{mergeStats.finalCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Uncategorized:</span>
                  <span className="text-amber-600 font-bold">{uncategorizedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Categorized:</span>
                  <span className="text-emerald-600 font-bold">{categorizedCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

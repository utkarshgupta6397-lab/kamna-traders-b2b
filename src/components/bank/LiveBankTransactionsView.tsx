'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RefreshCw, Terminal, CheckCircle2, AlertCircle, Building2, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface ZohoTransaction {
  transaction_id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  payee: string;
  description: string;
  reference_number: string;
  debit_or_credit: 'debit' | 'credit';
  status: string;
  transaction_type: string;
  account_id: string;
  imported_transactions?: { date?: string; amount?: number }[];
}

interface TelemetryData {
  accountName: string;
  accountId: string;
  endpoint: string;
  method: string;
  status: number;
  durationMs: number;
  recordCount: number;
}

const CACHE_KEY = 'kamna_bank_feed_v2_cache';
const CACHE_TIME_KEY = 'kamna_bank_feed_v2_time';
const CACHE_DURATION_MS = 120 * 1000; // 120 seconds
const ICICI_ACCOUNT_ID = '1759923000003416718';

type SortOption = 'Latest First' | 'Oldest First' | 'Highest Amount' | 'Lowest Amount';

function getTodayIST() {
  const date = new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 5.5)); // IST is +5:30
  return nd.toISOString().split('T')[0];
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

// Safely extract datetime combined string
function extractDateTime(txn: ZohoTransaction): { displayDate: string, timestamp: number } {
  const d = new Date(txn.date);
  let timeStr = '—';
  let timestamp = d.getTime();

  // Try to find time in imported_transactions if it's an ISO string
  if (txn.imported_transactions && txn.imported_transactions.length > 0) {
    const importedDate = txn.imported_transactions[0].date;
    if (importedDate && importedDate.includes('T')) {
      const parsed = new Date(importedDate);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed.getTime();
        timeStr = parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
      }
    }
  }

  // Fallback to description regex if timeStr is still default
  if (timeStr === '—' && txn.description) {
    const timeMatch = txn.description.match(/(\d{1,2}:\d{2}\s*[ap]m)/i);
    if (timeMatch) {
      timeStr = timeMatch[1].toLowerCase();
      // Rough timestamp adjustment for sorting (ignoring exact hours since date is today anyway, but gives rough order)
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

  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-IN', { month: 'short' });
  const year = d.getFullYear();
  
  const displayDate = timeStr !== '—' 
    ? `${day}-${month}-${year} ${timeStr}`
    : `${day}-${month}-${year}`;

  return { displayDate, timestamp };
}

export default function LiveBankTransactionsView() {
  const [transactions, setTransactions] = useState<ZohoTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<ZohoTransaction[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [debugOpen, setDebugOpen] = useState(false);
  
  const [sortOption, setSortOption] = useState<SortOption>('Latest First');

  const fetchTriggered = useRef(false);

  // Load from cache on mount
  useEffect(() => {
    if (fetchTriggered.current) return;
    fetchTriggered.current = true;

    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    
    const now = Date.now();
    
    if (cachedData && cachedTime) {
      const timeParsed = parseInt(cachedTime, 10);
      const age = now - timeParsed;
      
      if (age < CACHE_DURATION_MS) {
        try {
          const parsed = JSON.parse(cachedData);
          setTransactions(parsed.data || []);
          setTelemetry(parsed.telemetry || null);
          setLastRefresh(timeParsed);
          setCooldownRemaining(Math.ceil((CACHE_DURATION_MS - age) / 1000));
          return; // Use cache, don't fetch
        } catch (e) {
          console.error('Cache parse error', e);
        }
      }
    }
    
    handleFetch();
  }, []);

  // Update cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Apply filters whenever transactions change
  useEffect(() => {
    const todayIST = getTodayIST();
    
    const filtered = transactions.filter(txn => {
      return (
        txn.account_id === ICICI_ACCOUNT_ID &&
        txn.debit_or_credit === 'debit' &&
        txn.date === todayIST
      );
    });

    setFilteredTransactions(filtered);
  }, [transactions]);

  // Apply Sorting
  const sortedTransactions = useMemo(() => {
    const withTime = filteredTransactions.map(t => ({
      ...t,
      ...extractDateTime(t)
    }));

    return withTime.sort((a, b) => {
      if (sortOption === 'Latest First') return b.timestamp - a.timestamp || b.transaction_id.localeCompare(a.transaction_id);
      if (sortOption === 'Oldest First') return a.timestamp - b.timestamp || a.transaction_id.localeCompare(b.transaction_id);
      if (sortOption === 'Highest Amount') return Math.abs(b.amount) - Math.abs(a.amount);
      if (sortOption === 'Lowest Amount') return Math.abs(a.amount) - Math.abs(b.amount);
      return 0;
    });
  }, [filteredTransactions, sortOption]);

  const handleFetch = async () => {
    if (cooldownRemaining > 0) {
      toast.error(`Please wait ${cooldownRemaining}s before refreshing`);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/staff/bank/transactions');
      const json = await res.json();
      
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch bank feed');
      }

      setTransactions(json.data);
      setTelemetry(json.telemetry);
      
      const now = Date.now();
      setLastRefresh(now);
      setCooldownRemaining(120);
      
      // Save to cache
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
  const totalCredits = sortedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const categorizedCount = sortedTransactions.filter(t => t.status === 'categorized').length;
  const uncategorizedCount = sortedTransactions.length - categorizedCount;

  // Party Calcs
  const topParties = useMemo(() => {
    const parties: Record<string, { count: number, total: number }> = {};
    sortedTransactions.forEach(t => {
      const key = t.payee || 'UNKNOWN PARTY';
      if (!parties[key]) parties[key] = { count: 0, total: 0 };
      parties[key].count += 1;
      parties[key].total += Math.abs(t.amount);
    });
    
    return Object.entries(parties)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Top 5
  }, [sortedTransactions]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-[#1A2766]" />
            Live Bank Feed
          </h2>
          <p className="text-sm text-gray-500">
            Showing today's incoming credits for <span className="font-semibold text-gray-700">KAMNA TRADERS ICICI</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-500">
              Updated: {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleFetch}
            disabled={loading || cooldownRemaining > 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
              cooldownRemaining > 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#1A2766] text-white hover:bg-[#003347]'
            }`}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Syncing...' : cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : 'Refresh Feed'}
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
          
          {/* Table Toolbar */}
          <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-2">
              {sortedTransactions.length} Transactions
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
                  <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Party / Description</th>
                  <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && sortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-gray-400">
                      <RefreshCw className="mx-auto animate-spin mb-2" size={24} />
                      Syncing live data...
                    </td>
                  </tr>
                ) : sortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-gray-400">
                      No incoming credits found for today.
                    </td>
                  </tr>
                ) : (
                  sortedTransactions.map((txn) => {
                    const isUncategorized = txn.status !== 'categorized';
                    const hasPayee = !!txn.payee;

                    return (
                      <tr key={txn.transaction_id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-3 py-2 text-xs text-gray-600 font-medium whitespace-nowrap align-top">
                          {txn.displayDate}
                          {isUncategorized && (
                            <div className="mt-1">
                              <span className="inline-block bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
                                Uncategorized
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs align-top">
                          {hasPayee && (
                            <div className="font-bold text-gray-900 leading-tight mb-0.5">
                              {txn.payee}
                            </div>
                          )}
                          <div className={`leading-snug ${hasPayee ? 'text-gray-500 text-[11px]' : 'font-medium text-gray-800'}`}>
                            {txn.description}
                          </div>
                          {txn.reference_number && (
                            <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                              Ref: {txn.reference_number}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-emerald-600 whitespace-nowrap align-top">
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
        <div className="w-full lg:w-[30%] space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-2">
              Today's Feed Summary
            </h3>
            
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Total Credits</p>
                <p className="text-2xl font-black text-emerald-600 leading-none mt-1">{formatINR(totalCredits)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Categorized</p>
                  <p className="text-sm font-bold text-gray-800">{categorizedCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Uncategorized</p>
                  <p className="text-sm font-bold text-amber-700">{uncategorizedCount}</p>
                </div>
              </div>
              
              <div className="pt-3 border-t border-gray-50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Sync Status</span>
                  {cooldownRemaining > 0 ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Active (Cached)
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <RefreshCw size={12} /> Ready to pull
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top Parties */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
              Top Parties Today
            </h3>
            <div className="space-y-3">
              {topParties.length === 0 ? (
                <p className="text-xs text-gray-400 text-center">No party data available.</p>
              ) : (
                topParties.map(p => (
                  <div key={p.name} className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <p className="text-xs font-bold text-gray-800 leading-tight truncate" title={p.name}>{p.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{p.count} transaction{p.count > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                      {formatINR(p.total)}
                    </div>
                  </div>
                ))
              )}
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
            
            {debugOpen && telemetry && (
              <div className="p-3 bg-white border-t border-gray-200 text-[10px] font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">Account ID:</span>
                  <span className="text-gray-800">{telemetry.accountId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-gray-800">{telemetry.durationMs}ms</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                  <span className="text-gray-400">Total Raw Fetched:</span>
                  <span className="text-gray-800 font-bold">{telemetry.recordCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Incoming Credits Today:</span>
                  <span className="text-emerald-600 font-bold">{filteredTransactions.length}</span>
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

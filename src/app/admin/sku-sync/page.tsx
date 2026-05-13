'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { 
  RefreshCw, AlertCircle, CheckCircle2, Download, Clock, Trash2, 
  Lock, X, Copy, FileJson, ChevronDown, ChevronRight, ClipboardCheck,
  Activity, Info, Filter, Search, History, Terminal, Database, ArrowRight,
  ShieldCheck, ShieldAlert, BarChart3, ScanEye
} from 'lucide-react';
import toast from 'react-hot-toast';

type ExecutionTrace = {
  sku: string;
  product: string;
  status: 'FETCHED' | 'FILTERED' | 'SKIPPED' | 'UPDATED' | 'CREATED' | 'FAILED' | 'RATE_LIMITED';
  action: string;
  reason: string;
  duration: number;
  timestamp: string;
  error?: any;
  forensic?: {
    sku: string;
    zohoId: string;
    decision: string;
    lookupField: string;
    lookupValue: string;
    matchedRecordId?: string;
    reason: string;
    idConflict?: boolean;
    conflictRecordId?: string;
    conflictZohoId?: string;
  };
};

type SkuSyncLog = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  trigger: string;
  syncLimit: number;
  totalReceived: number;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  metadata: {
    url: string;
    params: any;
    responseTimeMs: number;
    rawResponseSize: number;
    hasMorePage: boolean;
    sampleItemIds: string[];
    batches: any[];
    fullEmptyResponse?: any;
    preSyncAudit?: {
      skuCount: number;
      invCount: number;
      brandCount: number;
      catCount: number;
      existingSkuSamples: any[];
    };
    reconciliation?: {
      zohoReturned: number;
      processed: number;
      created: number;
      updated: number;
      skipped: number;
      failed: number;
      preSyncCount: number;
      postSyncCount: number;
      netChange: number;
      isConsistent: boolean;
    };
  };
  executionTrace: ExecutionTrace[];
};

export default function SkuSyncPage() {
  const [history, setHistory] = useState<SkuSyncLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SkuSyncLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLimit, setSyncLimit] = useState(10);
  
  // Debug Panels State
  const [showMetadata, setShowMetadata] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [traceSearch, setTraceSearch] = useState('');
  const [traceFilter, setTraceFilter] = useState('ALL');
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  // Hard Reset States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetPhrase, setResetPhrase] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/sku-sync/last-run');
      const json = await res.json();
      if (res.ok && json.history) {
        setHistory(json.history);
        if (!selectedLog) setSelectedLog(json.history[0] || null);
      }
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runSync = async () => {
    if (!confirm(`Are you sure you want to run the SKU sync with a limit of ${syncLimit || 'unlimited'}?`)) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin/sku-sync/run', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: syncLimit })
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Sync failed');

      toast.success('Synchronization completed');
      await fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleHardReset = async () => {
    if (resetStep < 3) {
      setResetStep(resetStep + 1);
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/hard-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: resetPhrase, pin: adminPin }),
      });
      if (!res.ok) throw new Error('Reset failed');

      toast.success('System reset successfully');
      setShowResetModal(false);
      setResetStep(1);
      setResetPhrase('');
      setAdminPin('');
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  const formatDateIST = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'Asia/Kolkata' 
    }).toUpperCase();
  };

  const copyToClipboard = (text: any, label: string) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    toast.success(`${label} copied!`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'UPDATED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'SKIPPED': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'FAILED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredTrace = (selectedLog?.executionTrace || []).filter(t => {
    const matchesSearch = traceSearch === '' || 
      t.sku.toLowerCase().includes(traceSearch.toLowerCase()) ||
      t.product.toLowerCase().includes(traceSearch.toLowerCase());
    const matchesFilter = traceFilter === 'ALL' || t.status === traceFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw size={24} className={isSyncing ? 'animate-spin text-blue-600' : 'text-[#1A2766]'} />
            SKU Sync Console
          </h1>
          <p className="text-sm text-gray-500 mt-1">Operational debugger and observability dashboard for Zoho catalog sync.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col px-3 border-r border-gray-100">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sync Limit</label>
            <input 
              type="number" 
              value={syncLimit}
              onChange={(e) => setSyncLimit(parseInt(e.target.value) || 0)}
              className="text-sm font-bold text-[#1A2766] focus:outline-none w-20"
              placeholder="All"
            />
          </div>
          <button
            onClick={runSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-6 py-2 bg-[#1A2766] text-white rounded-lg font-bold hover:bg-[#003347] transition-all disabled:opacity-50 shadow-sm h-full"
          >
            <Download size={18} />
            {isSyncing ? 'Running Sync...' : 'Trigger Manual Sync'}
          </button>
        </div>
      </div>

      {/* Reconciliation Red Alert */}
      {selectedLog?.metadata?.reconciliation && !selectedLog.metadata.reconciliation.isConsistent && (
        <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-lg animate-pulse flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldAlert size={32} />
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest">Reconciliation Red Alert</h2>
              <p className="text-sm font-medium opacity-90">Processed counts do not match Zoho response. Potential data leakage detected.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold opacity-70">MISMATCH</p>
            <p className="text-xl font-black">{selectedLog.metadata.reconciliation.zohoReturned} vs {selectedLog.metadata.reconciliation.processed}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: History */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <History size={16} />
                Sync History
              </h3>
              <button onClick={fetchHistory} className="text-gray-400 hover:text-blue-600 transition-colors">
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-gray-50">
              {history.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors relative group ${selectedLog?.id === log.id ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-gray-400 tracking-tighter">
                      {formatDateIST(log.startedAt).split(' ')[0]}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${log.trigger === 'USER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {log.trigger}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-900 mt-1 line-clamp-1">
                    {formatDateIST(log.startedAt).split(' ')[1]} {formatDateIST(log.startedAt).split(' ')[2]}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] text-emerald-600 font-bold">+{log.createdCount}</span>
                    <span className="text-[10px] text-blue-600 font-bold">~{log.updatedCount}</span>
                    <span className="text-[10px] text-red-600 font-bold">!{log.failedCount}</span>
                  </div>
                  {selectedLog?.id === log.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content: Observability Console */}
        <div className="lg:col-span-9 space-y-6">
          {selectedLog ? (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Received', value: selectedLog.totalReceived, icon: Download, color: 'text-gray-600', bg: 'bg-gray-100' },
                  { label: 'Processed', value: selectedLog.processedCount, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100' },
                  { label: 'Created/Updated', value: `${selectedLog.createdCount} / ${selectedLog.updatedCount}`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                  { label: 'Skipped/Failed', value: `${selectedLog.skippedCount} / ${selectedLog.failedCount}`, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>
                        <stat.icon size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <p className="text-xl font-black text-gray-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Forensic Audit Bar */}
              {selectedLog.metadata?.reconciliation && (
                <div className="bg-[#1A2766] text-white rounded-xl p-5 shadow-lg border-l-8 border-emerald-400 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <ShieldCheck className="text-emerald-400" size={32} />
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em]">Forensic Audit Status</h3>
                      <p className="text-xs text-blue-200 opacity-80 mt-0.5">Pre-Sync Count: {selectedLog.metadata.reconciliation.preSyncCount} → Post-Sync: {selectedLog.metadata.reconciliation.postSyncCount} (Net: {selectedLog.metadata.reconciliation.netChange > 0 ? '+' : ''}{selectedLog.metadata.reconciliation.netChange})</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-blue-300 block uppercase">Consistency</span>
                      <span className={`text-sm font-black ${selectedLog.metadata.reconciliation.isConsistent ? 'text-emerald-400' : 'text-red-400'}`}>
                        {selectedLog.metadata.reconciliation.isConsistent ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-blue-300 block uppercase">Duration</span>
                      <span className="text-sm font-black">{selectedLog.metadata.responseTimeMs}ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Debug Panels: Request & Response */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Zoho GET API Payload */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Terminal size={16} className="text-blue-600" />
                      Zoho GET API Payload
                    </span>
                    {showMetadata ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  {showMetadata && (
                    <div className="p-4 bg-gray-900 text-emerald-400 font-mono text-[11px] overflow-auto max-h-[300px] relative group">
                      <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                      <button 
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog.metadata, null, 2), 'API Metadata')}
                        className="absolute top-2 right-2 p-2 bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Zoho API Response Debug */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setShowResponse(!showResponse)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Database size={16} className="text-emerald-600" />
                      Zoho API Response Debug
                    </span>
                    {showResponse ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  {showResponse && (
                    <div className="p-4 space-y-3">
                      {selectedLog.metadata?.fullEmptyResponse && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                          <p className="text-xs font-bold text-red-700 flex items-center gap-2">
                            <AlertCircle size={14} />
                            Zero Records Warning
                          </p>
                          <pre className="mt-2 text-[10px] font-mono text-red-600 overflow-auto max-h-20">
                            {JSON.stringify(selectedLog.metadata.fullEmptyResponse, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 text-xs font-medium">
                        <div className="p-2 bg-gray-50 rounded border border-gray-100">
                          <span className="text-gray-500 block">Response Size</span>
                          <span className="text-gray-900 font-bold">{(selectedLog.metadata?.rawResponseSize / 1024).toFixed(2)} KB</span>
                        </div>
                        <div className="p-2 bg-gray-50 rounded border border-gray-100">
                          <span className="text-gray-500 block">Response Time</span>
                          <span className="text-gray-900 font-bold">{selectedLog.metadata?.responseTimeMs}ms</span>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded border border-gray-100 space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Sample SKU IDs</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedLog.metadata?.sampleItemIds?.map((id: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono">{id}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Trace Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="px-4 py-3 border-b border-gray-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-20">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Activity size={16} className="text-blue-600" />
                    Forensic Execution Trace
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search SKU or Name..."
                        value={traceSearch}
                        onChange={(e) => setTraceSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 bg-gray-100 border-none rounded-lg text-xs focus:ring-1 focus:ring-blue-500 w-48"
                      />
                    </div>
                    <select 
                      value={traceFilter}
                      onChange={(e) => setTraceFilter(e.target.value)}
                      className="px-2 py-1.5 bg-gray-100 border-none rounded-lg text-xs font-bold text-gray-600 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">All Status</option>
                      <option value="CREATED">Created</option>
                      <option value="UPDATED">Updated</option>
                      <option value="SKIPPED">Skipped</option>
                      <option value="FAILED">Failed</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Identity</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Forensic Decision</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lookup Logic</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTrace.map((trace, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50/50 transition-colors ${trace.status === 'FAILED' ? 'bg-red-50/20' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-[#1A2766] font-mono">{trace.sku}</span>
                              <span className="text-[10px] text-gray-500 line-clamp-1" title={trace.product}>{trace.product}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${trace.forensic?.decision === 'CREATE' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {trace.forensic?.decision || 'SKIP'}
                              </span>
                              <span className="text-[10px] text-gray-500 max-w-[200px] line-clamp-1" title={trace.forensic?.reason}>
                                {trace.forensic?.reason || trace.reason}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-black uppercase ${getStatusColor(trace.status)}`}>
                              {trace.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Field:</span>
                                <span className="text-[10px] font-mono text-gray-700">{trace.forensic?.lookupField}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Value:</span>
                                <span className="text-[10px] font-mono text-gray-700">{trace.forensic?.lookupValue}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            {trace.forensic?.matchedRecordId && (
                              <button 
                                onClick={() => copyToClipboard(trace.forensic!.matchedRecordId!, 'Matched ID')}
                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                title="Copy Matched ID"
                              >
                                <ScanEye size={14} />
                              </button>
                            )}
                            {trace.error && (
                              <button 
                                onClick={() => copyToClipboard(trace.error, `Error Trace: ${trace.sku}`)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-all"
                                title="Copy Error Payload"
                              >
                                <Terminal size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredTrace.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-20 text-center text-gray-400 italic">No forensic records found matching your filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Batch Visualization Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-6 overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Execution Batches:</span>
                  </div>
                  {selectedLog.metadata?.batches?.map((batch: any, i: number) => (
                    <div key={i} className="flex flex-col gap-0.5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-black text-gray-900">B{batch.index}</span>
                        <span className="text-[8px] text-gray-400">{batch.duration}ms</span>
                      </div>
                      <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="h-[700px] flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
              <RefreshCw size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a forensic run from history</p>
              <p className="text-sm">Or trigger a new manual sync above.</p>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-8 border-t border-gray-100">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">System Forensic Purge</h3>
              <p className="text-sm text-red-600 mt-1 max-w-xl leading-relaxed">
                Permanently deletes all SKU, Inventory, and Dispatch data. Use this ONLY if your local data is corrupted beyond repair.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="bg-red-600 text-white px-8 py-3 rounded-xl font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center gap-2"
          >
            Purge All Data
          </button>
        </div>
      </div>

      {/* Triple Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isResetting && setShowResetModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">System Hard Reset</h3>
              <button onClick={() => setShowResetModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-8">
              {resetStep === 1 && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto"><AlertCircle size={32} /></div>
                  <div className="space-y-2">
                    <p className="text-gray-900 font-bold text-xl">Are you absolutely sure?</p>
                    <p className="text-gray-500 text-sm italic">This action will destroy the entire catalog and transaction history.</p>
                  </div>
                </div>
              )}
              {resetStep === 2 && (
                <div className="space-y-4 text-center">
                  <p className="text-sm font-medium text-gray-700">Type <span className="font-bold text-red-600 uppercase tracking-widest">RESET EVERYTHING</span> to proceed:</p>
                  <input
                    type="text"
                    value={resetPhrase}
                    onChange={(e) => setResetPhrase(e.target.value)}
                    className="w-full border-2 border-red-100 rounded-xl px-4 py-3 focus:border-red-500 outline-none font-bold text-center"
                    autoFocus
                  />
                </div>
              )}
              {resetStep === 3 && (
                <div className="space-y-4 text-center">
                  <p className="text-sm font-medium text-gray-700">Authorize with Admin PIN:</p>
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full border-2 border-[#1A2766]/10 rounded-xl px-4 py-3 focus:border-[#1A2766] outline-none text-center text-3xl tracking-[0.5em] font-bold"
                    autoFocus
                  />
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 flex gap-3">
              <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold">Cancel</button>
              <button
                onClick={handleHardReset}
                disabled={isResetting || (resetStep === 2 && resetPhrase !== 'RESET EVERYTHING') || (resetStep === 3 && !adminPin)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {isResetting ? 'Processing...' : resetStep < 3 ? 'Continue' : 'Destroy & Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

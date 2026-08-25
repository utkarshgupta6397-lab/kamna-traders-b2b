'use client';

import React, { useState, useEffect } from 'react';
import { DevLogRun, DevLogEntry, DevLogStatus } from '@/lib/utils/DevLogger';
import { Bug, X, Trash2, Copy, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function DevConsole() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [runs, setRuns] = useState<DevLogRun[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());


  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    // Only mount in dev
    if (process.env.NODE_ENV === 'development') {
      setIsDev(true);
    }
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/debug/logs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (e) {
      console.error('Failed to fetch dev logs', e);
    }
  };

  useEffect(() => {
    if (!isOpen || !isDev) return;
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen, isDev]);

  const clearLogs = async () => {
    try {
      await fetch('/api/debug/logs', { method: 'DELETE' });
      setRuns([]);
      setExpandedRuns(new Set());
      setExpandedEntries(new Set());
    } catch (e) {
      console.error('Failed to clear logs', e);
    }
  };

  const copyRunJson = (run: DevLogRun) => {
    navigator.clipboard.writeText(JSON.stringify(run, null, 2));
    setCopiedId(run.runId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleRun = (runId: string) => {
    const newSet = new Set(expandedRuns);
    if (newSet.has(runId)) newSet.delete(runId);
    else newSet.add(runId);
    setExpandedRuns(newSet);
  };

  const toggleEntry = (entryId: string) => {
    const newSet = new Set(expandedEntries);
    if (newSet.has(entryId)) newSet.delete(entryId);
    else newSet.add(entryId);
    setExpandedEntries(newSet);
  };

  if (!isDev) return null;
  if (pathname?.startsWith('/mobile')) return null;

  const getStatusColor = (status: DevLogStatus) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-500';
      case 'ERROR': return 'text-red-500';
      case 'WARNING': return 'text-amber-500';
      default: return 'text-blue-500';
    }
  };

  const getStatusBg = (status: DevLogStatus) => {
    switch (status) {
      case 'SUCCESS': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'ERROR': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'WARNING': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      default: return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-16 right-4 z-50 p-3 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
        title="Debug Console"
      >
        <Bug size={20} />
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-[500px] bg-white dark:bg-gray-900 shadow-2xl z-[100] flex flex-col border-l border-gray-200 dark:border-gray-800 transform transition-transform duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
            <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold">
              <Bug size={18} />
              <span>Dev Console</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={clearLogs} className="text-gray-500 hover:text-red-500 transition-colors" title="Clear Logs">
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-gray-900/50">
            {runs.length === 0 ? (
              <div className="text-center text-gray-500 mt-10 text-sm">No dev logs available.</div>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => (
                  <div key={run.runId} className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden text-sm">
                    {/* Run Header */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => toggleRun(run.runId)}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        {expandedRuns.has(run.runId) ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200 truncate">{run.module}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">{new Date(run.timestamp).toLocaleTimeString()} • {run.runId.substring(0, 8)}...</div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); copyRunJson(run); }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors rounded"
                        title="Copy Run JSON"
                      >
                        {copiedId === run.runId ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    {/* Run Entries */}
                    {expandedRuns.has(run.runId) && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {run.entries.map((entry, idx) => (
                          <div key={entry.id} className="p-3 hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                            <div 
                              className="flex items-start justify-between cursor-pointer group"
                              onClick={() => toggleEntry(entry.id)}
                            >
                              <div className="flex items-start gap-2 flex-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 whitespace-nowrap ${getStatusBg(entry.status)}`}>
                                  {entry.status}
                                </span>
                                <div>
                                  <div className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{entry.event}</div>
                                  <div className="text-xs text-gray-400 mt-0.5 font-mono">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                                </div>
                              </div>
                              <div className="text-gray-300 dark:text-gray-600 mt-0.5">
                                {expandedEntries.has(entry.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </div>

                            {/* Entry Details */}
                            {expandedEntries.has(entry.id) && (
                              <div className="mt-3 pl-2 ml-2 border-l-2 border-gray-100 dark:border-gray-800 space-y-3 text-xs font-mono overflow-x-auto">
                                {entry.error && (
                                  <div>
                                    <div className="text-red-500 font-semibold mb-1">Error:</div>
                                    <div className="text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded whitespace-pre-wrap break-all">{entry.error}</div>
                                  </div>
                                )}
                                {entry.input && (
                                  <div>
                                    <div className="text-gray-500 mb-1">Input:</div>
                                    <pre className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(entry.input, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {entry.output && (
                                  <div>
                                    <div className="text-gray-500 mb-1">Output:</div>
                                    <pre className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(entry.output, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

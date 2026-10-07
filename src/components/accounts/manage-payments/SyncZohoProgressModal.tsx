'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Landmark,
  Layers,
  ArrowRight,
  Database,
  ShieldCheck,
  Check,
  Zap,
} from 'lucide-react';
import {
  CustomerPaymentSyncEvent,
  SyncProgressCounters,
  SyncFinalSummary,
} from '@/lib/types/customer-payment-sync-events';

interface SyncZohoProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncRunId: string | null;
  allowZohoWrites?: boolean;
  onSyncCompleted?: () => void;
}

export default function SyncZohoProgressModal({
  isOpen,
  onClose,
  syncRunId,
  onSyncCompleted,
}: SyncZohoProgressModalProps) {
  const [status, setStatus] = useState<'CONNECTING' | 'LIVE' | 'COMPLETED' | 'FAILED'>('CONNECTING');
  const [currentOperation, setCurrentOperation] = useState<string>('Initializing synchronization...');
  const [events, setEvents] = useState<CustomerPaymentSyncEvent[]>([]);
  const [counters, setCounters] = useState<SyncProgressCounters>({
    paymentsDiscovered: 0,
    paymentsProcessed: 0,
    paymentsSkipped: 0,
    detailCalls: 0,
    cacheHits: 0,
    updateCalls: 0,
    verified: 0,
    verificationFailures: 0,
    currentOperation: 'Initializing...',
  });
  const [listCallsCount, setListCallsCount] = useState<number>(0);
  const [finalSummary, setFinalSummary] = useState<SyncFinalSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const eventListRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isTerminalRef = useRef<boolean>(false);

  // Timer for elapsed seconds
  useEffect(() => {
    if (!isOpen || status === 'COMPLETED' || status === 'FAILED') return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, status]);

  // Connect to SSE stream whenever isOpen & syncRunId changes
  useEffect(() => {
    if (!isOpen || !syncRunId) return;

    setStatus('CONNECTING');
    setCurrentOperation('Connecting to live sync stream...');
    setStartTime(new Date());
    setElapsedSeconds(0);
    setEvents([]);
    setErrorMessage(null);
    setFinalSummary(null);
    setListCallsCount(0);
    setCounters({
      paymentsDiscovered: 0,
      paymentsProcessed: 0,
      paymentsSkipped: 0,
      detailCalls: 0,
      cacheHits: 0,
      updateCalls: 0,
      verified: 0,
      verificationFailures: 0,
      currentOperation: 'Connecting...',
    });

    isTerminalRef.current = false;

    const es = new EventSource(`/api/staff/accounts/payment-verification/sync/events?syncRunId=${encodeURIComponent(syncRunId)}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!isTerminalRef.current) {
        setStatus('LIVE');
      }
    };

    const handleIncomingEvent = (eventDataStr: string) => {
      // If modal already reached terminal state, ignore any further incoming events
      if (isTerminalRef.current) return;

      try {
        const ev: CustomerPaymentSyncEvent = JSON.parse(eventDataStr);

        // Sync run isolation: strictly ignore events belonging to other sync runs
        if (ev.syncRunId && ev.syncRunId !== syncRunId) {
          return;
        }

        setEvents((prev) => [...prev, ev]);

        if (ev.type === 'SYNC_STARTED') {
          setStatus('LIVE');
          setCurrentOperation(`Started sync (${ev.startDate} to ${ev.endDate})...`);
        } else if (ev.type === 'PAYMENT_LIST_STARTED') {
          setCurrentOperation(`Fetching Zoho payment list page ${ev.page}...`);
        } else if (ev.type === 'PAYMENT_LIST_COMPLETED') {
          setListCallsCount((c) => c + 1);
          setCounters((prev) => ({
            ...prev,
            paymentsDiscovered: prev.paymentsDiscovered + ev.recordsReturned,
          }));
          setCurrentOperation(`Fetched page ${ev.page} (${ev.recordsReturned} payments)`);
        } else if (ev.type === 'PAYMENT_DETAIL_STARTED') {
          setCurrentOperation(`Fetching details for ${ev.paymentNumber}...`);
        } else if (ev.type === 'PAYMENT_DETAIL_COMPLETED') {
          setCounters((prev) => ({
            ...prev,
            detailCalls: prev.detailCalls + 1,
          }));
          setCurrentOperation(`Processed detail for ${ev.paymentNumber} (${ev.bankMatchStatus})`);
        } else if (ev.type === 'PAYMENT_CACHE_HIT') {
          setCounters((prev) => ({
            ...prev,
            cacheHits: prev.cacheHits + 1,
          }));
          setCurrentOperation(`Using cached bank match for ${ev.paymentNumber}`);
        } else if (ev.type === 'PAYMENT_SKIPPED_NON_BANK') {
          setCounters((prev) => ({
            ...prev,
            paymentsSkipped: prev.paymentsSkipped + 1,
          }));
        } else if (ev.type === 'AUTO_VERIFICATION_STARTED') {
          setCurrentOperation(`Auto-verifying ${ev.paymentNumber} in Zoho Books...`);
        } else if (ev.type === 'PAYMENT_UPDATE_STARTED') {
          // Track initiation if needed
        } else if (ev.type === 'PAYMENT_UPDATE_COMPLETED') {
          setCounters((prev) => ({
            ...prev,
            updateCalls: prev.updateCalls + 1,
          }));
        } else if (ev.type === 'AUTO_VERIFICATION_COMPLETED') {
          if (ev.zohoUpdateSuccess) {
            setCounters((prev) => ({
              ...prev,
              verified: prev.verified + 1,
            }));
            setCurrentOperation(`Verified ${ev.paymentNumber} successfully`);
          } else {
            setCounters((prev) => ({
              ...prev,
              verificationFailures: prev.verificationFailures + 1,
            }));
            setCurrentOperation(`Verification failed for ${ev.paymentNumber}`);
          }
        } else if (ev.type === 'SYNC_PROGRESS') {
          setCounters((prev) => ({
            ...prev,
            paymentsDiscovered: ev.paymentsDiscovered,
            paymentsProcessed: ev.paymentsProcessed,
            paymentsSkipped: ev.paymentsSkipped,
            detailCalls: ev.detailCalls,
            cacheHits: ev.cacheHits,
            updateCalls: ev.updateCalls,
            verified: ev.verified,
            verificationFailures: ev.verificationFailures,
            currentOperation: ev.currentOperation,
          }));
          if (ev.currentOperation) {
            setCurrentOperation(ev.currentOperation);
          }
        } else if (ev.type === 'SYNC_COMPLETED') {
          // Terminal state: Freeze everything and close SSE stream immediately
          isTerminalRef.current = true;
          setStatus('COMPLETED');
          setCurrentOperation('Sync completed successfully.');
          setFinalSummary(ev.finalSummary);

          // Freeze counters to exact final summary totals
          setListCallsCount(ev.finalSummary.paymentListCalls);
          setCounters({
            paymentsDiscovered: ev.finalSummary.paymentsDiscovered,
            paymentsProcessed: ev.finalSummary.paymentsProcessed,
            paymentsSkipped: ev.finalSummary.skipped,
            detailCalls: ev.finalSummary.paymentDetailCalls,
            cacheHits: ev.finalSummary.cacheHits,
            updateCalls: ev.finalSummary.paymentUpdateCalls,
            verified: ev.finalSummary.successfullyVerified,
            verificationFailures: ev.finalSummary.verificationFailures,
            currentOperation: 'Sync completed.',
          });

          // Terminate EventSource to prevent any reconnection or late event reception
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          if (onSyncCompleted) {
            onSyncCompleted();
          }
        } else if (ev.type === 'SYNC_FAILED') {
          // Terminal failure state
          isTerminalRef.current = true;
          setStatus('FAILED');
          setCurrentOperation(`Sync failed at stage ${ev.stage}`);
          setErrorMessage(ev.error);

          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        }
      } catch (err) {
        console.error('[SyncModal] Failed to parse SSE event:', err);
      }
    };

    // Use single standard onmessage listener (SSE route formats payloads as data: ...)
    es.onmessage = (e) => {
      handleIncomingEvent(e.data);
    };

    es.onerror = () => {
      // If completed or failed, close the stream permanently
      if (isTerminalRef.current || status === 'COMPLETED' || status === 'FAILED') {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    };

    return () => {
      isTerminalRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, syncRunId]);

  // Auto-scroll event history to bottom while sync is running
  useEffect(() => {
    if (status === 'LIVE' || status === 'CONNECTING') {
      if (eventListRef.current) {
        eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
      }
    }
  }, [events, status]);

  if (!isOpen) return null;

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const autoVerificationEvents = events.filter(
    (e) =>
      e.type === 'AUTO_VERIFICATION_STARTED' ||
      e.type === 'AUTO_VERIFICATION_COMPLETED' ||
      e.type === 'PAYMENT_UPDATE_COMPLETED'
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ── HEADER ── */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1A2766]/10 text-[#1A2766] rounded-xl">
              <RotateCw
                size={20}
                className={status === 'LIVE' || status === 'CONNECTING' ? 'animate-spin' : ''}
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-[#1A2766]">Sync Zoho Data</h2>
                {status === 'LIVE' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                    LIVE
                  </span>
                )}
                {status === 'CONNECTING' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    CONNECTING
                  </span>
                )}
                {status === 'COMPLETED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={11} />
                    COMPLETED
                  </span>
                )}
                {status === 'FAILED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                    <AlertCircle size={11} />
                    FAILED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-center gap-2">
                <span>Started: {startTime ? startTime.toLocaleTimeString() : '...'}</span>
                <span>•</span>
                <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
                {syncRunId && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-[10px] text-gray-400">ID: {syncRunId.substring(0, 16)}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── LIVE CURRENT OPERATION BANNER ── */}
        <div className="bg-[#F8FAFC] border-b border-gray-200 px-6 py-2.5 shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 truncate">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              Current Activity:
            </span>
            <span className="font-bold text-gray-800 truncate">{currentOperation}</span>
          </div>
        </div>

        {/* ── KPI COUNTERS STRIP ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2 p-4 bg-gray-50/60 border-b border-gray-200 shrink-0 text-center">
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-500 block truncate">Discovered</span>
            <span className="text-base font-black text-gray-900 font-mono">
              {counters.paymentsDiscovered}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-500 block truncate">Processed</span>
            <span className="text-base font-black text-gray-900 font-mono">
              {counters.paymentsProcessed}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-blue-600 block truncate">List Calls</span>
            <span className="text-base font-black text-blue-700 font-mono">{listCallsCount}</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-indigo-600 block truncate">Detail Calls</span>
            <span className="text-base font-black text-indigo-700 font-mono">
              {counters.detailCalls}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 block truncate">Cache Hits</span>
            <span className="text-base font-black text-emerald-700 font-mono">
              {counters.cacheHits}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-600 block truncate">Update Calls</span>
            <span className="text-base font-black text-purple-700 font-mono">
              {counters.updateCalls}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-500 block truncate">Skipped</span>
            <span className="text-base font-black text-gray-700 font-mono">
              {counters.paymentsSkipped}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-700 block truncate">Auto-Verified</span>
            <span className="text-base font-black text-emerald-700 font-mono">{counters.verified}</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold text-red-600 block truncate">Failures</span>
            <span className="text-base font-black text-red-700 font-mono">
              {counters.verificationFailures}
            </span>
          </div>
        </div>

        {/* ── MAIN CONTENT (2 COLUMNS: API / CACHE ACTIVITY & AUTO-VERIFICATION) ── */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 overflow-hidden">
          {/* LEFT: Live Chronological Activity Stream (7 cols) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-white">
            <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between text-xs shrink-0">
              <span className="font-extrabold text-[#1A2766] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Database size={13} />
                Real-Time Zoho API &amp; Cache Stream
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                {events.length} events logged
              </span>
            </div>

            <div
              ref={eventListRef}
              className="flex-1 p-4 overflow-y-auto space-y-2 text-xs font-mono select-text"
            >
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 italic py-12">
                  <RotateCw size={24} className="animate-spin mb-2 text-gray-300" />
                  <span>Waiting for initial sync events...</span>
                </div>
              ) : (
                events.map((ev, idx) => {
                  const timeStr = new Date(ev.timestamp).toLocaleTimeString();

                  if (ev.type === 'SYNC_STARTED') {
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200 text-blue-900"
                      >
                        <span className="text-blue-500 font-bold mr-2">[{timeStr}]</span>
                        <strong className="text-blue-800">SYNC_STARTED:</strong> Scope {ev.startDate} to{' '}
                        {ev.endDate} (pageSize: {ev.pageSize})
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_LIST_STARTED') {
                    return (
                      <div key={idx} className="p-2 rounded bg-gray-50 border border-gray-100 text-gray-700">
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="text-blue-700 font-semibold">PAYMENT_LIST</span> Page {ev.page}{' '}
                        requested (size: {ev.requestedPageSize})...
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_LIST_COMPLETED') {
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded border ${
                          ev.success
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                            : 'bg-red-50/60 border-red-200 text-red-900'
                        }`}
                      >
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-bold mr-1">{ev.success ? '✓' : '✗'}</span>
                        <span className="font-semibold text-blue-700">PAYMENT_LIST</span> Page {ev.page} •
                        HTTP {ev.httpStatus} • {ev.recordsReturned} records • {ev.durationMs}ms
                        {ev.error && <span className="text-red-600 block mt-0.5">Error: {ev.error}</span>}
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_DETAIL_STARTED') {
                    return (
                      <div key={idx} className="p-1.5 rounded bg-gray-50/70 border border-gray-100 text-gray-600 text-[11px]">
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="text-indigo-700 font-semibold">PAYMENT_DETAIL</span> fetching{' '}
                        <strong>{ev.paymentNumber}</strong>...
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_DETAIL_COMPLETED') {
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded border ${
                          ev.success
                            ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-bold mr-1">{ev.success ? '✓' : '✗'}</span>
                        <span className="font-semibold text-indigo-700">PAYMENT_DETAIL</span>{' '}
                        <strong>{ev.paymentNumber}</strong> • HTTP {ev.httpStatus} • Status:{' '}
                        <strong className="text-indigo-900">{ev.bankMatchStatus}</strong> • {ev.durationMs}ms
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_CACHE_HIT') {
                    return (
                      <div
                        key={idx}
                        className="p-1.5 rounded bg-emerald-50/40 border border-emerald-100 text-emerald-800 text-[11px]"
                      >
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-bold text-emerald-600">⚡ CACHE HIT:</span>{' '}
                        <strong>{ev.paymentNumber}</strong> — {ev.reason} (
                        {ev.cachedBankMatchStatus || 'CACHED'})
                        {ev.zohoModifiedTime && (
                          <span className="text-emerald-700/80 font-mono text-[10px] ml-1">
                            [{ev.zohoModifiedTime}]
                          </span>
                        )}
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_CACHE_MISS') {
                    return (
                      <div key={idx} className="p-1.5 rounded bg-amber-50/30 border border-amber-100 text-amber-900 text-[11px]">
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-bold text-amber-700">CACHE MISS:</span> {ev.paymentNumber} —{' '}
                        {ev.reason}
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_CACHE_REFRESH') {
                    return (
                      <div key={idx} className="p-1.5 rounded bg-amber-50/50 border border-amber-200 text-amber-900 text-[11px]">
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-bold text-amber-700">CACHE REFRESH:</span> {ev.paymentNumber} —{' '}
                        {ev.reason}
                        {ev.zohoModifiedTime && ev.localModifiedTime && (
                          <span className="text-amber-800/80 font-mono text-[10px] block mt-0.5">
                            Zoho: {ev.zohoModifiedTime} ≠ Local: {ev.localModifiedTime}
                          </span>
                        )}
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_SKIPPED_NON_BANK') {
                    return (
                      <div key={idx} className="p-1.5 rounded bg-gray-50 text-gray-500 text-[11px]">
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-medium text-gray-600">SKIPPED:</span> {ev.paymentNumber} ({ev.paymentMode}) — {ev.reason}
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_UPDATE_STARTED') {
                    return (
                      <div key={idx} className="p-2 rounded bg-purple-50/50 border border-purple-200 text-purple-900">
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-bold text-purple-700">PAYMENT_UPDATE (PUT):</span> Updating{' '}
                        <strong>{ev.paymentNumber}</strong> customfields...
                      </div>
                    );
                  }

                  if (ev.type === 'PAYMENT_UPDATE_COMPLETED') {
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded border ${
                          ev.success
                            ? 'bg-purple-100/70 border-purple-300 text-purple-950 font-bold'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <span className="text-gray-400 mr-2">[{timeStr}]</span>
                        <span className="font-bold mr-1">{ev.success ? '✓' : '✗'}</span>
                        <span className="text-purple-800">PAYMENT_UPDATE</span> {ev.paymentNumber} • HTTP{' '}
                        {ev.httpStatus} • Code {ev.zohoCode} • Local:{' '}
                        <span className={ev.localVerificationStatus === 'VERIFIED' ? 'text-emerald-700' : 'text-amber-700'}>
                          {ev.localVerificationStatus}
                        </span>{' '}
                        • {ev.durationMs}ms
                        {ev.error && <div className="text-red-600 text-[11px] font-normal mt-0.5">{ev.error}</div>}
                      </div>
                    );
                  }

                  if (ev.type === 'SYNC_COMPLETED') {
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold"
                      >
                        <span className="text-emerald-600 mr-2">[{timeStr}]</span>
                        ✓ SYNC_COMPLETED: Duration {(ev.durationMs / 1000).toFixed(1)}s • Total Discovered:{' '}
                        {ev.finalSummary.paymentsDiscovered} • Total Zoho Calls:{' '}
                        {ev.finalSummary.totalApiCalls}
                      </div>
                    );
                  }

                  if (ev.type === 'SYNC_FAILED') {
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-950 font-bold"
                      >
                        <span className="text-red-600 mr-2">[{timeStr}]</span>
                        ✗ SYNC_FAILED at {ev.stage}: {ev.error}
                      </div>
                    );
                  }

                  return null;
                })
              )}
            </div>
          </div>

          {/* RIGHT: Auto-Verification & Summary Section (5 cols) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-gray-50/40">
            {/* Auto-Verification Actions */}
            <div className="flex-1 flex flex-col min-h-0 border-b border-gray-200">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs shrink-0">
                <span className="font-extrabold text-[#1A2766] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  Auto-Verification Actions
                </span>
                <span className="text-[11px] text-gray-500 font-semibold font-mono">
                  {counters.verified} verified
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2">
                {autoVerificationEvents.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-gray-400 text-xs italic p-4">
                    <span>No auto-verification candidates processed yet.</span>
                  </div>
                ) : (
                  autoVerificationEvents.map((av, avIdx) => {
                    if (av.type === 'AUTO_VERIFICATION_STARTED') {
                      return (
                        <div
                          key={avIdx}
                          className="p-2.5 rounded-lg bg-white border border-gray-200 text-xs shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900">{av.paymentNumber}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {av.bankMatchStatus}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">{av.reason}</p>
                        </div>
                      );
                    }

                    if (av.type === 'AUTO_VERIFICATION_COMPLETED') {
                      return (
                        <div
                          key={avIdx}
                          className={`p-2.5 rounded-lg border text-xs shadow-2xs ${
                            av.zohoUpdateSuccess
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : 'bg-amber-50/70 border-amber-200 text-amber-950'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black">
                              {av.zohoUpdateSuccess ? '✓ ' : '⚠️ '}
                              {av.paymentNumber}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                av.localVerificationStatus === 'VERIFIED'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-200 text-amber-900'
                              }`}
                            >
                              Local: {av.localVerificationStatus}
                            </span>
                          </div>
                          <p className="text-[11px] mt-1 text-gray-600">
                            Bank Match: <strong>{av.bankMatchStatus}</strong> • Zoho Update:{' '}
                            <strong className={av.zohoUpdateSuccess ? 'text-emerald-700' : 'text-red-700'}>
                              {av.zohoUpdateSuccess ? 'SUCCESS' : 'FAILED / SKIPPED'}
                            </strong>
                          </p>
                          {av.reason && (
                            <p className="text-[10px] text-amber-800 mt-1 italic">{av.reason}</p>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })
                )}
              </div>
            </div>

            {/* Final Completion Summary Box */}
            {finalSummary && (
              <div className="p-4 bg-white border-t border-gray-200 shrink-0 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                  <CheckCircle2 size={18} />
                  <span>Final Synchronization Summary</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <div className="text-gray-600">
                    Payments Discovered: <strong className="text-gray-900 font-mono">{finalSummary.paymentsDiscovered}</strong>
                  </div>
                  <div className="text-gray-600">
                    New Payments: <strong className="text-gray-900 font-mono">{finalSummary.newPayments}</strong>
                  </div>
                  <div className="text-gray-600">
                    Updated Payments: <strong className="text-gray-900 font-mono">{finalSummary.updatedPayments}</strong>
                  </div>
                  <div className="text-gray-600">
                    Cache Hits: <strong className="text-emerald-700 font-mono">{finalSummary.cacheHits}</strong>
                  </div>
                  <div className="text-gray-600">
                    Detail API Calls: <strong className="text-indigo-700 font-mono">{finalSummary.detailCalls}</strong>
                  </div>
                  <div className="text-gray-600">
                    Auto-Verified: <strong className="text-emerald-700 font-mono">{finalSummary.successfullyVerified}</strong>
                  </div>
                  <div className="text-gray-600">
                    Verification Failures: <strong className="text-red-700 font-mono">{finalSummary.verificationFailures}</strong>
                  </div>
                  <div className="text-gray-600">
                    Skipped (Non-Bank): <strong className="text-gray-900 font-mono">{finalSummary.skipped}</strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-gray-200 flex justify-between font-bold text-gray-900">
                    <span>Total Outbound Zoho Calls:</span>
                    <span className="font-mono text-emerald-800">{finalSummary.totalApiCalls} calls</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-3.5 bg-white border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-4 text-gray-600 flex-wrap">
            <span className="font-bold text-[#1A2766]">This Sync Outbound Zoho Calls:</span>
            <span>
              List: <strong className="font-mono text-gray-900">{finalSummary ? finalSummary.paymentListCalls : listCallsCount}</strong>
            </span>
            <span>•</span>
            <span>
              Detail: <strong className="font-mono text-gray-900">{finalSummary ? finalSummary.paymentDetailCalls : counters.detailCalls}</strong>
            </span>
            <span>•</span>
            <span>
              Update: <strong className="font-mono text-gray-900">{finalSummary ? finalSummary.paymentUpdateCalls : counters.updateCalls}</strong>
            </span>
            <span>•</span>
            <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Total This Sync:{' '}
              {finalSummary
                ? finalSummary.totalApiCalls
                : listCallsCount + counters.detailCalls + counters.updateCalls}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={status === 'LIVE' || status === 'CONNECTING'}
              className="px-5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {status === 'LIVE' || status === 'CONNECTING' ? 'Sync in Progress...' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

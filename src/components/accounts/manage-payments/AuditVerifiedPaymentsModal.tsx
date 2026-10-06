'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  ShieldAlert,
  Layers,
  Database,
  ShieldCheck,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  CustomerPaymentAuditEvent,
  AuditProgressCounters,
  AuditFinalSummary,
} from '@/lib/types/customer-payment-audit-events';

interface AuditVerifiedPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditRunId: string | null;
  allowZohoWrites: boolean;
  onAuditCompleted?: () => void;
}

export default function AuditVerifiedPaymentsModal({
  isOpen,
  onClose,
  auditRunId,
  allowZohoWrites,
  onAuditCompleted,
}: AuditVerifiedPaymentsModalProps) {
  const [status, setStatus] = useState<'CONNECTING' | 'LIVE' | 'COMPLETED' | 'FAILED'>('CONNECTING');
  const [currentOperation, setCurrentOperation] = useState<string>('Initializing integrity audit...');
  const [events, setEvents] = useState<CustomerPaymentAuditEvent[]>([]);
  const [counters, setCounters] = useState<AuditProgressCounters>({
    paymentsEvaluated: 0,
    verifiedAudited: 0,
    intactCount: 0,
    invalidatedCount: 0,
    baselinesCreated: 0,
    unverifiedSkipped: 0,
    listApiCalls: 0,
    updateApiCalls: 0,
    currentOperation: 'Initializing...',
  });
  const [finalSummary, setFinalSummary] = useState<AuditFinalSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Connect to SSE stream whenever isOpen & auditRunId changes
  useEffect(() => {
    if (!isOpen || !auditRunId) return;

    setStatus('CONNECTING');
    setCurrentOperation('Connecting to live integrity audit stream...');
    setElapsedSeconds(0);
    setEvents([]);
    setErrorMessage(null);
    setFinalSummary(null);
    setCounters({
      paymentsEvaluated: 0,
      verifiedAudited: 0,
      intactCount: 0,
      invalidatedCount: 0,
      baselinesCreated: 0,
      unverifiedSkipped: 0,
      listApiCalls: 0,
      updateApiCalls: 0,
      currentOperation: 'Connecting...',
    });

    isTerminalRef.current = false;

    const es = new EventSource(`/api/staff/accounts/payment-verification/integrity-audit/events?auditRunId=${encodeURIComponent(auditRunId)}`);
    eventSourceRef.current = es;

    const handleIncomingEvent = (rawPayload: string) => {
      if (isTerminalRef.current) return;

      try {
        const ev: CustomerPaymentAuditEvent = JSON.parse(rawPayload);
        if (ev.auditRunId !== auditRunId) return;

        setEvents((prev) => [...prev, ev]);

        if (eventListRef.current) {
          eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
        }

        if (ev.type === 'AUDIT_STARTED') {
          setStatus('LIVE');
          setCurrentOperation(`Audit started across range ${ev.startDate} to ${ev.endDate}...`);
        } else if (ev.type === 'AUDIT_PAGE_FETCHED') {
          setCurrentOperation(`Fetched page ${ev.page} (${ev.recordsReturned} records, sort=last_modified_time DESC)`);
          setCounters((prev) => ({
            ...prev,
            listApiCalls: prev.listApiCalls + 1,
          }));
        } else if (ev.type === 'AUDIT_PAYMENT_EVALUATED') {
          if (ev.action === 'BASELINE_CREATED') {
            setCounters((prev) => ({
              ...prev,
              paymentsEvaluated: prev.paymentsEvaluated + 1,
              verifiedAudited: prev.verifiedAudited + 1,
              baselinesCreated: prev.baselinesCreated + 1,
            }));
            setCurrentOperation(`Baseline established for ${ev.paymentNumber}`);
          } else if (ev.action === 'VERIFIED_INTACT') {
            setCounters((prev) => ({
              ...prev,
              paymentsEvaluated: prev.paymentsEvaluated + 1,
              verifiedAudited: prev.verifiedAudited + 1,
              intactCount: prev.intactCount + 1,
            }));
            setCurrentOperation(`Verified intact: ${ev.paymentNumber}`);
          } else {
            setCounters((prev) => ({
              ...prev,
              paymentsEvaluated: prev.paymentsEvaluated + 1,
              unverifiedSkipped: prev.unverifiedSkipped + 1,
            }));
          }
        } else if (ev.type === 'AUDIT_PAYMENT_INVALIDATED') {
          setCounters((prev) => ({
            ...prev,
            paymentsEvaluated: prev.paymentsEvaluated + 1,
            verifiedAudited: prev.verifiedAudited + 1,
            invalidatedCount: prev.invalidatedCount + 1,
            updateApiCalls: prev.updateApiCalls + (ev.zohoPutSuccess ? 1 : 0),
          }));
          setCurrentOperation(`INVALIDATED: ${ev.paymentNumber} (${ev.reason})`);
        } else if (ev.type === 'AUDIT_PROGRESS') {
          setCounters({
            paymentsEvaluated: ev.paymentsEvaluated,
            verifiedAudited: ev.verifiedAudited,
            intactCount: ev.intactCount,
            invalidatedCount: ev.invalidatedCount,
            baselinesCreated: ev.baselinesCreated,
            unverifiedSkipped: ev.unverifiedSkipped,
            listApiCalls: ev.listApiCalls,
            updateApiCalls: ev.updateApiCalls,
            currentOperation: ev.currentOperation,
          });
          if (ev.currentOperation) {
            setCurrentOperation(ev.currentOperation);
          }
        } else if (ev.type === 'AUDIT_COMPLETED') {
          isTerminalRef.current = true;
          setStatus('COMPLETED');
          setCurrentOperation('Integrity audit completed successfully.');
          setFinalSummary(ev.finalSummary);

          setCounters({
            paymentsEvaluated: ev.finalSummary.paymentsEvaluated,
            verifiedAudited: ev.finalSummary.verifiedAudited,
            intactCount: ev.finalSummary.intactCount,
            invalidatedCount: ev.finalSummary.invalidatedCount,
            baselinesCreated: ev.finalSummary.baselinesCreated,
            unverifiedSkipped: ev.finalSummary.unverifiedSkipped,
            listApiCalls: ev.finalSummary.listApiCalls,
            updateApiCalls: ev.finalSummary.updateApiCalls,
            currentOperation: 'Audit completed.',
          });

          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          if (onAuditCompleted) {
            onAuditCompleted();
          }
        } else if (ev.type === 'AUDIT_FAILED') {
          isTerminalRef.current = true;
          setStatus('FAILED');
          setCurrentOperation(`Audit failed: ${ev.stage}`);
          setErrorMessage(ev.error);

          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        }
      } catch (err) {
        console.error('[AuditModal] Failed to parse SSE event:', err);
      }
    };

    es.onmessage = (e) => {
      handleIncomingEvent(e.data);
    };

    es.onerror = () => {
      if (isTerminalRef.current || status === 'COMPLETED' || status === 'FAILED') {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        return;
      }
      setTimeout(() => {
        if (!isTerminalRef.current && status === 'LIVE') {
          setCurrentOperation('Reconnecting to audit stream...');
        }
      }, 2000);
    };

    return () => {
      isTerminalRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, auditRunId]);

  if (!isOpen) return null;

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#1A2766]">
                  Verified Payment Integrity Audit
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'FAILED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800 animate-pulse'
                }`}>
                  {status}
                </span>
                {allowZohoWrites && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                    Zoho Writes ON
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">
                Detects modifications to amount or payment date in Zoho Books using descending last_modified_time scan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
              <Clock size={13} className="text-gray-400" />
              <span>{formatElapsed(elapsedSeconds)}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Close Audit Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CURRENT OPERATION STATUS BAR */}
        <div className="bg-indigo-50/60 border-b border-indigo-100 px-5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            {status === 'COMPLETED' ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : status === 'FAILED' ? (
              <AlertCircle size={15} className="text-red-600 shrink-0" />
            ) : (
              <RotateCw size={15} className="text-indigo-600 animate-spin shrink-0" />
            )}
            <span className="font-bold text-[#1A2766] truncate">{currentOperation}</span>
          </div>

          <div className="text-[11px] font-mono text-gray-500 shrink-0">
            Run ID: <span className="font-semibold text-gray-700">{auditRunId}</span>
          </div>
        </div>

        {/* METRIC COUNTERS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-gray-50/30 border-b border-gray-100 text-xs">
          {/* Card 1: Payments Evaluated */}
          <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
              <span>Evaluated</span>
              <Layers size={13} />
            </div>
            <div className="text-xl font-black text-gray-900 font-mono">
              {counters.paymentsEvaluated}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Verified in scope: <strong className="text-gray-700">{counters.verifiedAudited}</strong>
            </div>
          </div>

          {/* Card 2: Intact */}
          <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-1">
              <span>Verified Intact</span>
              <ShieldCheck size={13} />
            </div>
            <div className="text-xl font-black text-emerald-700 font-mono">
              {counters.intactCount}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">
              Baselines created: <strong className="text-emerald-800">{counters.baselinesCreated}</strong>
            </div>
          </div>

          {/* Card 3: Invalidated (Discrepancy) */}
          <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-amber-600 text-[10px] font-bold uppercase tracking-wider mb-1">
              <span>Invalidated</span>
              <AlertTriangle size={13} />
            </div>
            <div className="text-xl font-black text-amber-600 font-mono">
              {counters.invalidatedCount}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
              Requires Re-verification
            </div>
          </div>

          {/* Card 4: Outbound Zoho Calls */}
          <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-1">
              <span>Zoho API Calls</span>
              <Database size={13} />
            </div>
            <div className="text-xl font-black text-[#1A2766] font-mono">
              {counters.listApiCalls + counters.updateApiCalls}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              List: {counters.listApiCalls} • Updates: {counters.updateApiCalls}
            </div>
          </div>
        </div>

        {/* LIVE EVENT LOG */}
        <div className="flex-1 p-5 overflow-y-auto space-y-2 min-h-[240px] max-h-[380px] bg-white font-mono text-xs" ref={eventListRef}>
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <RotateCw size={24} className="animate-spin mb-2 text-indigo-500" />
              <p className="text-xs font-sans">Connecting to live integrity audit stream...</p>
            </div>
          ) : (
            events.map((ev, index) => {
              const timeStr = new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              if (ev.type === 'AUDIT_STARTED') {
                return (
                  <div key={index} className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-[11px] flex items-center justify-between">
                    <div>
                      <strong className="text-blue-950">AUDIT_STARTED:</strong> Scope: {ev.startDate} through {ev.endDate} | Checkpoint: {ev.checkpointTimestamp || 'None (Full Scan)'}
                    </div>
                    <span className="text-blue-500 text-[10px]">{timeStr}</span>
                  </div>
                );
              }

              if (ev.type === 'AUDIT_PAGE_FETCHED') {
                return (
                  <div key={index} className="p-2 bg-gray-50 rounded border border-gray-200 text-gray-700 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="text-indigo-600 font-bold">PAGE_FETCHED:</span> Page {ev.page} ({ev.recordsReturned} records) in {ev.durationMs}ms
                    </div>
                    <span className="text-gray-400 text-[10px]">{timeStr}</span>
                  </div>
                );
              }

              if (ev.type === 'AUDIT_PAYMENT_EVALUATED') {
                if (ev.action === 'BASELINE_CREATED') {
                  return (
                    <div key={index} className="p-2 bg-emerald-50/60 rounded border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between">
                      <div>
                        <strong className="text-emerald-900">BASELINE:</strong> {ev.paymentNumber} — {ev.details}
                      </div>
                      <span className="text-emerald-600 text-[10px]">{timeStr}</span>
                    </div>
                  );
                }
                if (ev.action === 'VERIFIED_INTACT') {
                  return (
                    <div key={index} className="p-2 bg-gray-50 rounded border border-gray-100 text-gray-600 text-[11px] flex items-center justify-between">
                      <div>
                        <span className="text-emerald-700 font-bold">INTACT:</span> {ev.paymentNumber} — {ev.details}
                      </div>
                      <span className="text-gray-400 text-[10px]">{timeStr}</span>
                    </div>
                  );
                }
                return null;
              }

              if (ev.type === 'AUDIT_PAYMENT_INVALIDATED') {
                return (
                  <div key={index} className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950">
                        <AlertTriangle size={13} className="text-amber-600" />
                        INVALIDATED: {ev.paymentNumber}
                      </div>
                      <span className="text-amber-700 text-[10px]">{timeStr}</span>
                    </div>
                    <div className="text-[11px] font-sans text-amber-900 font-medium pl-4">
                      {ev.reason}
                    </div>
                    {ev.zohoPutSuccess && (
                      <div className="text-[10px] text-emerald-700 pl-4 font-semibold">
                        ✓ Zoho cf_is_verified successfully reset to false
                      </div>
                    )}
                  </div>
                );
              }

              if (ev.type === 'AUDIT_COMPLETED') {
                return (
                  <div key={index} className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-sans space-y-2 my-2">
                    <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                      <CheckCircle2 size={18} className="text-emerald-700" />
                      Integrity Audit Completed Successfully
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                      <div>Audited: <strong>{ev.finalSummary.verifiedAudited}</strong></div>
                      <div>Intact: <strong>{ev.finalSummary.intactCount}</strong></div>
                      <div>Invalidated: <strong className="text-amber-700">{ev.finalSummary.invalidatedCount}</strong></div>
                      <div>Baselines: <strong>{ev.finalSummary.baselinesCreated}</strong></div>
                    </div>
                    <div className="text-[11px] text-emerald-800">
                      Total Zoho API Calls: <strong>{ev.finalSummary.totalApiCalls}</strong> (List: {ev.finalSummary.listApiCalls}, Update: {ev.finalSummary.updateApiCalls}) in {Math.round(ev.finalSummary.totalDurationMs / 1000)}s
                    </div>
                  </div>
                );
              }

              if (ev.type === 'AUDIT_FAILED') {
                return (
                  <div key={index} className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-950 text-xs font-sans space-y-1 my-2">
                    <div className="flex items-center gap-2 font-black text-red-900">
                      <AlertCircle size={18} className="text-red-700" />
                      Audit Failed: {ev.stage}
                    </div>
                    <div className="text-xs text-red-800 font-medium">
                      {ev.error}
                    </div>
                  </div>
                );
              }

              return null;
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
          <div className="text-gray-500 font-medium text-[11px]">
            {status === 'COMPLETED'
              ? 'Audit completed. Invalidation flags have updated the verification queue.'
              : status === 'FAILED'
              ? errorMessage || 'Audit interrupted due to an error.'
              : 'Audit actively running...'}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shadow-2xs"
          >
            {status === 'COMPLETED' || status === 'FAILED' ? 'Close' : 'Minimize'}
          </button>
        </div>
      </div>
    </div>
  );
}

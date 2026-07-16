'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, Copy, CheckCircle2, Circle, Wifi, Zap, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CommunicationDetailsDrawerProps {
  log: any;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeDateMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    console.warn('[Timeline] Invalid date value:', raw);
    return null;
  }
  return d.getTime();
}

function formatDuration(ms: number): string {
  if (ms < 0) return '0 sec';
  const MAX_REASONABLE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (ms > MAX_REASONABLE_MS) {
    console.warn('[Timeline] Suspiciously large duration detected:', ms, 'ms. Possible timestamp bug.');
    return 'Invalid timestamp';
  }
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    if (seconds === 0) return `${minutes} min`;
    return `${minutes} min ${seconds} sec`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function formatTs(ms: number): string {
  return format(new Date(ms), 'MMM dd, yyyy hh:mm:ss a');
}

// ─── Timeline Builder ──────────────────────────────────────────────────────────

type TimelineEvent = {
  id: string;
  name: string;
  description: string;
  ms: number | null;
  isCompleted: boolean;
  isCurrent: boolean;
  isPending: boolean;
  pendingLabel: string;
  dotColor: string;
  textColor: string;
  source: 'Internal ERP' | 'Meta Webhook' | null;
};

function buildTimeline(log: any): TimelineEvent[] {
  const queuedMs = safeDateMs(log.createdAt);
  const apiMs = safeDateMs(log.apiAcceptedAt);
  const sentMs = safeDateMs(log.sentAt);
  const deliveredMs = safeDateMs(log.deliveredAt);
  const readMs = safeDateMs(log.readAt);
  const failedMs = safeDateMs(log.failedAt);

  // Chronology validation
  const checkOrder = (prev: number | null, next: number | null, prevName: string, nextName: string) => {
    if (prev !== null && next !== null && next < prev) {
      console.warn(`[Timeline] Chronology violation: '${nextName}' (${new Date(next)}) is earlier than '${prevName}' (${new Date(prev)})`);
    }
  };
  checkOrder(queuedMs, apiMs, 'Queued', 'API Accepted');
  checkOrder(apiMs, sentMs, 'API Accepted', 'Sent');
  checkOrder(sentMs, deliveredMs, 'Sent', 'Delivered');
  checkOrder(deliveredMs, readMs, 'Delivered', 'Read');

  const completedEvents: TimelineEvent[] = [];

  if (queuedMs !== null) {
    completedEvents.push({
      id: 'queued',
      name: 'Queued',
      description: 'Communication created in ERP',
      ms: queuedMs,
      isCompleted: true,
      isCurrent: false,
      isPending: false,
      pendingLabel: '',
      dotColor: 'bg-gray-400',
      textColor: 'text-gray-700',
      source: 'Internal ERP',
    });
  }

  if (apiMs !== null) {
    completedEvents.push({
      id: 'api_accepted',
      name: 'API Request Sent',
      description: 'Request accepted by Meta Cloud API',
      ms: apiMs,
      isCompleted: true,
      isCurrent: false,
      isPending: false,
      pendingLabel: '',
      dotColor: 'bg-blue-500',
      textColor: 'text-blue-700',
      source: 'Internal ERP',
    });
  }

  if (sentMs !== null) {
    completedEvents.push({
      id: 'sent',
      name: 'Sent to Network',
      description: 'Message handed off to WhatsApp network',
      ms: sentMs,
      isCompleted: true,
      isCurrent: false,
      isPending: false,
      pendingLabel: '',
      dotColor: 'bg-orange-400',
      textColor: 'text-orange-700',
      source: 'Meta Webhook',
    });
  }

  if (deliveredMs !== null) {
    completedEvents.push({
      id: 'delivered',
      name: 'Delivered',
      description: "Message delivered to recipient's device",
      ms: deliveredMs,
      isCompleted: true,
      isCurrent: false,
      isPending: false,
      pendingLabel: '',
      dotColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      source: 'Meta Webhook',
    });
  }

  if (readMs !== null) {
    completedEvents.push({
      id: 'read',
      name: 'Read',
      description: 'Message opened by recipient',
      ms: readMs,
      isCompleted: true,
      isCurrent: false,
      isPending: false,
      pendingLabel: '',
      dotColor: 'bg-purple-500',
      textColor: 'text-purple-700',
      source: 'Meta Webhook',
    });
  }

  if (failedMs !== null) {
    completedEvents.push({
      id: 'failed',
      name: 'Failed',
      description: log.errorMessage || 'Delivery failed',
      ms: failedMs,
      isCompleted: true,
      isCurrent: false,
      isPending: false,
      pendingLabel: '',
      dotColor: 'bg-red-500',
      textColor: 'text-red-700',
      source: 'Meta Webhook',
    });
  }

  // Sort strictly chronologically by timestamp
  completedEvents.sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));

  // Mark last completed as current
  const lastIdx = completedEvents.length - 1;
  const finalEvents: TimelineEvent[] = completedEvents.map((e, i) => ({
    ...e,
    isCurrent: i === lastIdx,
  }));

  // Append pending future stages only if not failed
  if (log.status !== 'FAILED') {
    if (!deliveredMs) {
      finalEvents.push({
        id: 'pending_delivered',
        name: 'Delivered',
        description: '',
        ms: null,
        isCompleted: false,
        isCurrent: false,
        isPending: true,
        pendingLabel: 'Waiting for delivery...',
        dotColor: '',
        textColor: 'text-gray-400',
        source: null,
      });
    }
    if (!readMs) {
      finalEvents.push({
        id: 'pending_read',
        name: 'Read',
        description: '',
        ms: null,
        isCompleted: false,
        isCurrent: false,
        isPending: true,
        pendingLabel: 'Waiting for customer...',
        dotColor: '',
        textColor: 'text-gray-400',
        source: null,
      });
    }
  }

  return finalEvents;
}

// ─── Dot Component ─────────────────────────────────────────────────────────────

function TimelineDot({ event }: { event: TimelineEvent }) {
  if (event.isPending) {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
      </div>
    );
  }
  if (event.isCurrent && event.id !== 'failed') {
    return (
      <div className="relative flex-shrink-0">
        <div className={`w-5 h-5 rounded-full ${event.dotColor} flex items-center justify-center`}>
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
        <div className={`absolute inset-0 rounded-full ${event.dotColor} opacity-30 animate-ping`} />
      </div>
    );
  }
  if (event.id === 'failed') {
    return (
      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
        <X size={10} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  return (
    <div className={`w-5 h-5 rounded-full ${event.dotColor} flex items-center justify-center flex-shrink-0`}>
      <CheckCircle2 size={12} className="text-white" strokeWidth={2.5} />
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    QUEUED:       'bg-gray-100 text-gray-600',
    API_ACCEPTED: 'bg-blue-100 text-blue-700',
    SENT:         'bg-orange-100 text-orange-700',
    DELIVERED:    'bg-emerald-100 text-emerald-700',
    READ:         'bg-purple-100 text-purple-700',
    FAILED:       'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CommunicationDetailsDrawer({ log, onClose }: CommunicationDetailsDrawerProps) {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (log && showWebhooks) fetchWebhooks();
  }, [log, showWebhooks]);

  const fetchWebhooks = async () => {
    setLoadingWebhooks(true);
    try {
      const res = await fetch(`/api/communications/logs/${log.id}/webhooks`);
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!log) return null;

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const events = buildTimeline(log);

  // ─── KPIs ────────────────────────────────────────────────────────────────────
  const queuedMs   = safeDateMs(log.createdAt);
  const apiMs      = safeDateMs(log.apiAcceptedAt);
  const deliveredMs = safeDateMs(log.deliveredAt);
  const readMs     = safeDateMs(log.readAt);
  const lastMs     = readMs ?? deliveredMs ?? safeDateMs(log.sentAt) ?? apiMs;

  const kpis = [
    {
      label: 'API Response',
      value: apiMs && queuedMs ? formatDuration(apiMs - queuedMs) : '—',
      active: !!apiMs,
    },
    {
      label: 'Delivered',
      value: deliveredMs && queuedMs ? formatDuration(deliveredMs - queuedMs) : '—',
      active: !!deliveredMs,
    },
    {
      label: 'Read',
      value: readMs && queuedMs ? formatDuration(readMs - queuedMs) : '—',
      active: !!readMs,
    },
    {
      label: 'Total Lifecycle',
      value: lastMs && queuedMs ? formatDuration(lastMs - queuedMs) : '—',
      active: !!lastMs,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 200ms ease' }}
      onClick={handleOutsideClick}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes eventIn { from { opacity: 0; transform: translateX(8px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>

      <div
        className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'slideIn 280ms cubic-bezier(0.32,0.72,0,1)' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Communication Details</h2>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">{log.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Overview */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Overview</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Status</p>
                <StatusBadge status={log.status} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Channel / Direction</p>
                <p className="text-sm font-semibold text-gray-800">{log.channel} <span className="text-gray-400 text-xs">({log.direction})</span></p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Created</p>
                <p className="text-sm font-semibold text-gray-800">{format(new Date(log.createdAt), 'MMM dd, yyyy hh:mm:ss a')}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Module</p>
                <p className="text-sm font-semibold text-gray-800">{log.type}{log.relatedRecord ? ` — ${log.relatedRecord}` : ''}</p>
              </div>
            </div>
            {log.status === 'FAILED' && log.errorMessage && (
              <div className="mt-4 bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex gap-3">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-800">{log.errorCode ? `Error ${log.errorCode}` : 'Delivery Failed'}</p>
                  <p className="text-xs text-red-600 font-mono mt-0.5 leading-relaxed">{log.errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sender / Recipient */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Sender &amp; Recipient</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">From</p>
                <p className="text-sm font-semibold text-gray-800">{log.fromName || '—'}</p>
                {log.fromAddress && <p className="text-xs text-gray-500 font-mono">{log.fromAddress}</p>}
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">To</p>
                <p className="text-sm font-semibold text-[#1A2766]">{log.customerName || log.customerId || 'Unknown'}</p>
                {log.toAddress && <p className="text-xs text-gray-500 font-mono">{log.toAddress}</p>}
              </div>
            </div>
          </div>

          {/* Template */}
          {log.templateName && (
            <div className="px-6 py-5 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Template</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Name</p>
                  <p className="text-sm font-semibold text-gray-800">{log.templateName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Language</p>
                  <p className="text-sm font-semibold text-gray-800">{log.templateLanguage || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Category</p>
                  <p className="text-sm font-semibold text-gray-800">{log.templateCategory || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Message Preview */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Message Content</p>
            <div className="bg-[#E7FFDB] rounded-2xl p-4 shadow-sm border border-[#C3F5B4] relative max-w-[88%]">
              <span className="absolute right-3 top-2 text-[9px] text-gray-400 uppercase tracking-wider">Preview</span>
              {log.headerType && log.headerType !== 'NONE' && (
                <div className="mb-3 pb-3 border-b border-black/5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Header ({log.headerType})</p>
                  {log.headerMediaUrl
                    ? <p className="text-xs text-blue-600 underline font-mono break-all">{log.headerMediaUrl}</p>
                    : <p className="text-xs text-gray-500 italic">Media / Document Header</p>
                  }
                </div>
              )}
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{log.body}</div>
              {log.footer && (
                <div className="mt-3 pt-3 border-t border-black/5">
                  <p className="text-[11px] text-gray-500">{log.footer}</p>
                </div>
              )}
              {log.buttonsJson && (
                <div className="mt-3 flex flex-col gap-1.5">
                  {Array.isArray(log.buttonsJson)
                    ? log.buttonsJson.map((btn: any, i: number) => (
                        <div key={i} className="bg-white/80 border border-[#C3F5B4] text-[#00A884] text-center text-xs font-semibold py-1.5 rounded-lg">
                          {btn.text}
                        </div>
                      ))
                    : <p className="text-xs text-gray-400 italic">Buttons present</p>
                  }
                </div>
              )}
            </div>
            {log.variablesJson && Object.keys(log.variablesJson).length > 0 && (
              <div className="mt-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2.5">Variables Injected</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {Object.entries(log.variablesJson).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-[10px] font-mono text-gray-400">{`{{${k}}}`}</span>
                      <p className="text-sm font-semibold text-gray-800 truncate">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Lifecycle Timeline ─────────────────────────────────────────── */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Lifecycle Timeline</p>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {kpis.map(kpi => (
                <div
                  key={kpi.label}
                  className={`rounded-xl p-3 border text-center ${kpi.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">{kpi.label}</p>
                  <p className={`text-sm font-bold ${kpi.active ? 'text-gray-900' : 'text-gray-300'}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="space-y-0">
              {events.map((event, idx) => {
                const isLast = idx === events.length - 1;
                const nextEvent = events[idx + 1];

                // Duration between this and next completed event
                let durationToNext: string | null = null;
                if (event.isCompleted && nextEvent?.isCompleted && event.ms !== null && nextEvent.ms !== null) {
                  const diff = nextEvent.ms - event.ms;
                  durationToNext = formatDuration(diff);
                }

                return (
                  <div
                    key={event.id}
                    className="flex gap-4"
                    style={{ animation: event.isCompleted ? `eventIn 300ms ease ${idx * 60}ms both` : undefined }}
                  >
                    {/* Left: dot + connector line */}
                    <div className="flex flex-col items-center w-5 flex-shrink-0 pt-1">
                      <TimelineDot event={event} />
                      {!isLast && (
                        <div className={`w-0.5 flex-1 my-1.5 rounded-full ${event.isCompleted ? 'bg-gray-200' : 'border-l-2 border-dashed border-gray-200 w-0'}`} style={{ minHeight: '32px' }} />
                      )}
                    </div>

                    {/* Right: content */}
                    <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                      {event.isPending ? (
                        // Pending card
                        <div className="pt-0.5">
                          <p className="text-sm font-semibold text-gray-300">{event.name}</p>
                          <p className="text-xs text-gray-300 italic mt-0.5">{event.pendingLabel}</p>
                        </div>
                      ) : (
                        // Completed card
                        <div className={`rounded-xl border px-4 py-3 ${
                          event.id === 'failed'
                            ? 'bg-red-50 border-red-100'
                            : event.isCurrent
                            ? 'bg-blue-50 border-blue-100'
                            : 'bg-gray-50 border-gray-100'
                        }`}>
                          {/* Title row */}
                          <div className="flex items-center justify-between mb-1.5">
                            <p className={`text-sm font-bold ${event.id === 'failed' ? 'text-red-700' : event.isCurrent ? 'text-blue-900' : 'text-gray-800'}`}>
                              {event.name}
                            </p>
                            {event.source && (
                              <div className="flex items-center gap-1">
                                {event.source === 'Meta Webhook'
                                  ? <Wifi size={10} className="text-blue-400" />
                                  : <Zap size={10} className="text-gray-400" />
                                }
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${event.source === 'Meta Webhook' ? 'text-blue-400' : 'text-gray-400'}`}>
                                  {event.source}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Timestamp */}
                          {event.ms !== null && (
                            <p className="text-xs font-mono text-gray-500">{formatTs(event.ms)}</p>
                          )}

                          {/* Description / error */}
                          {event.id === 'failed' && event.description && (
                            <p className="text-xs text-red-500 mt-1 leading-relaxed">{event.description}</p>
                          )}

                          {/* Duration to next step */}
                          {durationToNext && (
                            <div className="mt-2 pt-2 border-t border-gray-200/70 flex items-center gap-1.5">
                              <Clock size={10} className="text-gray-400 flex-shrink-0" />
                              <span className="text-[10px] font-semibold text-gray-400">+{durationToNext} until next stage</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Provider */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Provider ({log.providerName || 'N/A'})</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Message ID</p>
                <p className="text-xs font-mono font-semibold text-gray-800 break-all">{log.providerMessageId || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Conversation ID</p>
                <p className="text-xs font-mono font-semibold text-gray-800 break-all">{log.conversationId || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Pricing Category</p>
                <p className="text-sm font-semibold text-gray-800">{log.pricingCategory || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Pricing Cost</p>
                <p className="text-sm font-semibold text-gray-800">
                  {log.pricingCost !== null && log.pricingCost !== undefined ? `$${log.pricingCost}` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Webhook Audit */}
          <div className="px-6 py-5 pb-12">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Webhook Audit Log</p>
              <button
                onClick={() => setShowWebhooks(!showWebhooks)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                {showWebhooks ? 'Hide' : 'View Raw Webhooks'}
              </button>
            </div>

            {showWebhooks && (
              <div className="space-y-3">
                {log.providerResponse && (
                  <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
                    <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
                      <p className="text-[11px] text-gray-300 font-bold flex items-center gap-2">
                        <Zap size={11} className="text-yellow-400" /> Initial API Response
                      </p>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(log.providerResponse, null, 2), 'initial')}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {copied === 'initial' ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <pre className="text-xs text-gray-300 font-mono leading-relaxed">{JSON.stringify(log.providerResponse, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {loadingWebhooks ? (
                  <p className="text-xs text-gray-500 text-center py-4">Loading events...</p>
                ) : webhooks.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4 italic">No webhook events recorded yet.</p>
                ) : (
                  webhooks.map((wh, idx) => {
                    const key = `wh-${idx}`;
                    return (
                      <div key={idx} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
                        <div className="flex justify-between items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
                          <p className="text-[11px] text-gray-300 font-bold flex items-center gap-2">
                            <Wifi size={11} className="text-blue-400" />
                            {wh.eventStatus.toUpperCase()} — {format(new Date(wh.createdAt), 'MMM dd, hh:mm:ss a')}
                          </p>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(wh.payload, null, 2), key)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            {copied === key ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="p-4 overflow-x-auto">
                          <pre className="text-xs text-gray-300 font-mono leading-relaxed">{JSON.stringify(wh.payload, null, 2)}</pre>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

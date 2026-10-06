import { CustomerPaymentAuditEvent } from '@/lib/types/customer-payment-audit-events';

export interface ActiveAuditRun {
  auditRunId: string;
  startedAt: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  events: CustomerPaymentAuditEvent[];
  listeners: Set<(event: CustomerPaymentAuditEvent) => void>;
  result?: any;
  error?: string;
}

// Global in-memory registry for audit runs
const globalAuditRuns = new Map<string, ActiveAuditRun>();

export function getOrCreateAuditRun(auditRunId: string): ActiveAuditRun {
  let run = globalAuditRuns.get(auditRunId);
  if (!run) {
    run = {
      auditRunId,
      startedAt: new Date().toISOString(),
      status: 'RUNNING',
      events: [],
      listeners: new Set(),
    };
    globalAuditRuns.set(auditRunId, run);

    // Auto-clean old runs after 1 hour to prevent memory leaks
    setTimeout(() => {
      globalAuditRuns.delete(auditRunId);
    }, 60 * 60 * 1000);
  }
  return run;
}

export function getAuditRun(auditRunId: string): ActiveAuditRun | undefined {
  return globalAuditRuns.get(auditRunId);
}

export function emitAuditEvent(event: CustomerPaymentAuditEvent): void {
  const run = getOrCreateAuditRun(event.auditRunId);

  // Terminal state protection: If run is already completed or failed, do NOT accept further events
  if (run.status === 'COMPLETED' || run.status === 'FAILED') {
    console.warn(`[AuditEventEmitter] Dropping event '${event.type}' received after terminal status (${run.status}) for ${event.auditRunId}`);
    return;
  }

  run.events.push(event);

  if (event.type === 'AUDIT_COMPLETED') {
    run.status = 'COMPLETED';
    run.result = event.finalSummary;
  } else if (event.type === 'AUDIT_FAILED') {
    run.status = 'FAILED';
    run.error = event.error;
  }

  // Notify all active SSE / stream listeners
  for (const listener of run.listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[AuditEventEmitter] Listener dispatch failed:', err);
    }
  }

  // Once terminal event has been dispatched to all listeners, clear listeners
  if (event.type === 'AUDIT_COMPLETED' || event.type === 'AUDIT_FAILED') {
    run.listeners.clear();
  }
}

export function addAuditEventListener(
  auditRunId: string,
  listener: (event: CustomerPaymentAuditEvent) => void
): () => void {
  const run = getOrCreateAuditRun(auditRunId);
  run.listeners.add(listener);

  return () => {
    run.listeners.delete(listener);
  };
}

// Concurrency lock for audit run
let activeAuditRunId: string | null = null;
let activeAuditStartedAt: number = 0;

export function acquireAuditRunLock(auditRunId: string): { acquired: boolean; currentRunId?: string } {
  const now = Date.now();
  if (activeAuditRunId && now - activeAuditStartedAt < 10 * 60 * 1000) {
    const existingRun = globalAuditRuns.get(activeAuditRunId);
    if (existingRun && existingRun.status === 'RUNNING') {
      return { acquired: false, currentRunId: activeAuditRunId };
    }
  }

  activeAuditRunId = auditRunId;
  activeAuditStartedAt = now;
  getOrCreateAuditRun(auditRunId);
  return { acquired: true };
}

export function releaseAuditRunLock(auditRunId: string): void {
  if (activeAuditRunId === auditRunId) {
    activeAuditRunId = null;
    activeAuditStartedAt = 0;
  }
}

export function getActiveAuditRunId(): string | null {
  if (activeAuditRunId && Date.now() - activeAuditStartedAt < 10 * 60 * 1000) {
    const run = globalAuditRuns.get(activeAuditRunId);
    if (run && run.status === 'RUNNING') {
      return activeAuditRunId;
    }
  }
  return null;
}

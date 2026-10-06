import { CustomerPaymentSyncEvent } from '@/lib/types/customer-payment-sync-events';

export interface ActiveSyncRun {
  syncRunId: string;
  startedAt: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  events: CustomerPaymentSyncEvent[];
  listeners: Set<(event: CustomerPaymentSyncEvent) => void>;
  result?: any;
  error?: string;
}

// Global registry for in-memory sync runs and event emission across requests
const globalSyncRuns = new Map<string, ActiveSyncRun>();

export function getOrCreateSyncRun(syncRunId: string): ActiveSyncRun {
  let run = globalSyncRuns.get(syncRunId);
  if (!run) {
    run = {
      syncRunId,
      startedAt: new Date().toISOString(),
      status: 'RUNNING',
      events: [],
      listeners: new Set(),
    };
    globalSyncRuns.set(syncRunId, run);

    // Auto-clean old runs after 1 hour to prevent memory leaks
    setTimeout(() => {
      globalSyncRuns.delete(syncRunId);
    }, 60 * 60 * 1000);
  }
  return run;
}

export function getSyncRun(syncRunId: string): ActiveSyncRun | undefined {
  return globalSyncRuns.get(syncRunId);
}

export function emitSyncEvent(event: CustomerPaymentSyncEvent): void {
  const run = getOrCreateSyncRun(event.syncRunId);

  // Terminal state protection: If run is already completed or failed, do NOT accept further events
  if (run.status === 'COMPLETED' || run.status === 'FAILED') {
    console.warn(`[SyncEventEmitter] Dropping event '${event.type}' received after terminal status (${run.status}) for ${event.syncRunId}`);
    return;
  }

  run.events.push(event);

  if (event.type === 'SYNC_COMPLETED') {
    run.status = 'COMPLETED';
    run.result = event.finalSummary;
  } else if (event.type === 'SYNC_FAILED') {
    run.status = 'FAILED';
    run.error = event.error;
  }

  // Notify all active SSE / stream listeners
  for (const listener of run.listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[SyncEventEmitter] Listener dispatch failed:', err);
    }
  }

  // Once terminal event has been dispatched to all listeners, clear listeners to terminate subscriptions
  if (event.type === 'SYNC_COMPLETED' || event.type === 'SYNC_FAILED') {
    run.listeners.clear();
  }
}

export function addSyncEventListener(
  syncRunId: string,
  listener: (event: CustomerPaymentSyncEvent) => void
): () => void {
  const run = getOrCreateSyncRun(syncRunId);
  run.listeners.add(listener);

  return () => {
    run.listeners.delete(listener);
  };
}

// Concurrency lock to prevent concurrent overlapping runs
let activeSyncRunId: string | null = null;
let activeSyncStartedAt: number = 0;

export function acquireSyncRunLock(syncRunId: string): { acquired: boolean; currentRunId?: string } {
  const now = Date.now();
  // If an existing run has been going for more than 10 minutes, treat as timed out/stale
  if (activeSyncRunId && now - activeSyncStartedAt < 10 * 60 * 1000) {
    const existingRun = globalSyncRuns.get(activeSyncRunId);
    if (existingRun && existingRun.status === 'RUNNING') {
      return { acquired: false, currentRunId: activeSyncRunId };
    }
  }

  activeSyncRunId = syncRunId;
  activeSyncStartedAt = now;
  getOrCreateSyncRun(syncRunId);
  return { acquired: true };
}

export function releaseSyncRunLock(syncRunId: string): void {
  if (activeSyncRunId === syncRunId) {
    activeSyncRunId = null;
    activeSyncStartedAt = 0;
  }
}

export function getActiveSyncRunId(): string | null {
  if (activeSyncRunId && Date.now() - activeSyncStartedAt < 10 * 60 * 1000) {
    const run = globalSyncRuns.get(activeSyncRunId);
    if (run && run.status === 'RUNNING') {
      return activeSyncRunId;
    }
  }
  return null;
}

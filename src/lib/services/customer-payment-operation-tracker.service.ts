import { prisma } from '@/lib/db';
import {
  acquireSyncRunLock,
  releaseSyncRunLock,
  getActiveSyncRunId,
} from '@/lib/services/customer-payment-sync-events.service';
import {
  acquireAuditRunLock,
  releaseAuditRunLock,
  getActiveAuditRunId,
} from '@/lib/services/customer-payment-audit-events.service';

export type PaymentOperationKey = 'audit_verified_payments' | 'sync_zoho_data';
export type PaymentOperationTrigger = 'MANUAL' | 'AUTOMATIC';
export type PaymentOperationStatus = 'idle' | 'running' | 'success' | 'failed';

export interface PaymentOperationMetadata {
  operationKey: PaymentOperationKey;
  operationName: string;
  currentRunStatus: PaymentOperationStatus;
  activeRunId: string | null;
  lastRunStatus: PaymentOperationStatus | null;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRunTrigger: PaymentOperationTrigger | null;
  lastRunRecordsProcessed: number;
  lastRunError: string | null;
  lastManualRunAt: string | null;
  lastAutomaticRunAt: string | null;
}

const OPERATION_NAMES: Record<PaymentOperationKey, string> = {
  audit_verified_payments: 'Audit Verified Payments',
  sync_zoho_data: 'Sync Zoho Data',
};

/**
 * Returns default empty metadata object when no execution has been recorded yet.
 */
function getDefaultMetadata(key: PaymentOperationKey): PaymentOperationMetadata {
  return {
    operationKey: key,
    operationName: OPERATION_NAMES[key],
    currentRunStatus: 'idle',
    activeRunId: null,
    lastRunStatus: null,
    lastRunStartedAt: null,
    lastRunCompletedAt: null,
    lastRunTrigger: null,
    lastRunRecordsProcessed: 0,
    lastRunError: null,
    lastManualRunAt: null,
    lastAutomaticRunAt: null,
  };
}

/**
 * Records the start of a payment operation execution.
 * Enforces concurrency protection: if operation is currently running (and not stale > 10m), acquisition fails.
 */
export async function recordOperationStart(params: {
  operationKey: PaymentOperationKey;
  runId: string;
  trigger: PaymentOperationTrigger;
}): Promise<{ acquired: boolean; currentRunId?: string }> {
  const { operationKey, runId, trigger } = params;
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes

  // In-memory lock acquisition check
  if (operationKey === 'sync_zoho_data') {
    const lock = acquireSyncRunLock(runId);
    if (!lock.acquired) {
      return { acquired: false, currentRunId: lock.currentRunId };
    }
  } else if (operationKey === 'audit_verified_payments') {
    const lock = acquireAuditRunLock(runId);
    if (!lock.acquired) {
      return { acquired: false, currentRunId: lock.currentRunId };
    }
  }

  // Database atomic state check & update
  const existing = await prisma.paymentOperationExecution.findUnique({
    where: { operationKey },
  });

  if (existing && existing.currentRunStatus === 'running' && existing.lastRunStartedAt && existing.lastRunStartedAt > staleThreshold) {
    if (existing.activeRunId !== runId) {
      // Already running
      return { acquired: false, currentRunId: existing.activeRunId || undefined };
    }
  }

  // Upsert running state
  await prisma.paymentOperationExecution.upsert({
    where: { operationKey },
    update: {
      operationName: OPERATION_NAMES[operationKey],
      currentRunStatus: 'running',
      activeRunId: runId,
      lastRunStartedAt: now,
      lastRunTrigger: trigger,
      lastRunError: null,
    },
    create: {
      operationKey,
      operationName: OPERATION_NAMES[operationKey],
      currentRunStatus: 'running',
      activeRunId: runId,
      lastRunStartedAt: now,
      lastRunTrigger: trigger,
      lastRunError: null,
    },
  });

  return { acquired: true };
}

/**
 * Records completion of a payment operation execution.
 * Preserves independent lastManualRunAt and lastAutomaticRunAt timestamps.
 */
export async function recordOperationComplete(params: {
  operationKey: PaymentOperationKey;
  runId: string;
  trigger: PaymentOperationTrigger;
  success: boolean;
  recordsProcessed?: number;
  error?: string | null;
}): Promise<void> {
  const { operationKey, runId, trigger, success, recordsProcessed = 0, error = null } = params;
  const now = new Date();

  // Release in-memory locks
  if (operationKey === 'sync_zoho_data') {
    releaseSyncRunLock(runId);
  } else if (operationKey === 'audit_verified_payments') {
    releaseAuditRunLock(runId);
  }

  const updateData: any = {
    currentRunStatus: 'idle',
    activeRunId: null,
    lastRunStatus: success ? 'success' : 'failed',
    lastRunCompletedAt: now,
    lastRunTrigger: trigger,
    lastRunRecordsProcessed: recordsProcessed,
    lastRunError: error || null,
  };

  // Crucial requirement: A manual run must NOT overwrite lastAutomaticRunAt,
  // and an automatic run must NOT overwrite lastManualRunAt.
  if (trigger === 'MANUAL') {
    updateData.lastManualRunAt = now;
  } else if (trigger === 'AUTOMATIC') {
    updateData.lastAutomaticRunAt = now;
  }

  try {
    await prisma.paymentOperationExecution.upsert({
      where: { operationKey },
      update: updateData,
      create: {
        operationKey,
        operationName: OPERATION_NAMES[operationKey],
        ...updateData,
      },
    });
  } catch (err) {
    console.error(`[recordOperationComplete] Failed to record completion for ${operationKey}:`, err);
  }
}

/**
 * Retrieves the latest execution metadata for all payment operations.
 */
export async function getPaymentOperationsMetadata(): Promise<{
  auditVerifiedPayments: PaymentOperationMetadata;
  syncZohoData: PaymentOperationMetadata;
}> {
  const records = await prisma.paymentOperationExecution.findMany({
    where: {
      operationKey: {
        in: ['audit_verified_payments', 'sync_zoho_data'],
      },
    },
  });

  const recordMap = new Map<string, any>(records.map((r) => [r.operationKey, r]));

  const formatMeta = (key: PaymentOperationKey): PaymentOperationMetadata => {
    const raw = recordMap.get(key);
    if (!raw) {
      return getDefaultMetadata(key);
    }

    // Check if in-memory active lock matches running status
    let currentStatus: PaymentOperationStatus = (raw.currentRunStatus as PaymentOperationStatus) || 'idle';
    let activeRunId = raw.activeRunId;

    // Concurrency / staleness safety check
    if (currentStatus === 'running' && raw.lastRunStartedAt) {
      const isStale = Date.now() - new Date(raw.lastRunStartedAt).getTime() > 10 * 60 * 1000;
      if (isStale) {
        currentStatus = 'failed';
        activeRunId = null;
      }
    }

    return {
      operationKey: key,
      operationName: raw.operationName || OPERATION_NAMES[key],
      currentRunStatus: currentStatus,
      activeRunId,
      lastRunStatus: (raw.lastRunStatus as PaymentOperationStatus) || null,
      lastRunStartedAt: raw.lastRunStartedAt ? raw.lastRunStartedAt.toISOString() : null,
      lastRunCompletedAt: raw.lastRunCompletedAt ? raw.lastRunCompletedAt.toISOString() : null,
      lastRunTrigger: (raw.lastRunTrigger as PaymentOperationTrigger) || null,
      lastRunRecordsProcessed: raw.lastRunRecordsProcessed || 0,
      lastRunError: raw.lastRunError || null,
      lastManualRunAt: raw.lastManualRunAt ? raw.lastManualRunAt.toISOString() : null,
      lastAutomaticRunAt: raw.lastAutomaticRunAt ? raw.lastAutomaticRunAt.toISOString() : null,
    };
  };

  return {
    auditVerifiedPayments: formatMeta('audit_verified_payments'),
    syncZohoData: formatMeta('sync_zoho_data'),
  };
}

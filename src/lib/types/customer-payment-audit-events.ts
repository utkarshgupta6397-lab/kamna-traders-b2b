export type CustomerPaymentAuditEventType =
  | 'AUDIT_STARTED'
  | 'AUDIT_PAGE_FETCHED'
  | 'AUDIT_PAYMENT_EVALUATED'
  | 'AUDIT_PAYMENT_INVALIDATED'
  | 'AUDIT_PROGRESS'
  | 'AUDIT_COMPLETED'
  | 'AUDIT_FAILED';

export interface BaseAuditEvent {
  type: CustomerPaymentAuditEventType;
  auditRunId: string;
  timestamp: string;
}

export interface AuditStartedEvent extends BaseAuditEvent {
  type: 'AUDIT_STARTED';
  startedAt: string;
  startDate: string;
  endDate: string;
  checkpointTimestamp: string | null;
  pageSize: number;
}

export interface AuditPageFetchedEvent extends BaseAuditEvent {
  type: 'AUDIT_PAGE_FETCHED';
  page: number;
  recordsReturned: number;
  hasMorePage: boolean;
  httpStatus: number;
  zohoCode: number;
  durationMs: number;
}

export interface AuditPaymentEvaluatedEvent extends BaseAuditEvent {
  type: 'AUDIT_PAYMENT_EVALUATED';
  paymentId: string;
  paymentNumber: string;
  action: 'BASELINE_CREATED' | 'VERIFIED_INTACT' | 'UNVERIFIED_IGNORED';
  details?: string;
}

export interface AuditPaymentInvalidatedEvent extends BaseAuditEvent {
  type: 'AUDIT_PAYMENT_INVALIDATED';
  paymentId: string;
  paymentNumber: string;
  reason: string;
  expectedAmount?: string | number;
  actualAmount?: string | number;
  expectedDate?: string;
  actualDate?: string;
  zohoPutSuccess: boolean;
}

export interface AuditProgressCounters {
  paymentsEvaluated: number;
  verifiedAudited: number;
  intactCount: number;
  invalidatedCount: number;
  baselinesCreated: number;
  unverifiedSkipped: number;
  listApiCalls: number;
  updateApiCalls: number;
  currentOperation: string;
}

export interface AuditProgressEvent extends BaseAuditEvent, AuditProgressCounters {
  type: 'AUDIT_PROGRESS';
}

export interface AuditFinalSummary {
  paymentsEvaluated: number;
  verifiedAudited: number;
  intactCount: number;
  invalidatedCount: number;
  baselinesCreated: number;
  unverifiedSkipped: number;
  listApiCalls: number;
  updateApiCalls: number;
  totalApiCalls: number;
  checkpointTimestamp: string | null;
  newCheckpointTimestamp: string | null;
  totalDurationMs: number;
}

export interface AuditCompletedEvent extends BaseAuditEvent {
  type: 'AUDIT_COMPLETED';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  finalSummary: AuditFinalSummary;
}

export interface AuditFailedEvent extends BaseAuditEvent {
  type: 'AUDIT_FAILED';
  stage: string;
  error: string;
}

export type CustomerPaymentAuditEvent =
  | AuditStartedEvent
  | AuditPageFetchedEvent
  | AuditPaymentEvaluatedEvent
  | AuditPaymentInvalidatedEvent
  | AuditProgressEvent
  | AuditCompletedEvent
  | AuditFailedEvent;

export type CustomerPaymentAuditEventCallback = (event: CustomerPaymentAuditEvent) => void;

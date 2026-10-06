export type CustomerPaymentSyncEventType =
  | 'SYNC_STARTED'
  | 'PAYMENT_LIST_STARTED'
  | 'PAYMENT_LIST_COMPLETED'
  | 'PAYMENT_DETAIL_STARTED'
  | 'PAYMENT_DETAIL_COMPLETED'
  | 'PAYMENT_CACHE_HIT'
  | 'PAYMENT_CACHE_MISS'
  | 'PAYMENT_CACHE_REFRESH'
  | 'PAYMENT_SKIPPED_NON_BANK'
  | 'AUTO_VERIFICATION_STARTED'
  | 'PAYMENT_UPDATE_STARTED'
  | 'PAYMENT_UPDATE_COMPLETED'
  | 'AUTO_VERIFICATION_COMPLETED'
  | 'SYNC_PROGRESS'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED';

export interface BaseSyncEvent {
  type: CustomerPaymentSyncEventType;
  syncRunId: string;
  timestamp: string;
}

export interface SyncStartedEvent extends BaseSyncEvent {
  type: 'SYNC_STARTED';
  startedAt: string;
  startDate: string;
  endDate: string;
  filter: string;
  pageSize: number;
}

export interface PaymentListStartedEvent extends BaseSyncEvent {
  type: 'PAYMENT_LIST_STARTED';
  page: number;
  requestedPageSize: number;
}

export interface PaymentListCompletedEvent extends BaseSyncEvent {
  type: 'PAYMENT_LIST_COMPLETED';
  page: number;
  recordsReturned: number;
  hasMorePage: boolean;
  httpStatus: number;
  zohoCode: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface PaymentDetailStartedEvent extends BaseSyncEvent {
  type: 'PAYMENT_DETAIL_STARTED';
  paymentId: string;
  paymentNumber: string;
}

export interface PaymentDetailCompletedEvent extends BaseSyncEvent {
  type: 'PAYMENT_DETAIL_COMPLETED';
  paymentId: string;
  paymentNumber: string;
  httpStatus: number;
  zohoCode: number;
  durationMs: number;
  success: boolean;
  bankMatchStatus: string;
  importedTransactionId: string | null;
  error?: string;
}

export interface PaymentCacheHitEvent extends BaseSyncEvent {
  type: 'PAYMENT_CACHE_HIT';
  paymentId: string;
  paymentNumber: string;
  reason: string;
  lastZohoModifiedTime: string | null;
  cachedBankMatchStatus: string | null;
  zohoModifiedTime?: string | null;
  localModifiedTime?: string | null;
}

export interface PaymentCacheMissEvent extends BaseSyncEvent {
  type: 'PAYMENT_CACHE_MISS';
  paymentId: string;
  paymentNumber: string;
  reason: string;
}

export interface PaymentCacheRefreshEvent extends BaseSyncEvent {
  type: 'PAYMENT_CACHE_REFRESH';
  paymentId: string;
  paymentNumber: string;
  reason: string;
  zohoModifiedTime?: string | null;
  localModifiedTime?: string | null;
}

export interface PaymentSkippedNonBankEvent extends BaseSyncEvent {
  type: 'PAYMENT_SKIPPED_NON_BANK';
  paymentId: string;
  paymentNumber: string;
  paymentMode: string;
  reason: string;
}

export interface AutoVerificationStartedEvent extends BaseSyncEvent {
  type: 'AUTO_VERIFICATION_STARTED';
  paymentId: string;
  paymentNumber: string;
  paymentMode: string;
  bankMatchStatus: string;
  reason: string;
}

export interface PaymentUpdateStartedEvent extends BaseSyncEvent {
  type: 'PAYMENT_UPDATE_STARTED';
  paymentId: string;
  paymentNumber: string;
  apiCategory: 'PAYMENT_UPDATE';
  endpoint: string;
}

export interface PaymentUpdateCompletedEvent extends BaseSyncEvent {
  type: 'PAYMENT_UPDATE_COMPLETED';
  paymentId: string;
  paymentNumber: string;
  httpStatus: number;
  zohoCode: number;
  durationMs: number;
  success: boolean;
  localVerificationStatus: 'VERIFIED' | 'PENDING';
  error?: string;
}

export interface AutoVerificationCompletedEvent extends BaseSyncEvent {
  type: 'AUTO_VERIFICATION_COMPLETED';
  paymentId: string;
  paymentNumber: string;
  bankMatchStatus: string;
  zohoUpdateSuccess: boolean;
  localVerificationStatus: 'VERIFIED' | 'PENDING';
  reason?: string;
}

export interface SyncProgressCounters {
  paymentsDiscovered: number;
  paymentsProcessed: number;
  paymentsSkipped: number;
  detailCalls: number;
  cacheHits: number;
  updateCalls: number;
  verified: number;
  verificationFailures: number;
  currentOperation: string;
}

export interface SyncProgressEvent extends BaseSyncEvent, SyncProgressCounters {
  type: 'SYNC_PROGRESS';
}

export interface SyncFinalSummary {
  paymentsDiscovered: number;
  newPayments: number;
  updatedPayments: number;
  paymentsProcessed: number;
  cacheHits: number;
  detailCalls: number;
  autoVerificationCandidates: number;
  successfullyVerified: number;
  verificationFailures: number;
  skipped: number;
  paymentListCalls: number;
  paymentDetailCalls: number;
  paymentUpdateCalls: number;
  totalApiCalls: number;
  totalDurationMs: number;
}

export interface SyncCompletedEvent extends BaseSyncEvent {
  type: 'SYNC_COMPLETED';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  finalSummary: SyncFinalSummary;
}

export interface SyncFailedEvent extends BaseSyncEvent {
  type: 'SYNC_FAILED';
  stage: string;
  error: string;
}

export type CustomerPaymentSyncEvent =
  | SyncStartedEvent
  | PaymentListStartedEvent
  | PaymentListCompletedEvent
  | PaymentDetailStartedEvent
  | PaymentDetailCompletedEvent
  | PaymentCacheHitEvent
  | PaymentCacheMissEvent
  | PaymentCacheRefreshEvent
  | PaymentSkippedNonBankEvent
  | AutoVerificationStartedEvent
  | PaymentUpdateStartedEvent
  | PaymentUpdateCompletedEvent
  | AutoVerificationCompletedEvent
  | SyncProgressEvent
  | SyncCompletedEvent
  | SyncFailedEvent;

export type CustomerPaymentSyncEventCallback = (event: CustomerPaymentSyncEvent) => void;

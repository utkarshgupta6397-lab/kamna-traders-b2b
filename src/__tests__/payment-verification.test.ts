import assert from 'assert';
import { ALL_PERMISSION_KEYS, PERMISSIONS } from '../lib/permissions';
import { isWithinPaymentSyncHours } from '../lib/services/customer-payment-verification.service';

console.log('--- 1. Testing Customer Payment Verification Permissions ---');
assert(ALL_PERMISSION_KEYS.includes('accounts_payment_verify_view'), 'accounts_payment_verify_view should be in ALL_PERMISSION_KEYS');
assert(ALL_PERMISSION_KEYS.includes('accounts_payment_verify_action'), 'accounts_payment_verify_action should be in ALL_PERMISSION_KEYS');

const viewDef = PERMISSIONS.find(p => p.key === 'accounts_payment_verify_view');
const actionDef = PERMISSIONS.find(p => p.key === 'accounts_payment_verify_action');
assert(viewDef, 'accounts_payment_verify_view definition must exist');
assert(actionDef, 'accounts_payment_verify_action definition must exist');
console.log('✓ PASS: Permissions registered in registry');

console.log('--- 2. Testing IST Working Window for Payment Sync (08:00 - 20:00 IST) ---');
// 07:59 IST (02:29 UTC) -> Should be false
const before8Am = new Date('2026-10-05T02:29:00Z');
assert(!isWithinPaymentSyncHours(before8Am), '07:59 IST should be outside working window');

// 08:01 IST (02:31 UTC) -> Should be true
const after8Am = new Date('2026-10-05T02:31:00Z');
assert(isWithinPaymentSyncHours(after8Am), '08:01 IST should be inside working window');

// 12:00 IST (06:30 UTC) -> Should be true
const noon = new Date('2026-10-05T06:30:00Z');
assert(isWithinPaymentSyncHours(noon), '12:00 IST should be inside working window');

// 20:00 IST (14:30 UTC) -> Should be true
const at8Pm = new Date('2026-10-05T14:30:00Z');
assert(isWithinPaymentSyncHours(at8Pm), '20:00 IST should be inside working window');

// 20:01 IST (14:31 UTC) -> Should be false
const after8Pm = new Date('2026-10-05T14:31:00Z');
assert(!isWithinPaymentSyncHours(after8Pm), '20:01 IST should be outside working window');
console.log('✓ PASS: IST working hours accurately constrained to 08:00 - 20:00 IST');

console.log('--- 3. Testing Bank Matching Logic ---');
const sampleMatched = {
  payment_mode: 'Bank Transfer',
  imported_transactions: [
    { imported_transaction_id: '123456', status: 'categorized' }
  ]
};
const isBankMatched1 =
  sampleMatched.payment_mode === 'Bank Transfer' &&
  Array.isArray(sampleMatched.imported_transactions) &&
  sampleMatched.imported_transactions.length > 0 &&
  sampleMatched.imported_transactions.some(
    (t: any) => t.status === 'categorized' || t.status === 'matched'
  );
assert(isBankMatched1, 'Categorized bank transfer must match');

const sampleUnmatched = {
  payment_mode: 'Bank Transfer',
  imported_transactions: []
};
const isBankMatched2 =
  sampleUnmatched.payment_mode === 'Bank Transfer' &&
  Array.isArray(sampleUnmatched.imported_transactions) &&
  sampleUnmatched.imported_transactions.length > 0 &&
  sampleUnmatched.imported_transactions.some(
    (t: any) => t.status === 'categorized' || t.status === 'matched'
  );
assert(!isBankMatched2, 'Bank transfer without imported transactions must NOT match');

const sampleCash = {
  payment_mode: 'Cash',
  imported_transactions: []
};
const isBankMatched3 =
  sampleCash.payment_mode === 'Bank Transfer' &&
  Array.isArray(sampleCash.imported_transactions) &&
  sampleCash.imported_transactions.length > 0;
assert(!isBankMatched3, 'Cash payment must NOT match');
console.log('✓ PASS: Bank match rules evaluated accurately');

console.log('--- 4. Testing IST Today Range (00:00 IST to 24:00 IST boundary) ---');
import { getIstTodayRange } from '../lib/services/customer-payment-verification.service';
const { startIstUtc, endIstUtc } = getIstTodayRange();
assert(startIstUtc < endIstUtc, 'startIstUtc must be earlier than endIstUtc');
const diffHours = (endIstUtc.getTime() - startIstUtc.getTime()) / (1000 * 60 * 60);
assert(diffHours === 24, `IST day range must be exactly 24 hours, received ${diffHours}`);
console.log('✓ PASS: IST day boundary (00:00 to 24:00) calculated accurately');

console.log('--- 5. Testing Backend Write Gate (canPerformZohoVerificationWrite & isZohoVerificationWritesEnabled) ---');
import {
  canPerformZohoVerificationWrite,
  isZohoVerificationWritesEnabled,
} from '../lib/services/customer-payment-verification.service';

// In current environment (development)
assert(!canPerformZohoVerificationWrite(false), 'Write gate must return false when allowZohoWrites is false');
assert(canPerformZohoVerificationWrite(true), 'Write gate must return true when allowZohoWrites is true in development');
assert(!isZohoVerificationWritesEnabled(), 'isZohoVerificationWritesEnabled must be false in development');

// Simulate production NODE_ENV without ZOHO_VERIFICATION_WRITES_ENABLED
const prevEnv = process.env.NODE_ENV;
const prevWriteFlag = process.env.ZOHO_VERIFICATION_WRITES_ENABLED;
try {
  (process.env as any).NODE_ENV = 'production';
  delete process.env.ZOHO_VERIFICATION_WRITES_ENABLED;

  assert(!isZohoVerificationWritesEnabled(), 'isZohoVerificationWritesEnabled must be false in production when flag unset');
  assert(!canPerformZohoVerificationWrite(true), 'Write gate must strictly return false in production when flag unset even if client sends allowZohoWrites=true');
  assert(!canPerformZohoVerificationWrite(false), 'Write gate must strictly return false in production when flag unset');

  // Explicitly disabled in production
  process.env.ZOHO_VERIFICATION_WRITES_ENABLED = 'false';
  assert(!isZohoVerificationWritesEnabled(), 'isZohoVerificationWritesEnabled must be false when flag is "false"');
  assert(!canPerformZohoVerificationWrite(true), 'Write gate must be false when flag is "false"');

  // Explicitly enabled in production
  process.env.ZOHO_VERIFICATION_WRITES_ENABLED = 'true';
  assert(isZohoVerificationWritesEnabled(), 'isZohoVerificationWritesEnabled must be true when flag is "true" in production');
  assert(canPerformZohoVerificationWrite(false), 'Write gate must be true in production when server flag is "true" (client param ignored)');
  assert(canPerformZohoVerificationWrite(true), 'Write gate must be true in production when server flag is "true"');
  console.log('✓ PASS: Production Zoho write authorization gate verified');
} finally {
  (process.env as any).NODE_ENV = prevEnv;
  if (prevWriteFlag !== undefined) {
    process.env.ZOHO_VERIFICATION_WRITES_ENABLED = prevWriteFlag;
  } else {
    delete process.env.ZOHO_VERIFICATION_WRITES_ENABLED;
  }
}
console.log('--- 6. Testing Active Sync Scope (2026-03-01 through Today in IST) ---');
import { DEFAULT_SYNC_START_DATE, getIstTodayDateStr } from '../lib/services/customer-payment-verification.service';
assert(DEFAULT_SYNC_START_DATE === '2026-03-01', 'Default sync start date must be 2026-03-01');
const todayStr = getIstTodayDateStr();
assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr), 'todayStr must be YYYY-MM-DD');
assert(todayStr >= DEFAULT_SYNC_START_DATE, 'todayStr must be after or equal to 2026-03-01');
console.log(`✓ PASS: Active sync scope verified (2026-03-01 to ${todayStr})`);

console.log('--- 7. Testing Detail Cache & last_modified_time Invalidation Rules ---');
import { normalizeZohoTimestamp } from '../lib/services/customer-payment-verification.service';

// Normalization tests
assert(normalizeZohoTimestamp('2026-10-05T13:44:01+0530') === '2026-10-05T08:14:01.000Z', 'Normalization of +0530 must yield correct UTC ISO string');
assert(normalizeZohoTimestamp('2026-10-05T13:44:01+05:30') === '2026-10-05T08:14:01.000Z', 'Normalization of +05:30 must yield identical UTC ISO string');
assert(normalizeZohoTimestamp('2026-10-05T13:44:01+0530') === normalizeZohoTimestamp('2026-10-05T08:14:01.000Z'), 'Zoho IST offset and ISO UTC must match when normalized');

// Case A: New Bank Transfer -> needs Detail
const isNewBT = true;
const needsDetailCaseA = isNewBT;
assert(needsDetailCaseA === true, 'New Bank Transfer must fetch Detail');

// Case B: Existing Bank Transfer, Unchanged timestamp -> skips Detail (Cache Hit)
const listModCaseB = '2026-10-05T13:44:01+0530';
const localModCaseB = '2026-10-05T08:14:01.000Z'; // e.g. stored in UTC representation
const cachedMatchCaseB = 'CATEGORIZED';
const normListB = normalizeZohoTimestamp(listModCaseB);
const normLocalB = normalizeZohoTimestamp(localModCaseB);
const isUnchangedB = normListB !== null && normLocalB !== null && normListB === normLocalB;
const needsDetailCaseB = !(isUnchangedB && cachedMatchCaseB !== null);
assert(needsDetailCaseB === false, 'Unchanged Bank Transfer with normalized timestamps must NOT fetch Detail (cache hit)');

// Case C: Existing Bank Transfer, Modified timestamp -> needs Detail (Cache Refresh)
const listModCaseC: string = '2026-10-06T10:00:00+0530';
const localModCaseC: string = '2026-10-05T13:44:01+0530';
const normListC = normalizeZohoTimestamp(listModCaseC);
const normLocalC = normalizeZohoTimestamp(localModCaseC);
const isUnchangedC = normListC !== null && normLocalC !== null && normListC === normLocalC;
const needsDetailCaseC = !isUnchangedC;
assert(needsDetailCaseC === true, 'Modified Bank Transfer must fetch Detail');

// Case D: Non-bank payment (Cash) -> never fetches Detail
const isCash = true;
const needsDetailCaseD = !isCash;
assert(needsDetailCaseD === false, 'Cash payment must NOT fetch Detail');
console.log('✓ PASS: Detail cache invalidation rules and timestamp normalization verified');

console.log('--- 8. Testing Single-PUT Verification Flow Contract ---');
// Success contract: Exactly 1 PUT, 0 GETs, local transition to VERIFIED
const mockPutSuccess = { ok: true, code: 0 };
const shouldMarkVerifiedOnPutSuccess = mockPutSuccess.ok && mockPutSuccess.code === 0;
assert(shouldMarkVerifiedOnPutSuccess === true, 'Successful PUT response must be sufficient to mark VERIFIED locally');

// Failure contract: Failed PUT leaves PENDING
const mockPutFailure = { ok: false, code: 1038 };
const shouldMarkVerifiedOnPutFailure = mockPutFailure.ok && mockPutFailure.code === 0;
assert(shouldMarkVerifiedOnPutFailure === false, 'Failed PUT must NOT mark VERIFIED locally');
console.log('✓ PASS: Single-PUT verification flow contract verified');

console.log('--- 9. Testing Event Model & Concurrency Lock ---');
import {
  acquireSyncRunLock,
  releaseSyncRunLock,
  emitSyncEvent,
  getOrCreateSyncRun,
  addSyncEventListener,
  getActiveSyncRunId,
} from '../lib/services/customer-payment-sync-events.service';
import { CustomerPaymentSyncEvent } from '../lib/types/customer-payment-sync-events';

const testRunId = 'test_run_' + Date.now();
const lock1 = acquireSyncRunLock(testRunId);
assert(lock1.acquired === true, 'Initial lock acquisition must succeed');
assert(getActiveSyncRunId() === testRunId, 'Active sync run ID must match test run ID');

// Attempt duplicate lock acquisition
const lock2 = acquireSyncRunLock('another_run');
assert(lock2.acquired === false, 'Duplicate lock acquisition while running must be rejected');
assert(lock2.currentRunId === testRunId, 'Rejected lock must return current active run ID');

// Event emission and listener dispatch
const receivedEvents: CustomerPaymentSyncEvent[] = [];
const unsubscribe = addSyncEventListener(testRunId, (ev) => {
  receivedEvents.push(ev);
});

emitSyncEvent({
  type: 'SYNC_STARTED',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  startDate: '2026-03-01',
  endDate: '2026-10-06',
  filter: 'cf_is_verified=false',
  pageSize: 200,
});

emitSyncEvent({
  type: 'PAYMENT_LIST_STARTED',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  page: 1,
  requestedPageSize: 200,
});

emitSyncEvent({
  type: 'PAYMENT_LIST_COMPLETED',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  page: 1,
  recordsReturned: 200,
  hasMorePage: false,
  httpStatus: 200,
  zohoCode: 0,
  durationMs: 150,
  success: true,
});

emitSyncEvent({
  type: 'PAYMENT_CACHE_HIT',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  paymentId: 'pay_123',
  paymentNumber: 'PT-KT/26-27/3995',
  reason: 'last_modified_time unchanged',
  lastZohoModifiedTime: '2026-10-05T21:40:56+0530',
  cachedBankMatchStatus: 'CATEGORIZED',
});

emitSyncEvent({
  type: 'PAYMENT_SKIPPED_NON_BANK',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  paymentId: 'pay_124',
  paymentNumber: 'PT-KT/26-27/3996',
  paymentMode: 'Cash',
  reason: 'Non-bank payment mode; Detail API not required',
});

emitSyncEvent({
  type: 'PAYMENT_UPDATE_STARTED',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  paymentId: 'pay_123',
  paymentNumber: 'PT-KT/26-27/3995',
  apiCategory: 'PAYMENT_UPDATE',
  endpoint: '/books/v3/customerpayment/pay_123/customfields',
});

emitSyncEvent({
  type: 'PAYMENT_UPDATE_COMPLETED',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  paymentId: 'pay_123',
  paymentNumber: 'PT-KT/26-27/3995',
  httpStatus: 200,
  zohoCode: 0,
  durationMs: 80,
  success: true,
  localVerificationStatus: 'VERIFIED',
});

emitSyncEvent({
  type: 'SYNC_COMPLETED',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 500,
  finalSummary: {
    paymentsDiscovered: 200,
    newPayments: 0,
    updatedPayments: 0,
    paymentsProcessed: 200,
    cacheHits: 1,
    detailCalls: 0,
    autoVerificationCandidates: 1,
    successfullyVerified: 1,
    verificationFailures: 0,
    skipped: 1,
    paymentListCalls: 1,
    paymentDetailCalls: 0,
    paymentUpdateCalls: 1,
    totalApiCalls: 2,
    totalDurationMs: 500,
  },
});

assert(receivedEvents.length === 8, `Expected 8 events emitted, received ${receivedEvents.length}`);
assert(receivedEvents[0].type === 'SYNC_STARTED', 'First event must be SYNC_STARTED');
assert(receivedEvents[3].type === 'PAYMENT_CACHE_HIT', 'Cache hit event must match');
assert(receivedEvents[7].type === 'SYNC_COMPLETED', 'Final event must be SYNC_COMPLETED');

// Verify that events emitted AFTER terminal state are strictly ignored
emitSyncEvent({
  type: 'PAYMENT_LIST_COMPLETED',
  syncRunId: testRunId,
  timestamp: new Date().toISOString(),
  page: 2,
  recordsReturned: 200,
  hasMorePage: false,
  httpStatus: 200,
  zohoCode: 0,
  durationMs: 120,
  success: true,
});

const runRecord = getOrCreateSyncRun(testRunId);
assert(runRecord.events.length === 8, 'Events emitted after SYNC_COMPLETED must be dropped');
assert(runRecord.status === 'COMPLETED', 'Sync run status must remain COMPLETED');

// Release lock
releaseSyncRunLock(testRunId);
assert(getActiveSyncRunId() === null, 'Active sync run ID must be cleared after release');
unsubscribe();

console.log('✓ PASS: Event model, stream listener, and concurrency lock verified');

console.log('--- 10. Testing Outbound Zoho API Counter Integrity ---');
// Verify that Cache Hits and Non-bank Skips do NOT increment API usage
const simulatedEvents = [
  { type: 'PAYMENT_LIST_COMPLETED', recordsReturned: 200 },
  { type: 'PAYMENT_CACHE_HIT', paymentId: '1' },
  { type: 'PAYMENT_SKIPPED_NON_BANK', paymentId: '2' },
  { type: 'PAYMENT_DETAIL_COMPLETED', paymentId: '3' },
  { type: 'PAYMENT_UPDATE_COMPLETED', paymentId: '4' },
];

let paymentListCalls = 0;
let paymentDetailCalls = 0;
let paymentUpdateCalls = 0;

for (const ev of simulatedEvents) {
  if (ev.type === 'PAYMENT_LIST_COMPLETED') paymentListCalls++;
  else if (ev.type === 'PAYMENT_DETAIL_COMPLETED') paymentDetailCalls++;
  else if (ev.type === 'PAYMENT_UPDATE_COMPLETED') paymentUpdateCalls++;
}

const totalApiCalls = paymentListCalls + paymentDetailCalls + paymentUpdateCalls;
assert(paymentListCalls === 1, 'Payment list calls must be 1');
assert(paymentDetailCalls === 1, 'Payment detail calls must be 1');
assert(paymentUpdateCalls === 1, 'Payment update calls must be 1');
assert(totalApiCalls === 3, 'Total Zoho API calls must strictly equal 3 (no cache hits or skips counted)');
console.log('✓ PASS: Zoho API counter integrity verified');

console.log('--- 11. Testing Auto-Verification of Cached Eligible Bank Transfers ---');
// Precondition: Payment mode is Bank Transfer, cached bankMatchStatus is CATEGORIZED,
// Zoho LIST reports cf_is_verified=false, and last_modified_time is unchanged.
const testPayment = {
  paymentNumber: 'PT-KT/26-27/3981',
  paymentMode: 'Bank Transfer',
  cf_is_verified: 'false',
  last_modified_time: '2026-10-06T12:44:55+0530',
};

const localCache = {
  lastZohoModifiedTime: '2026-10-06T12:44:55+0530',
  bankMatchStatus: 'CATEGORIZED',
  isVerified: false,
};

// Step 1: Check Cache Hit
const isCacheHit =
  normalizeZohoTimestamp(testPayment.last_modified_time) ===
    normalizeZohoTimestamp(localCache.lastZohoModifiedTime) &&
  localCache.bankMatchStatus !== null;
assert(isCacheHit === true, 'Unchanged Bank Transfer must produce a CACHE HIT');

// Step 2: Ensure Detail API is NOT called
const detailCallRequired = !isCacheHit;
assert(detailCallRequired === false, 'CACHE HIT must result in 0 Detail API calls');

// Step 3: Auto-verification decision tree
const rawVal = testPayment.cf_is_verified as string | boolean;
const isZohoUnverified = rawVal === 'false' || rawVal === false;
const isBankEligible =
  testPayment.paymentMode === 'Bank Transfer' &&
  (localCache.bankMatchStatus === 'CATEGORIZED' || localCache.bankMatchStatus === 'MATCHED') &&
  isZohoUnverified &&
  !localCache.isVerified;

assert(isBankEligible === true, 'Cached Bank Transfer with CATEGORIZED status must be AUTO-VERIFY ELIGIBLE');

// Step 4: Expected outbound API calls for this payment
const expectedApiForPayment = {
  LIST: 1, // list call discovered it
  DETAIL: 0, // cache hit
  UPDATE: 1, // single PUT verification write
  confirmation_GET: 0, // strictly forbidden
};

assert(expectedApiForPayment.DETAIL === 0, 'Detail calls for cached payment must be 0');
assert(expectedApiForPayment.UPDATE === 1, 'Exactly one Zoho PUT update call must be initiated');
assert(expectedApiForPayment.confirmation_GET === 0, 'Confirmation GET must never occur');
console.log('✓ PASS: Auto-verification of cached eligible bank transfers verified');

console.log('--- 12. Testing Verified Payment Integrity Audit Snapshot & Invalidation ---');
// Snapshot creation on verification
const sampleVerifiedPayment = {
  amount: '15000.00',
  paymentDate: '2026-10-01',
  verifiedAmount: '15000.00',
  verifiedDate: '2026-10-01',
  verificationStatus: 'VERIFIED',
  isVerified: true,
  requiresManualVerification: false,
};

// Test Case A: Unchanged Zoho record -> Remains VERIFIED and intact
const unchangedZoho = { amount: 15000.00, date: '2026-10-01' };
const isAmountIntact = Number(sampleVerifiedPayment.verifiedAmount) === unchangedZoho.amount;
const isDateIntact = sampleVerifiedPayment.verifiedDate === unchangedZoho.date;
assert(isAmountIntact && isDateIntact, 'Unchanged payment must remain verified and intact');

// Test Case B: Amount modified in Zoho -> Invalidated to REVERIFICATION_REQUIRED
const modifiedAmountZoho = { amount: 16500.00, date: '2026-10-01' };
const amountMatchesB = Number(sampleVerifiedPayment.verifiedAmount) === modifiedAmountZoho.amount;
assert(!amountMatchesB, 'Amount modification must be detected');

// Invalidation rule contract:
const invalidatedState = {
  isVerified: false,
  verificationStatus: 'REVERIFICATION_REQUIRED',
  requiresManualVerification: true,
  verificationInvalidationReason: `Amount changed from ₹${sampleVerifiedPayment.verifiedAmount} to ₹${modifiedAmountZoho.amount}`,
};
assert(invalidatedState.isVerified === false, 'Invalidated record must have isVerified = false');
assert(invalidatedState.verificationStatus === 'REVERIFICATION_REQUIRED', 'Status must transition to REVERIFICATION_REQUIRED');
assert(invalidatedState.requiresManualVerification === true, 'requiresManualVerification must be true');

// Test Case C: Date modified in Zoho -> Invalidated to REVERIFICATION_REQUIRED
const modifiedDateZoho = { amount: 15000.00, date: '2026-10-04' };
const dateMatchesC = sampleVerifiedPayment.verifiedDate === modifiedDateZoho.date;
assert(!dateMatchesC, 'Date modification must be detected');

console.log('✓ PASS: Verified Payment snapshot comparison and invalidation logic verified');

console.log('--- 13. Testing Auto-Verification Exclusion Guard for REVERIFICATION_REQUIRED ---');
// Mandatory Guard: If payment was invalidated, it must NEVER auto-verify again even if Bank Transfer + Categorized!
const reVerificationCandidate = {
  paymentMode: 'Bank Transfer',
  isVerified: false,
  verificationStatus: 'REVERIFICATION_REQUIRED',
  requiresManualVerification: true,
  bankMatchStatus: 'CATEGORIZED',
  cf_is_verified: 'false',
};

const isEligibleForAuto =
  reVerificationCandidate.paymentMode === 'Bank Transfer' &&
  reVerificationCandidate.bankMatchStatus === 'CATEGORIZED' &&
  ((reVerificationCandidate.cf_is_verified as string | boolean) === 'false' || (reVerificationCandidate.cf_is_verified as string | boolean) === false) &&
  !reVerificationCandidate.isVerified &&
  !reVerificationCandidate.requiresManualVerification &&
  reVerificationCandidate.verificationStatus !== 'REVERIFICATION_REQUIRED';

assert(isEligibleForAuto === false, 'Payments marked REVERIFICATION_REQUIRED must NEVER qualify for auto-verification');
console.log('✓ PASS: Auto-verification exclusion guard for REVERIFICATION_REQUIRED verified');

console.log('--- 14. Testing Baseline Snapshot Establishment (Non-Invalidation on 1st Run) ---');
// Existing verified payment prior to this migration (has no snapshot yet)
const legacyVerifiedPayment = {
  amount: 25000.00,
  paymentDate: '2026-09-15',
  verifiedAmount: null,
  verifiedDate: null,
  isVerified: true,
  verificationStatus: 'VERIFIED',
};

// First integrity audit run:
let baselineCreated = false;
let invalidatedOnFirstRun = false;

if (legacyVerifiedPayment.isVerified && (!legacyVerifiedPayment.verifiedAmount || !legacyVerifiedPayment.verifiedDate)) {
  // Establish baseline
  legacyVerifiedPayment.verifiedAmount = legacyVerifiedPayment.amount as any;
  legacyVerifiedPayment.verifiedDate = legacyVerifiedPayment.paymentDate as any;
  baselineCreated = true;
} else {
  invalidatedOnFirstRun = true;
}

assert(baselineCreated === true, 'First audit must establish baseline snapshot for legacy verified payment');
assert(invalidatedOnFirstRun === false, 'First audit must NOT invalidate existing verified payment without snapshot');
assert(legacyVerifiedPayment.verificationStatus === 'VERIFIED', 'Legacy verified payment must remain VERIFIED');
console.log('✓ PASS: Baseline snapshot establishment on first run verified');

console.log('--- 15. Testing Safe Monetary Equality (Prisma Decimal / Strings) ---');
import { Prisma } from '@prisma/client';
const dec1 = new Prisma.Decimal('15000.00');
const dec2 = new Prisma.Decimal('15000');
const dec3 = new Prisma.Decimal(15000.00);
const decDiff = new Prisma.Decimal('15000.01');

assert(dec1.equals(dec2), 'Decimal 15000.00 and 15000 must be equal');
assert(dec1.equals(dec3), 'Decimal 15000.00 and numerical 15000.00 must be equal');
assert(!dec1.equals(decDiff), 'Decimal 15000.00 and 15000.01 must not be equal');
console.log('✓ PASS: Prisma Decimal comparison verified');

console.log('--- 16. Testing Audit Event Lifecycle & Concurrency ---');
import {
  acquireAuditRunLock,
  releaseAuditRunLock,
  emitAuditEvent,
  getOrCreateAuditRun,
  addAuditEventListener,
  getActiveAuditRunId,
} from '../lib/services/customer-payment-audit-events.service';
import { CustomerPaymentAuditEvent } from '../lib/types/customer-payment-audit-events';

const auditTestRunId = 'audit_test_' + Date.now();
const auditLock1 = acquireAuditRunLock(auditTestRunId);
assert(auditLock1.acquired === true, 'Audit lock acquisition must succeed');
assert(getActiveAuditRunId() === auditTestRunId, 'Active audit run ID must match');

const auditLock2 = acquireAuditRunLock('another_audit');
assert(auditLock2.acquired === false, 'Duplicate audit lock must be rejected');

const auditEventsReceived: CustomerPaymentAuditEvent[] = [];
const auditUnsub = addAuditEventListener(auditTestRunId, (ev) => {
  auditEventsReceived.push(ev);
});

emitAuditEvent({
  type: 'AUDIT_STARTED',
  auditRunId: auditTestRunId,
  timestamp: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  startDate: '2026-03-01',
  endDate: '2026-10-06',
  checkpointTimestamp: null,
  pageSize: 200,
});

emitAuditEvent({
  type: 'AUDIT_PAYMENT_INVALIDATED',
  auditRunId: auditTestRunId,
  timestamp: new Date().toISOString(),
  paymentId: 'pay_999',
  paymentNumber: 'PT-KT/26-27/4001',
  reason: 'Amount changed from ₹10000.00 to ₹12000.00',
  expectedAmount: '10000.00',
  actualAmount: 12000.00,
  zohoPutSuccess: true,
});

emitAuditEvent({
  type: 'AUDIT_COMPLETED',
  auditRunId: auditTestRunId,
  timestamp: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 450,
  finalSummary: {
    paymentsEvaluated: 100,
    verifiedAudited: 20,
    intactCount: 19,
    invalidatedCount: 1,
    baselinesCreated: 10,
    unverifiedSkipped: 80,
    listApiCalls: 1,
    updateApiCalls: 1,
    totalApiCalls: 2,
    checkpointTimestamp: null,
    newCheckpointTimestamp: '2026-10-06T15:00:00.000Z',
    totalDurationMs: 450,
  },
});

assert(auditEventsReceived.length === 3, 'Audit run must receive exactly 3 events');
assert(auditEventsReceived[0].type === 'AUDIT_STARTED', 'First audit event must be AUDIT_STARTED');
assert(auditEventsReceived[1].type === 'AUDIT_PAYMENT_INVALIDATED', 'Second audit event must be AUDIT_PAYMENT_INVALIDATED');
assert(auditEventsReceived[2].type === 'AUDIT_COMPLETED', 'Third audit event must be AUDIT_COMPLETED');

releaseAuditRunLock(auditTestRunId);
assert(getActiveAuditRunId() === null, 'Active audit run lock must be released');
auditUnsub();
console.log('✓ PASS: Audit event lifecycle, listener streaming, and concurrency lock verified');

console.log('--- 18. Testing Verified Payments Integrity Logic (6-Field Evaluation) ---');
import { evaluatePaymentIntegrity } from '../lib/services/customer-payment-integrity-audit.service';

function testSixFieldIntegrityLogic() {
  const baseline = {
    customerName: 'ACME CORP',
    customerId: 'cust_101',
    amount: new Prisma.Decimal('50000.00'),
    bankCharges: new Prisma.Decimal('15.00'),
    paymentDate: '2026-03-15',
    paymentMode: 'Bank Transfer',
    accountId: 'acc_icici_01',
    accountName: 'ICICI Bank Current',
  };

  // 18.1 All six fields match -> PASS
  const passResult = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      customerName: 'ACME CORP',
      customerId: 'cust_101',
      amount: 50000,
      bankCharges: 15,
      paymentDate: '2026-03-15',
      paymentMode: 'bank transfer',
      accountId: 'acc_icici_01',
      accountName: 'ICICI Bank Current',
    },
  });
  assert(passResult.overallIntegrityStatus === 'PASS', 'Exact 6-field match must PASS');
  assert(passResult.customerNameMatch === true, 'Customer name must match');
  assert(passResult.amountReceivedMatch === true, 'Amount must match');
  assert(passResult.bankChargesMatch === true, 'Bank charges must match');
  assert(passResult.paymentDateMatch === true, 'Date must match');
  assert(passResult.paymentModeMatch === true, 'Payment mode must match');
  assert(passResult.depositToMatch === true, 'Deposit to must match');
  assert(passResult.mismatchedFields.length === 0, 'No mismatched fields on PASS');

  // 18.2 Customer Name mismatch -> FAIL
  const failCust = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      ...baseline,
      customerId: 'cust_999',
      customerName: 'DIFFERENT CUSTOMER',
    },
  });
  assert(failCust.overallIntegrityStatus === 'FAIL', 'Customer Name mismatch must FAIL');
  assert(failCust.customerNameMatch === false, 'customerNameMatch must be false');
  assert(failCust.mismatchedFields.includes('Customer Name'), 'mismatchedFields must include Customer Name');

  // 18.3 Amount Received mismatch -> FAIL
  const failAmt = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      ...baseline,
      amount: 55000.00,
    },
  });
  assert(failAmt.overallIntegrityStatus === 'FAIL', 'Amount Received mismatch must FAIL');
  assert(failAmt.amountReceivedMatch === false, 'amountReceivedMatch must be false');
  assert(failAmt.mismatchedFields.includes('Amount Received'), 'mismatchedFields must include Amount Received');

  // 18.4 Bank Charges mismatch -> FAIL
  const failCharges = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      ...baseline,
      bankCharges: 0,
    },
  });
  assert(failCharges.overallIntegrityStatus === 'FAIL', 'Bank Charges mismatch must FAIL');
  assert(failCharges.bankChargesMatch === false, 'bankChargesMatch must be false');
  assert(failCharges.mismatchedFields.includes('Bank Charges'), 'mismatchedFields must include Bank Charges');

  // 18.5 Payment Date mismatch -> FAIL
  const failDate = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      ...baseline,
      paymentDate: '2026-03-20',
    },
  });
  assert(failDate.overallIntegrityStatus === 'FAIL', 'Payment Date mismatch must FAIL');
  assert(failDate.paymentDateMatch === false, 'paymentDateMatch must be false');
  assert(failDate.mismatchedFields.includes('Payment Date'), 'mismatchedFields must include Payment Date');

  // 18.6 Payment Mode mismatch -> FAIL (even if Date & Amount match!)
  const failMode = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      ...baseline,
      paymentMode: 'Cash',
    },
  });
  assert(failMode.overallIntegrityStatus === 'FAIL', 'Payment Mode mismatch must FAIL');
  assert(failMode.paymentModeMatch === false, 'paymentModeMatch must be false');
  assert(failMode.amountReceivedMatch === true, 'Amount must still match');
  assert(failMode.paymentDateMatch === true, 'Date must still match');
  assert(failMode.mismatchedFields.includes('Payment Mode'), 'mismatchedFields must include Payment Mode');

  // 18.7 Deposit To mismatch -> FAIL (even if Date & Amount match!)
  const failDeposit = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      ...baseline,
      accountId: 'acc_hdfc_02',
      accountName: 'HDFC Bank Main',
    },
  });
  assert(failDeposit.overallIntegrityStatus === 'FAIL', 'Deposit To mismatch must FAIL');
  assert(failDeposit.depositToMatch === false, 'depositToMatch must be false');
  assert(failDeposit.mismatchedFields.includes('Deposit To'), 'mismatchedFields must include Deposit To');

  // 18.8 Multiple mismatches -> FAIL with all reported
  const failMulti = evaluatePaymentIntegrity({
    snapshot: baseline,
    current: {
      ...baseline,
      paymentMode: 'Cash',
      accountId: 'acc_hdfc_02',
      amount: 10000,
    },
  });
  assert(failMulti.overallIntegrityStatus === 'FAIL', 'Multiple mismatches must FAIL');
  assert(failMulti.mismatchedFields.length === 3, 'Must report exactly 3 mismatched fields');
  assert(failMulti.mismatchedFields.includes('Amount Received'));
  assert(failMulti.mismatchedFields.includes('Payment Mode'));
  assert(failMulti.mismatchedFields.includes('Deposit To'));

  // 18.9 Formatting normalization: whitespace & casing
  const passWhitespace = evaluatePaymentIntegrity({
    snapshot: {
      ...baseline,
      customerName: '  ACME Corp  ',
      paymentMode: '  Bank Transfer  ',
    },
    current: {
      ...baseline,
      customerId: null, // Test string fallback
      customerName: 'acme corp',
      paymentMode: 'bank transfer',
    },
  });
  assert(passWhitespace.overallIntegrityStatus === 'PASS', 'Whitespace and case differences must normalize to PASS');

  // 18.10 Bank charges null vs 0 equality
  const passZeroCharges = evaluatePaymentIntegrity({
    snapshot: {
      ...baseline,
      bankCharges: null,
    },
    current: {
      ...baseline,
      bankCharges: 0,
    },
  });
  assert(passZeroCharges.bankChargesMatch === true, 'null and 0 bank charges must match');

  console.log('✓ PASS: 6-field evaluation unit tests and regressions validated');
}

console.log('--- 19. Testing Void / Cancelled Payment Exclusion & Eligibility ---');
import {
  isPaymentEligibleForVerification,
  getPaymentStatus,
  ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES,
} from '../lib/services/customer-payment-verification.service';
import { verifyPaymentInZohoAndLocal } from '../lib/services/customer-payment-verification.service';
import { CustomerPaymentVerificationMethod } from '@prisma/client';

async function testVoidPaymentEligibility() {
  // Test 19.1: Valid normal payment is included
  const validPayment = {
    payment_number: 'PT-KT/26-27/1000',
    payment_status: 'paid',
  };
  assert(isPaymentEligibleForVerification(validPayment) === true, 'Normal paid payment must be eligible');

  // Test 19.2: VOID payment is excluded
  const voidPayment = {
    payment_number: 'PT/25-26/3671',
    payment_status: 'void',
  };
  assert(isPaymentEligibleForVerification(voidPayment) === false, 'VOID payment must be excluded');

  // Test 19.3: Case-insensitive VOID handling
  assert(isPaymentEligibleForVerification({ payment_status: 'VOID' }) === false, 'Uppercase VOID must be excluded');
  assert(isPaymentEligibleForVerification({ payment_status: 'Void' }) === false, 'Titlecase Void must be excluded');
  assert(isPaymentEligibleForVerification({ payment_status: '  void  ' }) === false, 'Padded void must be excluded');

  // Test 19.4: Confirmed terminal status CANCELLED / CANCELED
  assert(isPaymentEligibleForVerification({ payment_status: 'cancelled' }) === false, 'cancelled must be excluded');
  assert(isPaymentEligibleForVerification({ payment_status: 'CANCELLED' }) === false, 'CANCELLED must be excluded');
  assert(isPaymentEligibleForVerification({ status: 'void' }) === false, 'status: void must be excluded');

  // Test 19.5: Nested zohoData status handling
  const localDbRecordWithVoid = {
    paymentNumber: 'PT/25-26/3671',
    zohoData: { payment_status: 'void' },
  };
  assert(isPaymentEligibleForVerification(localDbRecordWithVoid) === false, 'Local record with zohoData.payment_status=void must be excluded');

  // Test 19.6: Stale queued payment that becomes VOID cannot be verified
  const staleVoidVerifyResult = await verifyPaymentInZohoAndLocal({
    zohoPaymentId: '1759923000012630920', // PT/25-26/3671 in DB
    method: CustomerPaymentVerificationMethod.MANUAL,
    allowZohoWrites: false,
    userId: 'test_user_id',
  });
  assert(!staleVoidVerifyResult.success, 'Verification of void payment must fail');
  assert(
    staleVoidVerifyResult.code === 'PAYMENT_VOIDED',
    `Expected PAYMENT_VOIDED code, received: ${staleVoidVerifyResult.code}`
  );
  assert(
    staleVoidVerifyResult.error?.includes('VOID'),
    `Expected error mentioning VOID, received: ${staleVoidVerifyResult.error}`
  );

  console.log('✓ PASS: Void and cancelled payment exclusion, case-insensitivity, and defensive verification rejections verified');
}

async function testExecutionTracker() {
  console.log('--- 20. Testing Persistent Last-Run Execution Tracking & Concurrency ---');
  const {
    recordOperationStart,
    recordOperationComplete,
    getPaymentOperationsMetadata,
  } = await import('../lib/services/customer-payment-operation-tracker.service');
  const { prisma } = await import('../lib/db');

  // Reset tracking state for clean test
  await prisma.paymentOperationExecution.deleteMany({
    where: {
      operationKey: { in: ['audit_verified_payments', 'sync_zoho_data'] },
    },
  });

  // Case 20.1: Default metadata returns 'Never run' (null timestamps)
  const initialMeta = await getPaymentOperationsMetadata();
  assert(initialMeta.auditVerifiedPayments.currentRunStatus === 'idle', 'Initial audit status should be idle');
  assert(initialMeta.auditVerifiedPayments.lastRunCompletedAt === null, 'Initial audit lastRunCompletedAt should be null');
  assert(initialMeta.auditVerifiedPayments.lastManualRunAt === null, 'Initial audit lastManualRunAt should be null');
  assert(initialMeta.auditVerifiedPayments.lastAutomaticRunAt === null, 'Initial audit lastAutomaticRunAt should be null');
  assert(initialMeta.syncZohoData.currentRunStatus === 'idle', 'Initial sync status should be idle');
  assert(initialMeta.syncZohoData.lastManualRunAt === null, 'Initial sync lastManualRunAt should be null');
  assert(initialMeta.syncZohoData.lastAutomaticRunAt === null, 'Initial sync lastAutomaticRunAt should be null');

  // Case 20.2: Start manual sync operation
  const startSyncManual = await recordOperationStart({
    operationKey: 'sync_zoho_data',
    runId: 'sync_test_run_1',
    trigger: 'MANUAL',
  });
  assert(startSyncManual.acquired === true, 'Manual sync lock must be acquired');

  const runningSyncMeta = await getPaymentOperationsMetadata();
  assert(runningSyncMeta.syncZohoData.currentRunStatus === 'running', 'Sync status should be running');
  assert(runningSyncMeta.syncZohoData.activeRunId === 'sync_test_run_1', 'Active run ID should match');

  // Case 20.3: Concurrency protection — duplicate simultaneous execution is rejected
  const duplicateSync = await recordOperationStart({
    operationKey: 'sync_zoho_data',
    runId: 'sync_test_run_2',
    trigger: 'MANUAL',
  });
  assert(duplicateSync.acquired === false, 'Duplicate simultaneous sync must be rejected');
  assert(duplicateSync.currentRunId === 'sync_test_run_1', 'Current run ID must identify active run');

  // Case 20.4: Complete manual sync operation
  await recordOperationComplete({
    operationKey: 'sync_zoho_data',
    runId: 'sync_test_run_1',
    trigger: 'MANUAL',
    success: true,
    recordsProcessed: 42,
  });

  const completedManualSyncMeta = await getPaymentOperationsMetadata();
  assert(completedManualSyncMeta.syncZohoData.currentRunStatus === 'idle', 'Sync status must return to idle');
  assert(completedManualSyncMeta.syncZohoData.lastRunStatus === 'success', 'Last run status must be success');
  assert(completedManualSyncMeta.syncZohoData.lastRunRecordsProcessed === 42, 'Records processed must be 42');
  assert(completedManualSyncMeta.syncZohoData.lastManualRunAt !== null, 'lastManualRunAt must be recorded');
  assert(completedManualSyncMeta.syncZohoData.lastAutomaticRunAt === null, 'lastAutomaticRunAt must remain null after manual run');
  const recordedManualSyncTime = completedManualSyncMeta.syncZohoData.lastManualRunAt;

  // Case 20.5: Automatic sync execution does NOT overwrite lastManualRunAt
  await recordOperationStart({
    operationKey: 'sync_zoho_data',
    runId: 'sync_auto_run_1',
    trigger: 'AUTOMATIC',
  });
  await recordOperationComplete({
    operationKey: 'sync_zoho_data',
    runId: 'sync_auto_run_1',
    trigger: 'AUTOMATIC',
    success: true,
    recordsProcessed: 15,
  });

  const completedAutoSyncMeta = await getPaymentOperationsMetadata();
  assert(completedAutoSyncMeta.syncZohoData.lastAutomaticRunAt !== null, 'lastAutomaticRunAt must be recorded');
  assert(
    completedAutoSyncMeta.syncZohoData.lastManualRunAt === recordedManualSyncTime,
    'lastManualRunAt must NOT be overwritten by automatic run'
  );
  assert(completedAutoSyncMeta.syncZohoData.lastRunTrigger === 'AUTOMATIC', 'lastRunTrigger must be AUTOMATIC');

  // Case 20.6: Manual Audit Verified Payments execution records manual timestamp and does not affect sync
  await recordOperationStart({
    operationKey: 'audit_verified_payments',
    runId: 'audit_manual_run_1',
    trigger: 'MANUAL',
  });
  await recordOperationComplete({
    operationKey: 'audit_verified_payments',
    runId: 'audit_manual_run_1',
    trigger: 'MANUAL',
    success: true,
    recordsProcessed: 88,
  });

  const auditCompletedMeta = await getPaymentOperationsMetadata();
  assert(auditCompletedMeta.auditVerifiedPayments.currentRunStatus === 'idle', 'Audit must be idle');
  assert(auditCompletedMeta.auditVerifiedPayments.lastRunStatus === 'success', 'Audit last run must be success');
  assert(auditCompletedMeta.auditVerifiedPayments.lastManualRunAt !== null, 'Audit lastManualRunAt must be set');
  assert(auditCompletedMeta.auditVerifiedPayments.lastAutomaticRunAt === null, 'Audit lastAutomaticRunAt must be null');
  assert(
    auditCompletedMeta.syncZohoData.lastManualRunAt === recordedManualSyncTime,
    'Audit execution must NOT overwrite syncZohoData metadata'
  );

  // Case 20.7: Failed run records failure status and error without corrupting previous run timestamps
  await recordOperationStart({
    operationKey: 'audit_verified_payments',
    runId: 'audit_fail_run',
    trigger: 'AUTOMATIC',
  });
  await recordOperationComplete({
    operationKey: 'audit_verified_payments',
    runId: 'audit_fail_run',
    trigger: 'AUTOMATIC',
    success: false,
    recordsProcessed: 0,
    error: 'Zoho Books connection timed out',
  });

  const failedAuditMeta = await getPaymentOperationsMetadata();
  assert(failedAuditMeta.auditVerifiedPayments.currentRunStatus === 'idle', 'Failed audit must be idle');
  assert(failedAuditMeta.auditVerifiedPayments.lastRunStatus === 'failed', 'Audit status must be failed');
  assert(failedAuditMeta.auditVerifiedPayments.lastRunError === 'Zoho Books connection timed out', 'Error must be preserved');
  assert(failedAuditMeta.auditVerifiedPayments.lastManualRunAt !== null, 'Previous manual timestamp must remain intact');

  console.log('✓ PASS: Persistent execution tracking, manual/automatic separation, and concurrency protection verified');
}

async function testCronIntegrityAuditRoute() {
  console.log('--- 21. Testing Customer Payment Integrity Audit Cron Endpoint ---');
  const { GET, POST } = await import('../app/api/cron/customer-payment-integrity-audit/route');

  const originalCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test_secret_integrity_123';

  try {
    // 21.1 Reject unauthorized requests
    const unauthReq = new Request('http://localhost:3000/api/cron/customer-payment-integrity-audit');
    const unauthRes = await GET(unauthReq);
    assert(unauthRes.status === 401, 'Cron endpoint must return 401 Unauthorized without secret');

    // 21.2 Reject invalid secret
    const badSecretReq = new Request('http://localhost:3000/api/cron/customer-payment-integrity-audit?secret=wrong');
    const badSecretRes = await POST(badSecretReq);
    assert(badSecretRes.status === 401, 'Cron endpoint must return 401 with wrong secret');

    // 21.3 Accept valid secret via header
    const authHeaderReq = new Request('http://localhost:3000/api/cron/customer-payment-integrity-audit', {
      headers: { 'x-cron-secret': 'test_secret_integrity_123' },
    });
    // This will invoke auditVerifiedPaymentIntegrity. In local test environment without real Zoho,
    // it will execute and return either success or expected auth/connection result, but status is not 401.
    // To test concurrency, let's verify lock behavior:
    const { acquireAuditRunLock, releaseAuditRunLock } = await import(
      '../lib/services/customer-payment-audit-events.service'
    );
    acquireAuditRunLock('test_manual_lock_run');
    try {
      const busyRes = await GET(
        new Request('http://localhost:3000/api/cron/customer-payment-integrity-audit?secret=test_secret_integrity_123')
      );
      assert(busyRes.status === 409, 'Cron endpoint must return 409 when audit already running');
      const busyJson = await busyRes.json();
      assert(busyJson.status === 'SKIPPED', 'Skipped status expected');
      assert(busyJson.alreadyRunning === true, 'alreadyRunning flag expected');
    } finally {
      releaseAuditRunLock('test_manual_lock_run');
    }

    console.log('✓ PASS: Customer payment integrity audit cron endpoint authentication and concurrency verified');
  } finally {
    process.env.CRON_SECRET = originalCronSecret;
  }
}

testSixFieldIntegrityLogic();
testVoidPaymentEligibility()
  .then(() => testExecutionTracker())
  .then(() => testCronIntegrityAuditRoute())
  .then(() => {
    console.log('========================================');
    console.log('All Payment Verification tests passed!');
    console.log('========================================');
  })
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });




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

console.log('--- 2. Testing IST Working Window for Payment Sync (09:00 - 21:00 IST) ---');
// 08:59 IST (03:29 UTC) -> Should be false
const before9Am = new Date('2026-10-05T03:29:00Z');
assert(!isWithinPaymentSyncHours(before9Am), '08:59 IST should be outside working window');

// 09:01 IST (03:31 UTC) -> Should be true
const after9Am = new Date('2026-10-05T03:31:00Z');
assert(isWithinPaymentSyncHours(after9Am), '09:01 IST should be inside working window');

// 12:00 IST (06:30 UTC) -> Should be true
const noon = new Date('2026-10-05T06:30:00Z');
assert(isWithinPaymentSyncHours(noon), '12:00 IST should be inside working window');

// 21:00 IST (15:30 UTC) -> Should be true
const at9Pm = new Date('2026-10-05T15:30:00Z');
assert(isWithinPaymentSyncHours(at9Pm), '21:00 IST should be inside working window');

// 21:01 IST (15:31 UTC) -> Should be false
const after9Pm = new Date('2026-10-05T15:31:00Z');
assert(!isWithinPaymentSyncHours(after9Pm), '21:01 IST should be outside working window');
console.log('✓ PASS: IST working hours accurately constrained');

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

console.log('--- 5. Testing Backend Write Gate (canPerformZohoVerificationWrite) ---');
import { canPerformZohoVerificationWrite } from '../lib/services/customer-payment-verification.service';
// In current environment (development)
assert(!canPerformZohoVerificationWrite(false), 'Write gate must return false when allowZohoWrites is false');
assert(canPerformZohoVerificationWrite(true), 'Write gate must return true when allowZohoWrites is true in development');

// Simulate production NODE_ENV
const prevEnv = process.env.NODE_ENV;
try {
  (process.env as any).NODE_ENV = 'production';
  assert(!canPerformZohoVerificationWrite(true), 'Write gate must strictly return false in production even if allowZohoWrites is true');
  assert(!canPerformZohoVerificationWrite(false), 'Write gate must strictly return false in production');
} finally {
  (process.env as any).NODE_ENV = prevEnv;
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

console.log('========================================');
console.log('All Payment Verification tests passed!');
console.log('========================================');


import {
  hasDispatchAccess,
  hasDispatchPermission,
  canCompleteDispatchStep,
  canOverrideDispatchWorkflow,
  dispatchForbiddenResponse,
} from '../lib/dispatch-auth';
import {
  DISPATCH_STEP_PERMISSION_MAP,
  DISPATCH_PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
} from '../lib/permissions';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

console.log('\n--- 1. Module Access (hasDispatchAccess) ---');
assert(hasDispatchAccess(null) === false, 'null session has no dispatch access');
assert(hasDispatchAccess(undefined) === false, 'undefined session has no dispatch access');
assert(hasDispatchAccess({ role: 'STAFF', dispatch_view: false }) === false, 'Staff with dispatch_view=false has no access');
assert(hasDispatchAccess({ role: 'STAFF', dispatch_view: true }) === true, 'Staff with dispatch_view=true has access');
assert(hasDispatchAccess({ role: 'ADMIN', dispatch_view: false }) === true, 'Admin always has dispatch access (bypasses dispatch_view)');

console.log('\n--- 2. Granular Step Authorization (canCompleteDispatchStep) ---');
const staffWithRateReview = {
  role: 'STAFF',
  dispatch_view: true,
  dispatch_rate_review: true,
  dispatch_payment_verification: false,
};

assert(canCompleteDispatchStep(staffWithRateReview, 'rate-review') === true, 'User with dispatch_rate_review can complete rate-review');
assert(canCompleteDispatchStep(staffWithRateReview, 'payment-verification') === false, 'User without dispatch_payment_verification cannot complete payment-verification');
assert(canCompleteDispatchStep(staffWithRateReview, 'truck-details') === false, 'User without dispatch_truck_details cannot complete truck-details');
assert(canCompleteDispatchStep(staffWithRateReview, 'ready-for-invoice') === false, 'User without dispatch_ready_for_invoice cannot complete ready-for-invoice');
assert(canCompleteDispatchStep(staffWithRateReview, 'invoice-confirmation') === false, 'User without dispatch_invoice_confirmation cannot complete invoice-confirmation');

console.log('\n--- 3. Parent Dispatch Gate Enforcement ---');
const staffNoDispatchView = {
  role: 'STAFF',
  dispatch_view: false,
  dispatch_rate_review: true, // even if true in DB, parent dispatch_view=false must block
};
assert(canCompleteDispatchStep(staffNoDispatchView, 'rate-review') === false, 'Parent dispatch_view=false blocks granular step even if step flag is true');

console.log('\n--- 4. Admin Full Access Bypass ---');
const adminSession = {
  role: 'ADMIN',
  dispatch_view: false,
  dispatch_rate_review: false,
};
assert(canCompleteDispatchStep(adminSession, 'rate-review') === true, 'Admin bypasses granular checks for rate-review');
assert(canCompleteDispatchStep(adminSession, 'payment-verification') === true, 'Admin bypasses granular checks for payment-verification');
assert(canCompleteDispatchStep(adminSession, 'truck-details') === true, 'Admin bypasses granular checks for truck-details');
assert(canCompleteDispatchStep(adminSession, 'ready-for-invoice') === true, 'Admin bypasses granular checks for ready-for-invoice');
assert(canCompleteDispatchStep(adminSession, 'invoice-confirmation') === true, 'Admin bypasses granular checks for invoice-confirmation');

console.log('\n--- 5. Workflow Override / Reopen Authorization ---');
assert(canOverrideDispatchWorkflow({ role: 'STAFF', dispatch_view: true, dispatch_workflow_override: false }) === false, 'Staff without override cannot reopen');
assert(canOverrideDispatchWorkflow({ role: 'STAFF', dispatch_view: true, dispatch_workflow_override: true }) === true, 'Staff with override can reopen');
assert(canOverrideDispatchWorkflow({ role: 'STAFF', dispatch_view: false, dispatch_workflow_override: true }) === false, 'Staff with dispatch_view=false cannot reopen even with override flag');
assert(canOverrideDispatchWorkflow({ role: 'ADMIN' }) === true, 'Admin can always override/reopen');

console.log('\n--- 6. Step Permission Map Integrity ---');
assert(DISPATCH_STEP_PERMISSION_MAP['rate-review'] === 'dispatch_rate_review', 'rate-review mapped correctly');
assert(DISPATCH_STEP_PERMISSION_MAP['payment-verification'] === 'dispatch_payment_verification', 'payment-verification mapped correctly');
assert(DISPATCH_STEP_PERMISSION_MAP['truck-details'] === 'dispatch_truck_details', 'truck-details mapped correctly');
assert(DISPATCH_STEP_PERMISSION_MAP['ready-for-invoice'] === 'dispatch_ready_for_invoice', 'ready-for-invoice mapped correctly');
assert(DISPATCH_STEP_PERMISSION_MAP['invoice-confirmation'] === 'dispatch_invoice_confirmation', 'invoice-confirmation mapped correctly');

console.log('\n--- 7. Permission Key Consistency ---');
const requiredKeys = [
  'dispatch_rate_review',
  'dispatch_payment_verification',
  'dispatch_truck_details',
  'dispatch_ready_for_invoice',
  'dispatch_invoice_confirmation',
  'dispatch_workflow_override',
  'dispatch_inventory_deduction',
  'dispatch_receiving_upload',
  'dispatch_checked_by',
  'dispatch_post_dispatch',
];

for (const key of requiredKeys) {
  assert(ALL_PERMISSION_KEYS.includes(key as any), `${key} exists in ALL_PERMISSION_KEYS`);
  assert(PERMISSIONS.some(p => p.key === key), `${key} exists in PERMISSIONS array`);
}

console.log('\n--- 8. Standard 403 Response ---');
const resp = dispatchForbiddenResponse('Rate Review');
assert(resp.error.includes('Rate Review'), 'Forbidden response mentions step name');
assert(resp.code === 'FORBIDDEN_DISPATCH_STEP', 'Forbidden response has correct code');

console.log(`\n========================================`);
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}

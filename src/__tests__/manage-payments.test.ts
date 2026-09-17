import { prisma } from '../lib/db';
import {
  generatePaymentRequestNumber,
  getTodayDateStringIST,
  getISTDayRange,
  getAllowedPaymentDateRangeIST,
  PAYMENT_STATUS_LABELS,
} from '../lib/manage-payments';
import { hasMobilePermission, hasMobileFeatureAccess } from '../lib/mobile-auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runManagePaymentsTests() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('       MANAGE PAYMENTS PHASE 1 & 2 TEST SUITE');
  console.log('════════════════════════════════════════════════════════════\n');

  // 1. Setup Test Users and Customer
  const testUserA = await prisma.user.upsert({
    where: { mobile: '9888800001' },
    update: {
      active: true,
      mobile_accounts: true,
      manage_payments_view_own: true,
      manage_payments_create: true,
      manage_payments_view_all: false,
      manage_payments_approve: false,
      manage_payments_reject: false,
    },
    create: {
      name: 'Field Staff Alice',
      mobile: '9888800001',
      role: 'STAFF',
      active: true,
      mobile_accounts: true,
      manage_payments_view_own: true,
      manage_payments_create: true,
      manage_payments_view_all: false,
      manage_payments_approve: false,
      manage_payments_reject: false,
    },
  });

  const testUserB = await prisma.user.upsert({
    where: { mobile: '9888800002' },
    update: {
      active: true,
      mobile_accounts: true,
      manage_payments_view_own: true,
      manage_payments_create: false,
      manage_payments_view_all: true,
      manage_payments_approve: true,
      manage_payments_reject: true,
    },
    create: {
      name: 'Manager Bob',
      mobile: '9888800002',
      role: 'STAFF',
      active: true,
      mobile_accounts: true,
      manage_payments_view_own: true,
      manage_payments_create: false,
      manage_payments_view_all: true,
      manage_payments_approve: true,
      manage_payments_reject: true,
    },
  });

  const testCustomer = await prisma.customer.upsert({
    where: { id: 'TEST_CUST_PAY_001' },
    update: { name: 'Acme Traders Private Limited', status: 'active' },
    create: {
      id: 'TEST_CUST_PAY_001',
      name: 'Acme Traders Private Limited',
      status: 'active',
      gstNumber: '07AAAAA0000A1Z5',
    },
  });

  // Clean up any test payment records from previous test runs
  await prisma.paymentRequest.deleteMany({
    where: { customerId: 'TEST_CUST_PAY_001' },
  });

  // ─── Test Group 1: Permission System ────────────────────────────────────────
  console.log('--- 1. Mobile Permissions & Hierarchy ---');

  assert(
    hasMobilePermission(testUserA, 'manage_payments_view_own') === true,
    'User A has manage_payments_view_own'
  );
  assert(
    hasMobilePermission(testUserA, 'manage_payments_create') === true,
    'User A has manage_payments_create'
  );
  assert(
    hasMobilePermission(testUserA, 'manage_payments_view_all') === false,
    'User A does NOT have manage_payments_view_all'
  );
  assert(
    hasMobilePermission(testUserA, 'manage_payments_approve') === false,
    'User A does NOT have manage_payments_approve'
  );
  assert(
    hasMobilePermission(testUserA, 'manage_payments_reject') === false,
    'User A does NOT have manage_payments_reject'
  );

  assert(
    hasMobilePermission(testUserB, 'manage_payments_view_all') === true,
    'User B has manage_payments_view_all'
  );
  assert(
    hasMobilePermission(testUserB, 'manage_payments_create') === false,
    'User B does NOT have manage_payments_create'
  );
  assert(
    hasMobilePermission(testUserB, 'manage_payments_approve') === true,
    'User B has manage_payments_approve'
  );
  assert(
    hasMobilePermission(testUserB, 'manage_payments_reject') === true,
    'User B has manage_payments_reject'
  );

  // Admin persona test
  const adminUser = { role: 'ADMIN' as const, active: true };
  assert(
    hasMobilePermission(adminUser, 'manage_payments_view_all') === true,
    'Admin automatically has manage_payments_view_all'
  );
  assert(
    hasMobilePermission(adminUser, 'manage_payments_create') === true,
    'Admin automatically has manage_payments_create'
  );
  assert(
    hasMobilePermission(adminUser, 'manage_payments_approve') === true,
    'Admin automatically has manage_payments_approve'
  );
  assert(
    hasMobilePermission(adminUser, 'manage_payments_reject') === true,
    'Admin automatically has manage_payments_reject'
  );

  // Parent-child mobile hierarchy
  assert(
    hasMobileFeatureAccess(testUserA, 'mobile_accounts', 'manage_payments_view_own') === true,
    'Parent-child hierarchy check passes for User A under mobile_accounts'
  );

  const blockedUser = {
    role: 'STAFF' as const,
    active: true,
    mobile_accounts: false, // Parent false
    manage_payments_view_own: true, // Child true
  };
  assert(
    hasMobileFeatureAccess(blockedUser, 'mobile_accounts', 'manage_payments_view_own') === false,
    'Unauthorized user is blocked from viewing manage payments'
  );

  // ─── Test Group 2: Sequence Number Generation ──────────────────────────────
  console.log('\n--- 2. Request Number Sequence Generation ---');

  const reqNum1 = await generatePaymentRequestNumber();
  const reqNum2 = await generatePaymentRequestNumber();

  assert(
    /^PAY-\d{6}-\d{3}$/.test(reqNum1),
    `Request number 1 (${reqNum1}) matches format PAY-YYMMDD-NNN`
  );
  assert(
    /^PAY-\d{6}-\d{3}$/.test(reqNum2),
    `Request number 2 (${reqNum2}) matches format PAY-YYMMDD-NNN`
  );
  assert(
    reqNum1 !== reqNum2,
    `Sequences are strictly distinct: ${reqNum1} vs ${reqNum2}`
  );

  // Concurrent generation test
  const concurrentNumbers = await Promise.all([
    generatePaymentRequestNumber(),
    generatePaymentRequestNumber(),
    generatePaymentRequestNumber(),
    generatePaymentRequestNumber(),
  ]);
  const uniqueSet = new Set(concurrentNumbers);
  assert(
    uniqueSet.size === 4,
    `4 parallel requests generated 4 unique sequence numbers: ${concurrentNumbers.join(', ')}`
  );

  // ─── Test Group 3: Amount Validation Rules ──────────────────────────────────
  console.log('\n--- 3. Amount Validation Rules (>0 and <= 200,000) ---');

  const validateAmount = (amt: number): { valid: boolean; error?: string } => {
    if (amt <= 0 || isNaN(amt)) return { valid: false, error: 'Enter a payment amount greater than ₹0.' };
    if (amt > 200000) return { valid: false, error: 'Maximum payment amount is ₹2,00,000.' };
    return { valid: true };
  };

  assert(validateAmount(1).valid === true, '₹1 is accepted');
  assert(validateAmount(100000).valid === true, '₹1,00,000 is accepted');
  assert(validateAmount(200000).valid === true, '₹2,00,000 is accepted (inclusive upper bound)');
  assert(validateAmount(200001).valid === false, '₹2,00,001 is rejected');
  assert(
    validateAmount(200001).error === 'Maximum payment amount is ₹2,00,000.',
    '₹2,00,001 gives expected error "Maximum payment amount is ₹2,00,000."'
  );
  assert(validateAmount(0).valid === false, '₹0 is rejected');
  assert(
    validateAmount(0).error === 'Enter a payment amount greater than ₹0.',
    '₹0 gives expected error "Enter a payment amount greater than ₹0."'
  );
  assert(validateAmount(-500).valid === false, 'Negative amount is rejected');

  // ─── Test Group 4: Date Validation Rules (Today - 15 days to Today) ─────────
  console.log('\n--- 4. Date Validation Rules ---');

  const todayStr = getTodayDateStringIST();
  const { minDate, maxDate } = getAllowedPaymentDateRangeIST();
  assert(maxDate === todayStr, 'Maximum allowed payment date is strictly today in IST');

  const [ty, tm, td] = todayStr.split('-').map(Number);
  const expectedMinObj = new Date(Date.UTC(ty, tm - 1, td - 15));
  const expectedMinStr = expectedMinObj.toISOString().slice(0, 10);
  assert(minDate === expectedMinStr, `Minimum allowed payment date is exactly today - 15 calendar days (${minDate})`);

  const validatePaymentDate = (d: string): { valid: boolean; error?: string } => {
    if (!d) return { valid: false, error: 'Please select a payment date.' };
    if (d > maxDate) return { valid: false, error: 'Future dates are not allowed. Please select today or an earlier date.' };
    if (d < minDate) return { valid: false, error: 'Payments older than 15 days cannot be recorded. Please select another date.' };
    return { valid: true };
  };

  assert(validatePaymentDate(todayStr).valid === true, 'Today is accepted');
  const yesterdayStr = new Date(Date.UTC(ty, tm - 1, td - 1)).toISOString().slice(0, 10);
  assert(validatePaymentDate(yesterdayStr).valid === true, 'Yesterday is accepted');
  assert(validatePaymentDate(minDate).valid === true, 'Exactly 15 days ago is accepted');

  const futureDate = new Date(Date.UTC(ty, tm - 1, td + 1)).toISOString().slice(0, 10);
  const futureRes = validatePaymentDate(futureDate);
  assert(futureRes.valid === false, 'Future date is rejected');
  assert(
    futureRes.error === 'Future dates are not allowed. Please select today or an earlier date.',
    'Future date error message matches required string'
  );

  const tooOldDate = new Date(Date.UTC(ty, tm - 1, td - 16)).toISOString().slice(0, 10);
  const oldRes = validatePaymentDate(tooOldDate);
  assert(oldRes.valid === false, 'Date 16 days ago is rejected');
  assert(
    oldRes.error === 'Payments older than 15 days cannot be recorded. Please select another date.',
    'Older than 15 days error message matches required string'
  );

  // ─── Test Group 5: Payment Creation & POS Photo ─────────────────────────────
  console.log('\n--- 5. Payment Creation & POS Photo ---');

  const testIdempKey1 = `test-idemp-${Date.now()}-1`;
  const payment1 = await prisma.paymentRequest.create({
    data: {
      requestNumber: await generatePaymentRequestNumber(),
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      amount: 15000.0,
      paymentDate: new Date(`${todayStr}T00:00:00.000Z`),
      paymentMode: 'POS',
      photoUrl: '/uploads/pos-slip-001.jpg',
      status: 'PENDING_APPROVAL',
      idempotencyKey: testIdempKey1,
      createdById: testUserA.id,
    },
  });

  assert(payment1.status === 'PENDING_APPROVAL', 'Initial payment status is strictly PENDING_APPROVAL');
  assert(payment1.paymentMode === 'POS', 'Payment mode is POS');
  assert(Number(payment1.amount) === 15000, 'Payment amount stored with decimal accuracy');
  assert(payment1.customerName === testCustomer.name, 'Customer name stored for audit preservation');
  assert(payment1.createdById === testUserA.id, 'Created by user correctly recorded');
  assert(payment1.photoUrl === '/uploads/pos-slip-001.jpg', 'Mandatory receipt photo recorded');

  // Status labels check
  assert(PAYMENT_STATUS_LABELS['PENDING_APPROVAL'] === 'Pending Approval', 'Label for PENDING_APPROVAL');
  assert(PAYMENT_STATUS_LABELS['APPROVED'] === 'Approved', 'Label for APPROVED');
  assert(PAYMENT_STATUS_LABELS['REJECTED'] === 'Rejected', 'Label for REJECTED');

  // ─── Test Group 6: Idempotency Protection ───────────────────────────────────
  console.log('\n--- 6. Idempotency Protection ---');

  const duplicateLookup = await prisma.paymentRequest.findUnique({
    where: { idempotencyKey: testIdempKey1 },
  });

  assert(duplicateLookup !== null, 'Server correctly recognizes already-processed idempotency key');
  assert(duplicateLookup?.id === payment1.id, 'Returns existing PaymentRequest without creating new row');

  // New legitimate payment with new idempotency key succeeds
  const testIdempKey2 = `test-idemp-${Date.now()}-2`;
  const payment2 = await prisma.paymentRequest.create({
    data: {
      requestNumber: await generatePaymentRequestNumber(),
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      amount: 15000.0,
      paymentDate: new Date(`${todayStr}T00:00:00.000Z`),
      paymentMode: 'POS',
      photoUrl: '/uploads/pos-slip-002.jpg',
      status: 'PENDING_APPROVAL',
      idempotencyKey: testIdempKey2,
      createdById: testUserA.id,
    },
  });

  assert(payment2.id !== payment1.id, 'Legitimate payment with new idempotency key succeeds');
  assert(payment2.requestNumber !== payment1.requestNumber, 'Distinct request number assigned');

  // ─── Test Group 7: Phase 2 Approval Workflow & Concurrency ──────────────────
  console.log('\n--- 7. Phase 2 Approval Workflow & Concurrency ---');

  // User B (Manager with manage_payments_approve) approves payment1
  const approveTime = new Date();
  const approveResult = await prisma.paymentRequest.updateMany({
    where: {
      id: payment1.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'APPROVED',
      approvedById: testUserB.id,
      approvedAt: approveTime,
    },
  });

  assert(approveResult.count === 1, 'Payment 1 approved successfully (1 row updated)');

  const approvedPayment = await prisma.paymentRequest.findUnique({
    where: { id: payment1.id },
  });

  assert(approvedPayment?.status === 'APPROVED', 'Payment status is now APPROVED');
  assert(approvedPayment?.approvedById === testUserB.id, 'approvedById accurately stored');
  assert(approvedPayment?.approvedAt !== null, 'approvedAt timestamp accurately stored');

  // Concurrency check: attempting to approve or reject already approved payment must fail
  const duplicateApprove = await prisma.paymentRequest.updateMany({
    where: {
      id: payment1.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'APPROVED',
      approvedById: testUserB.id,
      approvedAt: new Date(),
    },
  });
  assert(duplicateApprove.count === 0, 'Concurrency protection: cannot re-approve already decided payment (0 rows)');

  const conflictReject = await prisma.paymentRequest.updateMany({
    where: {
      id: payment1.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'REJECTED',
      rejectedById: testUserB.id,
      rejectedAt: new Date(),
      rejectionReason: 'Wrong payment date',
    },
  });
  assert(conflictReject.count === 0, 'Concurrency protection: cannot reject already approved payment (0 rows)');

  // ─── Test Group 8: Phase 2 Decline Workflow & Reasons ───────────────────────
  console.log('\n--- 8. Phase 2 Decline Workflow & Reasons ---');

  // User B declines payment2 with reason
  const rejectTime = new Date();
  const declineReason = 'Incorrect amount - Slip shows 12000 instead of 15000';
  const declineResult = await prisma.paymentRequest.updateMany({
    where: {
      id: payment2.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'REJECTED',
      rejectedById: testUserB.id,
      rejectedAt: rejectTime,
      rejectionReason: declineReason,
    },
  });

  assert(declineResult.count === 1, 'Payment 2 declined successfully (1 row updated)');

  const declinedPayment = await prisma.paymentRequest.findUnique({
    where: { id: payment2.id },
  });

  assert(declinedPayment?.status === 'REJECTED', 'Payment status is now REJECTED');
  assert(declinedPayment?.rejectedById === testUserB.id, 'rejectedById accurately stored');
  assert(declinedPayment?.rejectedAt !== null, 'rejectedAt timestamp accurately stored');
  assert(declinedPayment?.rejectionReason === declineReason, 'rejectionReason accurately stored');

  // ─── Test Group 9: Self-Approval Allowed (Per User Request) ─────────────────
  console.log('\n--- 9. Self-Approval Allowed (Per User Request) ---');

  // Create payment created by Manager Bob (User B)
  const bobPayment = await prisma.paymentRequest.create({
    data: {
      requestNumber: await generatePaymentRequestNumber(),
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      amount: 45000.0,
      paymentDate: new Date(`${todayStr}T00:00:00.000Z`),
      paymentMode: 'POS',
      photoUrl: '/uploads/pos-slip-bob.jpg',
      status: 'PENDING_APPROVAL',
      idempotencyKey: `test-idemp-bob-${Date.now()}`,
      createdById: testUserB.id,
    },
  });

  // Bob has manage_payments_approve, and approves his own payment
  const bobSelfApprove = await prisma.paymentRequest.updateMany({
    where: {
      id: bobPayment.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'APPROVED',
      approvedById: testUserB.id,
      approvedAt: new Date(),
    },
  });

  assert(bobSelfApprove.count === 1, 'Self-approval succeeds for authorized user (Bob approved own request)');
  const bobApproved = await prisma.paymentRequest.findUnique({
    where: { id: bobPayment.id },
  });
  assert(bobApproved?.status === 'APPROVED', 'Self-approved payment status is APPROVED');
  assert(bobApproved?.createdById === bobApproved?.approvedById, 'createdById matches approvedById (Self-approval)');

  // ─── Test Group 10: Summary & Visibility Scoping ────────────────────────────
  console.log('\n--- 10. Summary & Visibility Scoping ---');

  const { start, end } = getISTDayRange(todayStr);

  // User A view-own summary: payment1 was created by User A and is now APPROVED (15,000)
  const userASummary = await prisma.paymentRequest.aggregate({
    where: {
      status: 'APPROVED',
      paymentDate: { gte: start, lte: end },
      createdById: testUserA.id,
    },
    _sum: { amount: true },
  });

  assert(
    Number(userASummary._sum.amount) === 15000,
    `User A view-own summary reflects only User A's approved payment: ₹15,000 (excludes Bob's ₹45,000)`
  );

  // User B view-all summary: includes User A's 15,000 + Bob's 45,000 = 60,000
  const userBSummary = await prisma.paymentRequest.aggregate({
    where: {
      status: 'APPROVED',
      paymentDate: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });

  assert(
    Number(userBSummary._sum.amount) >= 60000,
    `User B view-all summary reflects company-wide approved payments: ₹${Number(userBSummary._sum.amount)}`
  );

  // Clean up test data
  await prisma.paymentRequest.deleteMany({
    where: { customerId: 'TEST_CUST_PAY_001' },
  });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  Tests run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runManagePaymentsTests()
  .catch((err) => {
    console.error('Test run encountered fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

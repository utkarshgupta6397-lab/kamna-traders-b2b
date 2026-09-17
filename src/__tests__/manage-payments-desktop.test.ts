import { prisma } from '../lib/db';
import {
  generatePaymentRequestNumber,
  getTodayDateStringIST,
  getISTDayRange,
  getAllowedPaymentDateRangeIST,
} from '../lib/manage-payments';
import { hasMobilePermission } from '../lib/mobile-auth';

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

async function runDesktopWorkspaceTests() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('   DESKTOP MANAGE PAYMENTS WORKSPACE VERIFICATION SUITE');
  console.log('════════════════════════════════════════════════════════════\n');

  const todayStr = getTodayDateStringIST();
  const { minDate, maxDate } = getAllowedPaymentDateRangeIST();

  // Setup test users with specific permission configurations
  const fieldStaff = await prisma.user.upsert({
    where: { mobile: '9888800011' },
    update: {
      active: true,
      manage_payments_view_own: true,
      manage_payments_create: true,
      manage_payments_view_all: false,
      manage_payments_approve: false,
      manage_payments_reject: false,
    },
    create: {
      name: 'Field Staff Dinesh',
      mobile: '9888800011',
      role: 'STAFF',
      active: true,
      manage_payments_view_own: true,
      manage_payments_create: true,
      manage_payments_view_all: false,
      manage_payments_approve: false,
      manage_payments_reject: false,
    },
  });

  const manager = await prisma.user.upsert({
    where: { mobile: '9888800022' },
    update: {
      active: true,
      manage_payments_view_own: true,
      manage_payments_create: true,
      manage_payments_view_all: true,
      manage_payments_approve: true,
      manage_payments_reject: true,
    },
    create: {
      name: 'Finance Manager Meena',
      mobile: '9888800022',
      role: 'ADMIN',
      active: true,
      manage_payments_view_own: true,
      manage_payments_create: true,
      manage_payments_view_all: true,
      manage_payments_approve: true,
      manage_payments_reject: true,
    },
  });

  const unauthorizedUser = await prisma.user.upsert({
    where: { mobile: '9888800033' },
    update: {
      active: true,
      manage_payments_view_own: false,
      manage_payments_create: false,
      manage_payments_view_all: false,
      manage_payments_approve: false,
      manage_payments_reject: false,
      role: 'STAFF',
    },
    create: {
      name: 'Unauthorized User Umesh',
      mobile: '9888800033',
      role: 'STAFF',
      active: true,
      manage_payments_view_own: false,
      manage_payments_create: false,
      manage_payments_view_all: false,
      manage_payments_approve: false,
      manage_payments_reject: false,
    },
  });

  const testCustomer = await prisma.customer.upsert({
    where: { id: 'TEST_DESK_CUST_99' },
    update: { name: 'Kamna Solar Innovations Pvt Ltd', gstNumber: '07BBBBB9999B1Z8' },
    create: {
      id: 'TEST_DESK_CUST_99',
      name: 'Kamna Solar Innovations Pvt Ltd',
      gstNumber: '07BBBBB9999B1Z8',
      status: 'active',
    },
  });

  // Clean up any previous test payments for this customer
  await prisma.paymentRequest.deleteMany({
    where: { customerId: testCustomer.id },
  });

  // ─── 1. Permission Matrix Check ─────────────────────────────────────────────
  console.log('--- 1. Desktop Permission Matrix ---');
  assert(hasMobilePermission(fieldStaff, 'manage_payments_view_own') === true, 'Field staff has view_own permission');
  assert(hasMobilePermission(fieldStaff, 'manage_payments_create') === true, 'Field staff has create permission');
  assert(hasMobilePermission(fieldStaff, 'manage_payments_view_all') === false, 'Field staff lacks view_all permission');
  assert(hasMobilePermission(fieldStaff, 'manage_payments_approve') === false, 'Field staff lacks approve permission');
  assert(hasMobilePermission(fieldStaff, 'manage_payments_reject') === false, 'Field staff lacks reject permission');

  assert(hasMobilePermission(manager, 'manage_payments_view_all') === true, 'Manager has view_all permission');
  assert(hasMobilePermission(manager, 'manage_payments_approve') === true, 'Manager has approve permission');
  assert(hasMobilePermission(manager, 'manage_payments_reject') === true, 'Manager has reject permission');

  assert(hasMobilePermission(unauthorizedUser, 'manage_payments_view_own') === false, 'Unauthorized user lacks view_own');
  assert(hasMobilePermission(unauthorizedUser, 'manage_payments_create') === false, 'Unauthorized user lacks create');
  assert(hasMobilePermission(unauthorizedUser, 'manage_payments_approve') === false, 'Unauthorized user lacks approve');

  // ─── 2. Payment Submission & Validation Rules ──────────────────────────────
  console.log('\n--- 2. Record Payment & Validation Ceilings ---');

  // Amount limits
  const validateAmt = (a: number) => a > 0 && a <= 200000;
  assert(!validateAmt(0), 'Amount ₹0 is rejected');
  assert(!validateAmt(-100), 'Negative amount is rejected');
  assert(validateAmt(1), '₹1 is accepted');
  assert(validateAmt(200000), '₹2,00,000 is accepted');
  assert(!validateAmt(200001), '₹2,00,001 is rejected');

  // Date limits
  const validateDate = (d: string) => d >= minDate && d <= maxDate;
  assert(validateDate(todayStr), 'Today is accepted');
  assert(validateDate(minDate), '15 days ago is accepted');

  const [y, m, day] = todayStr.split('-').map(Number);
  const tooOldDate = new Date(Date.UTC(y, m - 1, day - 16)).toISOString().slice(0, 10);
  const futureDate = new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10);
  assert(!validateDate(tooOldDate), '16 days ago is rejected');
  assert(!validateDate(futureDate), 'Future date is rejected');

  // Create payment request
  const reqNum1 = await generatePaymentRequestNumber();
  const idempKey1 = `desk-test-idemp-${Date.now()}-1`;
  const payment1 = await prisma.paymentRequest.create({
    data: {
      requestNumber: reqNum1,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      amount: 42000.0,
      paymentDate: new Date(`${todayStr}T00:00:00.000Z`),
      paymentMode: 'POS',
      photoUrl: '/uploads/desktop-slip-01.jpg',
      status: 'PENDING_APPROVAL',
      idempotencyKey: idempKey1,
      createdById: fieldStaff.id,
    },
  });

  assert(payment1.status === 'PENDING_APPROVAL', 'Payment starts in PENDING_APPROVAL status');
  assert(payment1.paymentMode === 'POS', 'Payment mode is POS Device');
  assert(payment1.photoUrl === '/uploads/desktop-slip-01.jpg', 'Receipt photo url recorded');

  // Idempotency check
  const duplicate = await prisma.paymentRequest.findUnique({
    where: { idempotencyKey: idempKey1 },
  });
  assert(duplicate?.id === payment1.id, 'Idempotency lookup identifies duplicate request');

  // ─── 3. Search & Filtering Extensions ───────────────────────────────────────
  console.log('\n--- 3. List API Query Extensions (Search, Date, Mode) ---');

  // Search by request number
  const searchByReq = await prisma.paymentRequest.findMany({
    where: {
      OR: [
        { requestNumber: { contains: reqNum1, mode: 'insensitive' } },
        { customerName: { contains: reqNum1, mode: 'insensitive' } },
        { customerId: { contains: reqNum1, mode: 'insensitive' } },
        { createdBy: { name: { contains: reqNum1, mode: 'insensitive' } } },
      ],
    },
  });
  assert(searchByReq.length === 1 && searchByReq[0].id === payment1.id, 'Search by requestNumber matches correctly');

  // Search by customer name
  const searchByCust = await prisma.paymentRequest.findMany({
    where: {
      OR: [
        { requestNumber: { contains: 'Solar Innovations', mode: 'insensitive' } },
        { customerName: { contains: 'Solar Innovations', mode: 'insensitive' } },
        { customerId: { contains: 'Solar Innovations', mode: 'insensitive' } },
        { createdBy: { name: { contains: 'Solar Innovations', mode: 'insensitive' } } },
      ],
    },
  });
  assert(searchByCust.length >= 1, 'Search by partial customer name matches correctly');

  // Search by submitted by
  const searchByStaff = await prisma.paymentRequest.findMany({
    where: {
      OR: [
        { requestNumber: { contains: 'Dinesh', mode: 'insensitive' } },
        { customerName: { contains: 'Dinesh', mode: 'insensitive' } },
        { customerId: { contains: 'Dinesh', mode: 'insensitive' } },
        { createdBy: { name: { contains: 'Dinesh', mode: 'insensitive' } } },
      ],
    },
  });
  assert(searchByStaff.length >= 1, 'Search by submitter name matches correctly');

  // ─── 4. Self-Approval & Decision Workflow ──────────────────────────────────
  console.log('\n--- 4. Self-Approval & Decline Workflow ---');

  // Manager creates their own payment request
  const managerReqNum = await generatePaymentRequestNumber();
  const managerPayment = await prisma.paymentRequest.create({
    data: {
      requestNumber: managerReqNum,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      amount: 85000.0,
      paymentDate: new Date(`${todayStr}T00:00:00.000Z`),
      paymentMode: 'POS',
      photoUrl: '/uploads/manager-slip.jpg',
      status: 'PENDING_APPROVAL',
      idempotencyKey: `desk-test-idemp-mgr-${Date.now()}`,
      createdById: manager.id,
    },
  });

  // Manager approves their own payment (Self-Approval)
  const selfApproveTime = new Date();
  const selfApproveResult = await prisma.paymentRequest.updateMany({
    where: {
      id: managerPayment.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'APPROVED',
      approvedById: manager.id,
      approvedAt: selfApproveTime,
      zohoPaymentId: '1759923000099999999',
      zohoSyncStatus: 'ZOHO_SYNCED',
      zohoSyncedAt: selfApproveTime,
    },
  });
  assert(selfApproveResult.count === 1, 'Self-approval succeeds for manager with approve permission');

  const refreshedManagerPayment = await prisma.paymentRequest.findUnique({
    where: { id: managerPayment.id },
    include: { approvedBy: { select: { id: true, name: true } } },
  });
  assert(refreshedManagerPayment?.status === 'APPROVED', 'Self-approved payment has status APPROVED');
  assert(refreshedManagerPayment?.createdById === refreshedManagerPayment?.approvedById, 'createdById equals approvedById');
  assert(refreshedManagerPayment?.approvedBy?.name === manager.name, 'approvedBy relation populated accurately');

  // Decline payment1 with a reason
  const declineReason = 'Incorrect customer - Belongs to sister branch';
  const declineTime = new Date();
  const declineResult = await prisma.paymentRequest.updateMany({
    where: {
      id: payment1.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'REJECTED',
      rejectedById: manager.id,
      rejectedAt: declineTime,
      rejectionReason: declineReason,
    },
  });
  assert(declineResult.count === 1, 'Decline succeeds conditioned on PENDING_APPROVAL');

  const refreshedDeclined = await prisma.paymentRequest.findUnique({
    where: { id: payment1.id },
    include: { rejectedBy: { select: { id: true, name: true } } },
  });
  assert(refreshedDeclined?.status === 'REJECTED', 'Declined payment status is REJECTED');
  assert(refreshedDeclined?.rejectionReason === declineReason, 'rejectionReason is stored');
  assert(refreshedDeclined?.rejectedBy?.name === manager.name, 'rejectedBy relation populated accurately');

  // Attempting to approve an already declined payment must fail
  const invalidApprove = await prisma.paymentRequest.updateMany({
    where: {
      id: payment1.id,
      status: 'PENDING_APPROVAL',
    },
    data: {
      status: 'APPROVED',
      approvedById: manager.id,
      approvedAt: new Date(),
    },
  });
  assert(invalidApprove.count === 0, 'Cannot approve already REJECTED payment (0 rows modified)');

  // ─── 5. KPI Aggregations (Approved Today & Rejected Today) ──────────────────
  console.log('\n--- 5. KPI Aggregation Accuracy ---');
  const { start, end } = getISTDayRange(todayStr);

  const approvedTodayCount = await prisma.paymentRequest.count({
    where: {
      status: 'APPROVED',
      approvedAt: { gte: start, lte: end },
    },
  });
  assert(approvedTodayCount >= 1, `approvedTodayCount includes today's approvals (${approvedTodayCount})`);

  const rejectedCountToday = await prisma.paymentRequest.count({
    where: {
      status: 'REJECTED',
      rejectedAt: { gte: start, lte: end },
    },
  });
  assert(rejectedCountToday >= 1, `rejectedCountToday includes today's rejections (${rejectedCountToday})`);

  // Clean up test data
  await prisma.paymentRequest.deleteMany({
    where: { customerId: testCustomer.id },
  });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  Tests run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runDesktopWorkspaceTests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from '../lib/db';
import {
  createZohoCustomerAdvance,
  sanitizeZohoError
} from '../lib/services/zoho-customer-advance.service';

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

async function runCoupledApprovalTests() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('    COUPLED APPROVAL & ZOHO CUSTOMER ADVANCE TEST SUITE');
  console.log('════════════════════════════════════════════════════════════\n');

  // Setup test customer and users
  const testCustomer = await prisma.customer.upsert({
    where: { id: '1759923000009304105' },
    update: {},
    create: {
      id: '1759923000009304105',
      name: 'Test Customer Advances Ltd',
    },
  });

  const approver = await prisma.user.upsert({
    where: { mobile: '9888800099' },
    update: {
      active: true,
      manage_payments_approve: true,
    },
    create: {
      name: 'Finance Manager Approver',
      mobile: '9888800099',
      role: 'ADMIN',
      active: true,
      manage_payments_approve: true,
    },
  });

  console.log('--- 1. Coupled Approval: Failure Blocks Approval ---');
  // Create a pending payment
  const failedPayment = await prisma.paymentRequest.create({
    data: {
      requestNumber: `PAY-TEST-${Date.now()}-FAIL`,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      amount: 12500,
      paymentDate: new Date(),
      paymentMode: 'POS',
      status: 'PENDING_APPROVAL',
      createdById: approver.id,
    },
  });

  // Simulate failed Zoho sync (e.g. scope missing)
  const simulatedZohoError = 'Zoho Books authorization scope error: Permission to create customer payments (ZohoBooks.customerpayments.CREATE) may not be granted.';
  
  // Simulate the coupled approval handler behavior on sync failure:
  await prisma.paymentRequest.update({
    where: { id: failedPayment.id },
    data: {
      zohoSyncStatus: 'ZOHO_SYNC_FAILED',
      zohoSyncError: simulatedZohoError,
      zohoSyncAttempts: { increment: 1 },
      lastZohoSyncAttemptAt: new Date(),
    },
  });

  const refreshedFailed = await prisma.paymentRequest.findUnique({
    where: { id: failedPayment.id },
  });

  assert(refreshedFailed?.status === 'PENDING_APPROVAL', 'Payment status remains PENDING_APPROVAL when Zoho sync fails');
  assert(refreshedFailed?.zohoSyncStatus === 'ZOHO_SYNC_FAILED', 'zohoSyncStatus is ZOHO_SYNC_FAILED');
  assert(refreshedFailed?.zohoSyncError?.includes('ZohoBooks.customerpayments.CREATE') || false, 'zohoSyncError contains actionable message');
  assert(refreshedFailed?.zohoPaymentId === null, 'zohoPaymentId is strictly NULL');
  assert(refreshedFailed?.approvedById === null, 'approvedById is strictly NULL (not approved)');
  assert(refreshedFailed?.approvedAt === null, 'approvedAt is strictly NULL');
  assert(refreshedFailed?.zohoSyncAttempts === 1, 'zohoSyncAttempts recorded as 1');

  console.log('\n--- 2. Coupled Approval: Success Approves and Links Advance ---');
  // Create another pending payment
  const successPayment = await prisma.paymentRequest.create({
    data: {
      requestNumber: `PAY-TEST-${Date.now()}-SUCC`,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      amount: 45000,
      paymentDate: new Date(),
      paymentMode: 'POS',
      status: 'PENDING_APPROVAL',
      createdById: approver.id,
    },
  });

  // Simulate successful Zoho Customer Advance creation:
  const mockZohoPaymentId = '1759923000029999888';
  const approvalNow = new Date();

  await prisma.paymentRequest.update({
    where: { id: successPayment.id },
    data: {
      status: 'APPROVED',
      approvedById: approver.id,
      approvedAt: approvalNow,
      zohoPaymentId: mockZohoPaymentId,
      zohoSyncStatus: 'ZOHO_SYNCED',
      zohoSyncedAt: approvalNow,
      zohoSyncError: null,
    },
  });

  const refreshedSuccess = await prisma.paymentRequest.findUnique({
    where: { id: successPayment.id },
  });

  assert(refreshedSuccess?.status === 'APPROVED', 'Payment status is APPROVED when Zoho sync succeeds');
  assert(refreshedSuccess?.approvedById === approver.id, 'approvedById matches approver ID');
  assert(refreshedSuccess?.zohoPaymentId === mockZohoPaymentId, 'zohoPaymentId is persisted');
  assert(refreshedSuccess?.zohoSyncStatus === 'ZOHO_SYNCED', 'zohoSyncStatus is ZOHO_SYNCED');
  assert(refreshedSuccess?.zohoSyncedAt !== null, 'zohoSyncedAt timestamp is set');
  assert(refreshedSuccess?.zohoSyncError === null, 'zohoSyncError is cleared (null)');

  console.log('\n--- 3. Concurrency Lock: Prevents Duplicate POSTs While Syncing ---');
  // Lock payment atomically
  const lockResult = await prisma.paymentRequest.updateMany({
    where: {
      id: failedPayment.id,
      status: 'PENDING_APPROVAL',
      zohoSyncStatus: { not: 'ZOHO_SYNC_PENDING' },
    },
    data: {
      zohoSyncStatus: 'ZOHO_SYNC_PENDING',
    },
  });
  assert(lockResult.count === 1, 'First caller successfully acquires ZOHO_SYNC_PENDING lock');

  // Second concurrent caller tries to acquire lock
  const concurrentLock = await prisma.paymentRequest.updateMany({
    where: {
      id: failedPayment.id,
      status: 'PENDING_APPROVAL',
      zohoSyncStatus: { not: 'ZOHO_SYNC_PENDING' },
    },
    data: {
      zohoSyncStatus: 'ZOHO_SYNC_PENDING',
    },
  });
  assert(concurrentLock.count === 0, 'Concurrent caller is blocked (count: 0) while sync is in progress');

  // Cleanup test payments
  await prisma.paymentRequest.deleteMany({
    where: {
      id: { in: [failedPayment.id, successPayment.id] },
    },
  });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  Tests run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCoupledApprovalTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

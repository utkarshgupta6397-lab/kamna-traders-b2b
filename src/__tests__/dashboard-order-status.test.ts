import assert from 'assert';
import { prisma } from '../lib/db';
import {
  getOrderStage,
  getStageBadge,
  getOrderWarehouse,
  formatElapsed,
  getPreDispatchActiveOrders,
} from '../lib/pre-dispatch-status';
import { hasDispatchAccess } from '../lib/dispatch-auth';

async function runTests() {
  console.log('\n================================================================');
  console.log('   HERO DASHBOARD ORDER STATUS (PRE-DISPATCH ACTIVE) TEST SUITE ');
  console.log('================================================================\n');

  // Test 1: Stage Determination Unit Tests
  console.log('--- TEST 1: Workflow Stage Determination Logic ---');
  // Archived conditions
  assert.strictEqual(getOrderStage({ status: 'ARCHIVED' }), 'archived');
  assert.strictEqual(
    getOrderStage({ status: 'NEW', preDispatchWorkflow: { overallStatus: 'PRE_DISPATCH_COMPLETED' } }),
    'archived'
  );
  assert.strictEqual(
    getOrderStage({ status: 'NEW', preDispatchWorkflow: { invoiceConfirmStatus: 'COMPLETED' } }),
    'archived'
  );

  // Sent back
  assert.strictEqual(getOrderStage({ status: 'SENT_BACK_TO_OPS' }), 'sent_back');

  // Active stages
  assert.strictEqual(
    getOrderStage({ status: 'NEW', preDispatchWorkflow: null }),
    'rate_review',
    'No workflow -> rate_review'
  );
  assert.strictEqual(
    getOrderStage({ status: 'NEW', preDispatchWorkflow: { rateReviewStatus: 'NOT_STARTED' } }),
    'rate_review'
  );
  assert.strictEqual(
    getOrderStage({
      status: 'NEW',
      preDispatchWorkflow: { rateReviewStatus: 'COMPLETED', paymentStatus: 'NOT_STARTED' },
    }),
    'payment_verification'
  );
  assert.strictEqual(
    getOrderStage({
      status: 'NEW',
      total: 60000,
      preDispatchWorkflow: {
        rateReviewStatus: 'COMPLETED',
        paymentStatus: 'COMPLETED',
        truckDetailsStatus: 'NOT_STARTED',
      },
    }),
    'truck_details',
    'Total > 50000 requires truck details'
  );
  assert.strictEqual(
    getOrderStage({
      status: 'NEW',
      total: 30000,
      preDispatchWorkflow: {
        rateReviewStatus: 'COMPLETED',
        paymentStatus: 'COMPLETED',
        truckDetailsStatus: 'NOT_STARTED',
        readyForInvoiceStatus: 'NOT_STARTED',
      },
    }),
    'ready_for_invoice',
    'Total <= 50000 skips truck details'
  );
  assert.strictEqual(
    getOrderStage({
      status: 'NEW',
      total: 60000,
      preDispatchWorkflow: {
        rateReviewStatus: 'COMPLETED',
        paymentStatus: 'COMPLETED',
        truckDetailsStatus: 'COMPLETED',
        readyForInvoiceStatus: 'COMPLETED',
        invoiceConfirmStatus: 'NOT_STARTED',
      },
    }),
    'invoice_confirmation'
  );
  console.log('  ✓ PASS: Workflow stages map exactly to Pre-Dispatch logic');

  // Test 2: Stage Badges
  console.log('\n--- TEST 2: Stage Badges & Styles ---');
  assert.strictEqual(getStageBadge({ status: 'NEW', preDispatchWorkflow: null }).label, 'Rate Review');
  assert.strictEqual(
    getStageBadge({
      status: 'NEW',
      total: 60000,
      preDispatchWorkflow: { rateReviewStatus: 'COMPLETED', paymentStatus: 'COMPLETED', truckDetailsStatus: 'NOT_STARTED' },
    }).label,
    'Truck Details'
  );
  console.log('  ✓ PASS: Stage badge labels match Pre-Dispatch tabs');

  // Test 3: Warehouse Resolution
  console.log('\n--- TEST 3: Warehouse Resolution from Zoho Metadata ---');
  assert.strictEqual(
    getOrderWarehouse({ zohoDetailsJson: { location_name: 'Budh Vihar Meerut' } }),
    'Budh Vihar Meerut'
  );
  assert.strictEqual(
    getOrderWarehouse({ zohoDetailsJson: { warehouse_name: 'Warehouse North' } }),
    'Warehouse North'
  );
  assert.strictEqual(
    getOrderWarehouse({ zohoDetailsJson: { branch_name: 'Branch East' } }),
    'Branch East'
  );
  assert.strictEqual(
    getOrderWarehouse({ zohoDetailsJson: { locations: [{ location_name: 'Loc South' }] } }),
    'Loc South'
  );
  assert.strictEqual(
    getOrderWarehouse({ zohoDetailsJson: null }),
    null
  );
  console.log('  ✓ PASS: Warehouse hierarchy resolved correctly');

  // Test 4: Elapsed Waiting Timer Formatter
  console.log('\n--- TEST 4: Elapsed Waiting Timer Formatter ---');
  assert.strictEqual(formatElapsed(45), '45s');
  assert.strictEqual(formatElapsed(150), '2m 30s');
  assert.strictEqual(formatElapsed(3600), '1h');
  assert.strictEqual(formatElapsed(7500), '2h 5m');
  assert.strictEqual(formatElapsed(90000), '1d 1h');
  // 6d 13h = (6 * 24 + 13) * 3600 = 157 * 3600 = 565200 seconds
  assert.strictEqual(formatElapsed(565200), '6d 13h');
  console.log('  ✓ PASS: Elapsed waiting timer matches Pre-Dispatch notation (e.g. 6d 13h)');

  // Test 5: Permission & Access Control
  console.log('\n--- TEST 5: Pre-Dispatch Permission Verification ---');
  assert.strictEqual(hasDispatchAccess({ role: 'ADMIN' }), true, 'Admin has access');
  assert.strictEqual(
    hasDispatchAccess({ role: 'STAFF', dispatch_view: true }),
    true,
    'Staff with dispatch_view has access'
  );
  assert.strictEqual(
    hasDispatchAccess({ role: 'STAFF', dispatch_view: false }),
    false,
    'Staff with dispatch_view=false is denied'
  );
  assert.strictEqual(hasDispatchAccess(null), false, 'Unauthenticated session is denied');
  console.log('  ✓ PASS: Permissions enforce dispatch_view access');

  // Test 6: Live Database Active Orders Extraction
  console.log('\n--- TEST 6: Live Active Pre-Dispatch Orders Extraction ---');
  const activeOrders = await getPreDispatchActiveOrders();

  console.log(`  Live Pre-Dispatch Active Count: ${activeOrders.length}`);
  console.table(
    activeOrders.map((o) => ({
      ID: o.id.slice(0, 10) + '...',
      Customer: o.customerName,
      Warehouse: o.warehouse,
      Stage: o.stageBadge.label,
      'Base Timestamp': o.formattedTimestamp,
    }))
  );

  assert.ok(Array.isArray(activeOrders), 'Active orders must be an array');
  for (const o of activeOrders) {
    assert.ok(o.id, 'Order must have an id');
    assert.ok(o.customerName, 'Order must have a customer name');
    assert.ok(o.warehouse, 'Order must have a warehouse');
    assert.ok(o.stage, 'Order must have a stage');
    assert.notStrictEqual(o.stage, 'archived', 'Active orders must not contain archived orders');
    assert.notStrictEqual(o.stage, 'sent_back', 'Active orders must not contain sent_back orders');
    assert.ok(o.baseTimestamp, 'Order must have a base timestamp');
  }

  console.log('  ✓ PASS: Live database query extracted active orders with complete fields');

  console.log('\n================================================================');
  console.log('   ALL ORDER STATUS TESTS PASSED SUCCESSFULLY! ✅              ');
  console.log('================================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import assert from 'assert';
import { prisma } from '../lib/db';
import {
  getAccessibleDashboardSections,
  getNextRotatingSection,
  canAccessDashboardSection,
} from '../utils/dashboardSectionRotation';
import { DASHBOARD_SECTIONS, DashboardSectionId } from '../components/dashboard/DashboardSectionTabs';
import { getPostDispatchDashboardSummary } from '../lib/post-dispatch-summary';
import {
  getIstOperationsDateBuckets,
  getInvoicePendingState,
  matchDateToBucketKey,
  formatWaitingDuration,
  getOperationsWorkflowSummary,
  getOperationsCellInvoices,
} from '../lib/operations-workflow-summary';

async function runTests() {
  console.log('\n================================================================');
  console.log('   HERO DASHBOARD OPERATIONS TAB & PENDING APPROVAL TEST SUITE   ');
  console.log('================================================================\n');

  // ─── TEST 1: Section Tabs & Sequence Cleanup ─────────────────────────
  console.log('--- TEST 1: Dashboard Section Tabs & Idle Rotation Sequence ---');
  const sectionIds = DASHBOARD_SECTIONS.map((s) => s.id);
  console.log('  Active Sections:', sectionIds);

  assert.deepStrictEqual(
    sectionIds,
    ['overview', 'sales', 'operations', 'accounts'],
    'Section tabs must only contain overview, sales, operations, accounts'
  );
  assert.ok(!sectionIds.includes('inventory' as any), 'Inventory tab must be removed');
  assert.ok(!sectionIds.includes('activity' as any), 'Activity tab must be removed');

  const adminSession = { role: 'ADMIN' };
  const accessible = getAccessibleDashboardSections(adminSession);
  console.log('  Admin Accessible Sections:', accessible);
  assert.deepStrictEqual(
    accessible,
    ['overview', 'sales', 'operations', 'accounts'],
    'Rotation sequence must strictly follow overview -> sales -> operations -> accounts'
  );

  // Verify full rotation cycle
  let current: DashboardSectionId = 'overview';
  current = getNextRotatingSection(current, accessible);
  assert.strictEqual(current, 'sales', 'overview -> sales');
  current = getNextRotatingSection(current, accessible);
  assert.strictEqual(current, 'operations', 'sales -> operations');
  current = getNextRotatingSection(current, accessible);
  assert.strictEqual(current, 'accounts', 'operations -> accounts');
  current = getNextRotatingSection(current, accessible);
  assert.strictEqual(current, 'overview', 'accounts -> wraps around to overview');
  console.log('  ✓ PASS: Tab definitions and rotation sequence strictly verified');

  // ─── TEST 2: Top KPI 3 - Pending Stock Approval Requests ─────────────
  console.log('\n--- TEST 2: Top KPI 3 - Pending Stock Approval Requests ---');
  const directDbCount = await prisma.stockDeductionAllocation.count({
    where: { status: 'SUBMITTED_FOR_APPROVAL' },
  });
  console.log(`  Live DB Pending Stock Approvals: ${directDbCount}`);

  const postDispatchSummary = await getPostDispatchDashboardSummary();
  console.log(`  Summary API pendingStockApprovals: ${postDispatchSummary.pendingStockApprovals}`);

  assert.strictEqual(
    postDispatchSummary.pendingStockApprovals,
    directDbCount,
    'Top KPI pendingStockApprovals must match DB submitted allocations count exactly'
  );
  console.log('  ✓ PASS: Pending stock approvals count reconciles dynamically with DB');

  // ─── TEST 3: Strict Exclusivity Hierarchy Classification ──────────────
  console.log('\n--- TEST 3: Workflow Exclusivity Hierarchy (Strict Rule) ---');
  // State 1: Receiving not completed
  const state1_allPending = getInvoicePendingState([
    { workflowType: 'RECEIVING', status: 'PENDING' },
    { workflowType: 'CHECKED', status: 'PENDING' },
    { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
  ]);
  assert.strictEqual(state1_allPending, 'RECEIVING', 'All pending -> Count ONLY in RECEIVING');

  const state1_awaiting = getInvoicePendingState([
    { workflowType: 'RECEIVING', status: 'AWAITING_VERIFICATION' },
    { workflowType: 'CHECKED', status: 'PENDING' },
    { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
  ]);
  assert.strictEqual(state1_awaiting, 'RECEIVING', 'Receiving awaiting verification -> RECEIVING');

  // State 2: Receiving completed, Checked pending
  const state2_checkPending = getInvoicePendingState([
    { workflowType: 'RECEIVING', status: 'COMPLETED' },
    { workflowType: 'CHECKED', status: 'PENDING' },
    { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
  ]);
  assert.strictEqual(state2_checkPending, 'CHECK', 'Receiving completed, check pending -> Count ONLY in CHECK');

  // State 3: Receiving completed, Checked completed, Inventory pending
  const state3_inventoryPending = getInvoicePendingState([
    { workflowType: 'RECEIVING', status: 'COMPLETED' },
    { workflowType: 'CHECKED', status: 'COMPLETED' },
    { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
  ]);
  assert.strictEqual(state3_inventoryPending, 'INVENTORY', 'Receiving & Check completed, inventory pending -> Count ONLY in INVENTORY');

  // State 4: All completed
  const state4_allCompleted = getInvoicePendingState([
    { workflowType: 'RECEIVING', status: 'COMPLETED' },
    { workflowType: 'CHECKED', status: 'COMPLETED' },
    { workflowType: 'INVENTORY_DEDUCTION', status: 'COMPLETED' },
  ]);
  assert.strictEqual(state4_allCompleted, 'COMPLETED', 'All completed -> COMPLETED (excluded from pending)');
  console.log('  ✓ PASS: Mutually exclusive 4-state hierarchy strictly enforced');

  // ─── TEST 4: Rolling 8 Date Buckets in IST ───────────────────────────
  console.log('\n--- TEST 4: Rolling 8 Date Buckets in IST ---');
  const buckets = getIstOperationsDateBuckets();
  console.log('  Date Buckets:', buckets.map((b) => `${b.label} (${b.key})`));

  assert.strictEqual(buckets.length, 8, 'Must have exactly 8 date buckets');
  assert.strictEqual(buckets[0].key, 'before', 'First bucket must be older than 7 days (key=before)');
  assert.strictEqual(buckets[7].isToday, true, 'Last bucket must be Today (at the bottom)');
  assert.strictEqual(buckets[0].isToday, false, 'Before bucket is not today');

  // Chronological boundary checks
  for (let i = 1; i < buckets.length - 1; i++) {
    assert.ok(
      buckets[i].start < buckets[i + 1].start,
      `Bucket ${i} must start before bucket ${i + 1}`
    );
  }
  console.log('  ✓ PASS: 8 rolling IST date buckets correctly formed');

  // ─── TEST 5: Operations Workflow Summary Live Aggregation ────────────
  console.log('\n--- TEST 5: Operations Workflow Summary Live Reconciliation ---');
  const opSummary = await getOperationsWorkflowSummary();

  console.log(`  Warehouses Count: ${opSummary.warehouses.length}`);
  console.log('  Summary Totals:', opSummary.totals);

  let computedReceivingTotal = 0;
  let computedCheckTotal = 0;
  let computedInventoryTotal = 0;

  for (const wh of opSummary.warehouses) {
    assert.strictEqual(
      wh.rows.length,
      8,
      `Warehouse ${wh.warehouse} must have exactly 8 date rows`
    );

    let rowSumR = 0;
    let rowSumC = 0;
    let rowSumI = 0;

    for (const r of wh.rows) {
      rowSumR += r.receiving;
      rowSumC += r.check;
      rowSumI += r.inventory;
      assert.strictEqual(
        r.total,
        r.receiving + r.check + r.inventory,
        `Row total for ${r.label} in ${wh.warehouse} must equal sum of columns`
      );
    }

    assert.strictEqual(wh.totals.receiving, rowSumR, `WH ${wh.warehouse} receiving total mismatch`);
    assert.strictEqual(wh.totals.check, rowSumC, `WH ${wh.warehouse} check total mismatch`);
    assert.strictEqual(wh.totals.inventory, rowSumI, `WH ${wh.warehouse} inventory total mismatch`);
    assert.strictEqual(
      wh.totals.total,
      rowSumR + rowSumC + rowSumI,
      `WH ${wh.warehouse} grand total mismatch`
    );

    computedReceivingTotal += wh.totals.receiving;
    computedCheckTotal += wh.totals.check;
    computedInventoryTotal += wh.totals.inventory;
  }

  assert.strictEqual(
    opSummary.totals.receivingPending,
    computedReceivingTotal,
    'Grand receiving pending must match sum across warehouses'
  );
  assert.strictEqual(
    opSummary.totals.checkPending,
    computedCheckTotal,
    'Grand check pending must match sum across warehouses'
  );
  assert.strictEqual(
    opSummary.totals.inventoryPending,
    computedInventoryTotal,
    'Grand inventory pending must match sum across warehouses'
  );
  assert.strictEqual(
    opSummary.totals.grandTotal,
    computedReceivingTotal + computedCheckTotal + computedInventoryTotal,
    'Grand total must equal sum of all stages'
  );
  console.log('  ✓ PASS: All warehouse rows, column totals, and grand totals reconcile 100%');

  // ─── TEST 6: Cell Click Drill-down Invoices Verification ──────────────
  console.log('\n--- TEST 6: Cell Click Drill-down Query Verification ---');
  const targetWh = opSummary.warehouses.find((w) => w.totals.receiving > 0);
  if (targetWh) {
    const targetRow = targetWh.rows.find((r) => r.receiving > 0);
    if (targetRow) {
      const cellResult = await getOperationsCellInvoices({
        warehouse: targetWh.warehouse,
        bucketKey: targetRow.bucketKey,
        state: 'RECEIVING',
      });

      console.log(`  Target Cell: ${targetWh.warehouse} • ${targetRow.label} • RECEIVING`);
      console.log(`  Reported Row Count: ${targetRow.receiving}`);
      console.log(`  Fetched Invoices Count: ${cellResult.invoices.length}`);

      assert.strictEqual(
        cellResult.invoices.length,
        targetRow.receiving,
        'Drill-down fetched invoice count must match the exact number in the clicked cell'
      );

      const sample = cellResult.invoices[0];
      assert.ok(sample.invoiceNumber, 'Sample must have invoiceNumber');
      assert.ok(sample.customerName, 'Sample must have customerName');
      assert.ok(sample.formattedAmount, 'Sample must have formattedAmount');
      assert.ok(sample.invoiceDate, 'Sample must have invoiceDate');
      assert.ok(sample.currentStatus, 'Sample must have currentStatus');
      assert.ok(sample.ageFormatted, 'Sample must have ageFormatted');
      console.log('  ✓ PASS: Cell drill-down returns exact matching invoices with required display fields');
    }
  }

  console.log('\n================================================================');
  console.log('   ALL OPERATIONS WORKFLOW & APPROVAL TESTS PASSED! ✅         ');
  console.log('================================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

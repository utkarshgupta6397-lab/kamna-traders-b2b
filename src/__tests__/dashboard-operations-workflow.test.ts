import assert from 'assert';
import { prisma } from '../lib/db';
import {
  getAccessibleDashboardSections,
  getNextRotatingSection,
} from '../utils/dashboardSectionRotation';
import { DASHBOARD_SECTIONS, DashboardSectionId } from '../components/dashboard/DashboardSectionTabs';
import { getPostDispatchDashboardSummary } from '../lib/post-dispatch-summary';
import {
  getIstOperationsDateBuckets,
  isInvoiceReceivingPending,
  isInvoiceCheckPending,
  isInvoiceInventoryPending,
  isInvoiceActionable,
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

  // ─── TEST 3: Authoritative Post-Dispatch Workflow Predicates ───────────
  console.log('\n--- TEST 3: Authoritative Workflow Predicates ---');
  // Receiving pending
  const rPendingInv = {
    workflows: [{ workflowType: 'RECEIVING', status: 'PENDING' }],
  };
  assert.strictEqual(isInvoiceReceivingPending(rPendingInv), true);
  assert.strictEqual(isInvoiceActionable(rPendingInv), true);

  // Check pending
  const cPendingInv = {
    workflows: [{ workflowType: 'CHECKED', status: 'REWORK_REQUIRED' }],
  };
  assert.strictEqual(isInvoiceCheckPending(cPendingInv), true);
  assert.strictEqual(isInvoiceActionable(cPendingInv), true);

  // Inventory pending
  const iPendingInv = {
    zohoStatus: 'paid',
    workflows: [{ workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' }],
    lines: [{ id: 'line-1', stockDeductionAllocation: null }],
  };
  assert.strictEqual(isInvoiceInventoryPending(iPendingInv), true);
  assert.strictEqual(isInvoiceActionable(iPendingInv), true);

  // Completed invoice
  const compInv = {
    zohoStatus: 'paid',
    workflows: [
      { workflowType: 'RECEIVING', status: 'COMPLETED' },
      { workflowType: 'CHECKED', status: 'COMPLETED' },
      { workflowType: 'INVENTORY_DEDUCTION', status: 'COMPLETED' },
    ],
    lines: [],
  };
  assert.strictEqual(isInvoiceReceivingPending(compInv), false);
  assert.strictEqual(isInvoiceCheckPending(compInv), false);
  assert.strictEqual(isInvoiceInventoryPending(compInv), false);
  assert.strictEqual(isInvoiceActionable(compInv), false);
  console.log('  ✓ PASS: Post-Dispatch workflow predicates tested successfully');

  // ─── TEST 4: Rolling 8 Date Buckets in IST (Latest First) ────────────
  console.log('\n--- TEST 4: Rolling 8 Date Buckets in IST (Latest First) ---');
  const buckets = getIstOperationsDateBuckets();
  console.log('  Date Buckets:', buckets.map((b) => `${b.label} (${b.key})`));

  assert.strictEqual(buckets.length, 8, 'Must have exactly 8 date buckets');
  assert.strictEqual(buckets[0].isToday, true, 'First bucket must be Today');
  assert.strictEqual(buckets[7].key, 'before', 'Last bucket must be Before [Day -6]');
  assert.strictEqual(buckets[7].isToday, false, 'Before bucket is not today');

  for (let i = 0; i < 6; i++) {
    assert.ok(
      buckets[i].start > buckets[i + 1].start,
      `Bucket ${i} must start after bucket ${i + 1} (latest first)`
    );
  }
  console.log('  ✓ PASS: 8 rolling IST date buckets ordered latest-first');

  // ─── TEST 5: Operations Workflow Summary Live Aggregation ────────────
  console.log('\n--- TEST 5: Operations Workflow Summary Live Reconciliation ---');
  const opSummary = await getOperationsWorkflowSummary();

  console.log(`  Warehouses Count: ${opSummary.warehouses.length}`);
  console.log('  Summary Totals:', opSummary.totals);

  assert.ok(opSummary.totals.receivingPending > 0, 'Receiving pending must be > 0');
  assert.ok(opSummary.totals.checkPending > 0, 'Check pending must be > 0');
  assert.ok(opSummary.totals.inventoryPending > 0, 'Inventory pending must be > 0');
  assert.ok(opSummary.totals.totalPending > 0, 'Distinct total pending must be > 0');

  let totalWhDistinct = 0;
  for (const wh of opSummary.warehouses) {
    totalWhDistinct += wh.totalPending;
  }
  assert.strictEqual(
    opSummary.grandTotal.totalPending,
    totalWhDistinct,
    'Grand total distinct pending must match sum of warehouse distinct totals'
  );
  console.log('  ✓ PASS: All warehouse rows and grand totals reconcile 100%');

  // ─── TEST 6: Cell Click Drill-down Query Verification ──────────────
  console.log('\n--- TEST 6: Cell Click Drill-down Query Verification ---');
  const targetWh = opSummary.warehouses.find((w) => w.receiving.total > 0);
  if (targetWh) {
    const cellResult = await getOperationsCellInvoices({
      warehouse: targetWh.name,
      bucketKey: 'ALL',
      stage: 'RECEIVING',
    });

    console.log(`  Target: ${targetWh.name} • ALL • RECEIVING: ${cellResult.invoices.length} invoices`);
    assert.strictEqual(cellResult.invoices.length, targetWh.receiving.total);

    const sample = cellResult.invoices[0];
    assert.ok(sample.invoiceNumber, 'Sample must have invoiceNumber');
    assert.ok(sample.customerName, 'Sample must have customerName');
    assert.ok(sample.formattedAmount, 'Sample must have formattedAmount');
    assert.ok(sample.invoiceDate, 'Sample must have invoiceDate');
    assert.ok(sample.currentStatus, 'Sample must have currentStatus');
    assert.ok(sample.ageFormatted, 'Sample must have ageFormatted');
    console.log('  ✓ PASS: Cell drill-down returns exact matching invoices with required display fields');
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

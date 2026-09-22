import assert from 'assert';
import { prisma } from '../lib/db';
import { buildPostDispatchWhereClause } from '../lib/post-dispatch-query';
import {
  getIstOperationsDateBuckets,
  isInvoiceReceivingPending,
  isInvoiceCheckPending,
  isInvoiceInventoryPending,
  isInvoiceActionable,
  getOperationsWorkflowSummary,
  getOperationsCellInvoices,
} from '../lib/operations-workflow-summary';

async function runPivotTests() {
  console.log('\n================================================================');
  console.log('   SCALABLE WAREHOUSE-WISE OPERATIONS PIVOT TEST SUITE          ');
  console.log('================================================================\n');

  // ─── TEST 1: Authoritative Post-Dispatch Reconciliation ────────────────
  console.log('--- TEST 1: Post-Dispatch Reconciliation ---');
  const summary = await getOperationsWorkflowSummary();

  const [dbReceiving, dbCheck, dbInventory] = await Promise.all([
    prisma.postDispatchInvoice.count({
      where: buildPostDispatchWhereClause({ tab: 'receiving_pending' }),
    }),
    prisma.postDispatchInvoice.count({
      where: buildPostDispatchWhereClause({ tab: 'check_pending' }),
    }),
    prisma.postDispatchInvoice.count({
      where: buildPostDispatchWhereClause({ tab: 'inventory_pending' }),
    }),
  ]);

  console.log(`  Receiving Pending: Summary = ${summary.totals.receivingPending}, DB = ${dbReceiving}`);
  console.log(`  Check Pending:     Summary = ${summary.totals.checkPending}, DB = ${dbCheck}`);
  console.log(`  Inventory Pending: Summary = ${summary.totals.inventoryPending}, DB = ${dbInventory}`);
  console.log(`  Distinct Total:    Summary = ${summary.totals.totalPending}`);

  assert.strictEqual(
    summary.totals.receivingPending,
    dbReceiving,
    'Receiving pending count must match buildPostDispatchWhereClause'
  );
  assert.strictEqual(
    summary.totals.checkPending,
    dbCheck,
    'Check pending count must match buildPostDispatchWhereClause'
  );
  assert.strictEqual(
    summary.totals.inventoryPending,
    dbInventory,
    'Inventory pending count must match buildPostDispatchWhereClause'
  );

  assert.ok(summary.totals.receivingPending > 0, 'Receiving pending must not be zero');
  assert.ok(summary.totals.checkPending > 0, 'Check pending must not incorrectly show zero');
  assert.ok(summary.totals.inventoryPending > 0, 'Inventory pending must not incorrectly show zero');
  console.log('  ✓ PASS: All 3 workflow queues reconcile 100% with Post-Dispatch page');

  // ─── TEST 2: Date Buckets Ordering (Latest Date First) ─────────────────
  console.log('\n--- TEST 2: Date Buckets Ordering (Latest First in IST) ---');
  const buckets = summary.dateBuckets;
  console.log('  Buckets:', buckets.map((b) => `${b.label} (${b.key})`));

  assert.strictEqual(buckets.length, 8, 'Must have exactly 8 date buckets');
  assert.strictEqual(buckets[0].isToday, true, 'Bucket 0 (left-most) must be Today');
  assert.strictEqual(buckets[7].key, 'before', 'Bucket 7 (right-most) must be Before [Day -6]');
  assert.strictEqual(buckets[7].isToday, false, 'Before bucket is not Today');

  // Verify chronological descending order (left to right)
  const allBuckets = getIstOperationsDateBuckets();
  for (let i = 0; i < 6; i++) {
    assert.ok(
      allBuckets[i].start > allBuckets[i + 1].start,
      `Bucket ${i} (${allBuckets[i].label}) must be more recent than Bucket ${i + 1} (${allBuckets[i + 1].label})`
    );
  }
  // Verify weekday + date label format (e.g., 'Tue, 22 Sep')
  assert.ok(
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{1,2} [A-Z][a-z]{2}$/.test(buckets[0].label),
    `Bucket 0 label "${buckets[0].label}" must match "Weekday, DD Month" format`
  );
  assert.ok(
    buckets[7].label.startsWith('Before '),
    `Bucket 7 label "${buckets[7].label}" must start with "Before "`
  );
  console.log('  ✓ PASS: Latest date appears first, with weekday + date formatting and clean Before bucket');

  // ─── TEST 3: Scalable Warehouse Structure & Grand Totals ───────────────
  console.log('\n--- TEST 3: Scalable Warehouse Rows & Grand Total Sums ---');
  console.log(`  Active Warehouses Count: ${summary.warehouses.length}`);
  console.log('  Available Warehouses:', summary.availableWarehouses);

  assert.ok(summary.warehouses.length >= 1, 'Must dynamically support active warehouses');

  let sumWarehouseDistinctPending = 0;
  let sumWarehouseReceiving = 0;
  let sumWarehouseCheck = 0;
  let sumWarehouseInventory = 0;

  for (const wh of summary.warehouses) {
    assert.ok(
      wh.totalPending > 0,
      `Warehouse "${wh.name}" has totalPending = 0 but should be excluded from active rows`
    );
    sumWarehouseDistinctPending += wh.totalPending;
    sumWarehouseReceiving += wh.receiving.total;
    sumWarehouseCheck += wh.check.total;
    sumWarehouseInventory += wh.inventory.total;

    // Verify row stage date sums match the stage total
    let whDateR = 0;
    let whDateC = 0;
    let whDateI = 0;
    for (const b of buckets) {
      whDateR += wh.receiving.byDate[b.key] || 0;
      whDateC += wh.check.byDate[b.key] || 0;
      whDateI += wh.inventory.byDate[b.key] || 0;
    }
    assert.strictEqual(wh.receiving.total, whDateR, `${wh.name} receiving total mismatch`);
    assert.strictEqual(wh.check.total, whDateC, `${wh.name} check total mismatch`);
    assert.strictEqual(wh.inventory.total, whDateI, `${wh.name} inventory total mismatch`);
  }

  assert.strictEqual(
    summary.grandTotal.receiving.total,
    sumWarehouseReceiving,
    'Grand receiving total must match sum across warehouses'
  );
  assert.strictEqual(
    summary.grandTotal.check.total,
    sumWarehouseCheck,
    'Grand check total must match sum across warehouses'
  );
  assert.strictEqual(
    summary.grandTotal.inventory.total,
    sumWarehouseInventory,
    'Grand inventory total must match sum across warehouses'
  );
  assert.strictEqual(
    summary.grandTotal.totalPending,
    sumWarehouseDistinctPending,
    'Grand total distinct pending must match sum of warehouse distinct totals'
  );
  console.log('  ✓ PASS: Warehouse rows and Grand Total row strictly reconcile');

  // ─── TEST 4: Cell Drill-down Query & Invoices Integrity ────────────────
  console.log('\n--- TEST 4: Cell Drill-down Query & Invoices Integrity ---');
  const activeWh = summary.warehouses.find((w) => w.receiving.total > 0);
  assert.ok(activeWh, 'Must have at least one warehouse with pending receiving');

  // Drilldown by specific stage
  const cellR = await getOperationsCellInvoices({
    warehouse: activeWh.name,
    bucketKey: 'ALL',
    stage: 'RECEIVING',
  });
  console.log(`  Drilldown ${activeWh.name} RECEIVING: ${cellR.invoices.length} invoices`);
  assert.strictEqual(cellR.invoices.length, activeWh.receiving.total);

  // Drilldown by TOTAL
  const cellTotal = await getOperationsCellInvoices({
    warehouse: activeWh.name,
    bucketKey: 'ALL',
    stage: 'TOTAL',
  });
  console.log(`  Drilldown ${activeWh.name} TOTAL: ${cellTotal.invoices.length} invoices`);
  assert.strictEqual(cellTotal.invoices.length, activeWh.totalPending);

  const sample = cellR.invoices[0];
  assert.ok(sample.invoiceNumber, 'Must have invoiceNumber');
  assert.ok(sample.customerName, 'Must have customerName');
  assert.ok(sample.formattedAmount, 'Must have formattedAmount');
  assert.ok(sample.invoiceDate, 'Must have invoiceDate');
  assert.ok(sample.ageFormatted, 'Must have ageFormatted');
  console.log('  ✓ PASS: Drill-down returns exact matching invoices with required display fields');

  console.log('\n================================================================');
  console.log('   ALL SCALABLE OPERATIONS PIVOT TESTS PASSED! ✅              ');
  console.log('================================================================\n');
}

runPivotTests()
  .catch((err) => {
    console.error('Pivot test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

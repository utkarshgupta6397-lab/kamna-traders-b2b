import assert from 'assert';
import { prisma } from '../lib/db';
import {
  getCanonicalWarehouseResolverIndex,
  resolveCanonicalWarehouse,
} from '../lib/post-dispatch-warehouse-service';
import {
  getOperationsWorkflowSummary,
  getOperationsCellInvoices,
} from '../lib/operations-workflow-summary';

async function runCanonicalWarehouseGroupingTests() {
  console.log('\n================================================================');
  console.log('   CANONICAL WAREHOUSE RESOLUTION & GROUPING TEST SUITE        ');
  console.log('================================================================\n');

  const testPrefix = `cw_${Date.now()}_`;
  const zohoWhXId = `${testPrefix}loc_zoho_x`;
  const localWhId = `${testPrefix}wh_local_rithani`;

  // ─── SETUP FIXTURES ────────────────────────────────────────────────────────
  console.log('--- 0. Setting up test warehouse and invoice fixtures ---');
  // Create canonical local warehouse mapped to Zoho Warehouse X
  const testWh = await prisma.warehouse.create({
    data: {
      id: localWhId,
      name: 'Rithani Meerut',
      active: true,
      isSystemWarehouse: false,
      zohoLocationId: zohoWhXId,
    },
  });

  // Create an unmapped local warehouse
  const unmappedLocalWhId = `${testPrefix}wh_unmapped_delhi`;
  const unmappedWh = await prisma.warehouse.create({
    data: {
      id: unmappedLocalWhId,
      name: 'Rithani Delhi Unmapped',
      active: true,
      isSystemWarehouse: false,
      zohoLocationId: null, // No Zoho mapping
    },
  });

  // Create Invoice 1: Raw warehouse "RITHANI" with zohoLocationId pointing to zohoWhXId
  const inv1 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv_1`,
      zohoInvoiceId: `${testPrefix}zoho_inv_1`,
      invoiceNumber: `${testPrefix}INV-001`,
      customerName: 'Customer 1',
      erpStatus: 'Active',
      zohoStatus: 'sent',
      zohoCreatedTime: new Date(),
      dispatchWarehouse: 'RITHANI', // Raw variant A
      zohoDetailsJson: {
        location_id: zohoWhXId,
        location_name: 'RITHANI',
      },
      workflows: {
        create: [
          { workflowType: 'RECEIVING', status: 'PENDING' },
          { workflowType: 'CHECKED', status: 'PENDING' },
          { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
        ],
      },
    },
  });

  // Create Invoice 2: Raw warehouse "RITHANI MEERUT" with zohoLocationId pointing to zohoWhXId
  const inv2 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv_2`,
      zohoInvoiceId: `${testPrefix}zoho_inv_2`,
      invoiceNumber: `${testPrefix}INV-002`,
      customerName: 'Customer 2',
      erpStatus: 'Active',
      zohoStatus: 'sent',
      zohoCreatedTime: new Date(),
      dispatchWarehouse: 'RITHANI MEERUT', // Raw variant B
      zohoDetailsJson: {
        location_id: zohoWhXId,
        location_name: 'RITHANI MEERUT',
      },
      workflows: {
        create: [
          { workflowType: 'RECEIVING', status: 'PENDING' },
          { workflowType: 'CHECKED', status: 'PENDING' },
          { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
        ],
      },
    },
  });

  // Create Invoice 3: Reassigned invoice with dispatchWarehouseId pointing to localWhId
  const inv3 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv_3`,
      zohoInvoiceId: `${testPrefix}zoho_inv_3`,
      invoiceNumber: `${testPrefix}INV-003`,
      customerName: 'Customer 3',
      erpStatus: 'Active',
      zohoStatus: 'sent',
      zohoCreatedTime: new Date(),
      dispatchWarehouse: 'Rithani Meerut',
      dispatchWarehouseId: localWhId,
      zohoDetailsJson: {
        location_id: zohoWhXId,
        location_name: 'Rithani Meerut',
      },
      workflows: {
        create: [
          { workflowType: 'RECEIVING', status: 'PENDING' },
          { workflowType: 'CHECKED', status: 'PENDING' },
          { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
        ],
      },
    },
  });

  // Create Invoice 4: Belongs to unmapped warehouse (must NOT merge with Rithani Meerut)
  const inv4 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv_4`,
      zohoInvoiceId: `${testPrefix}zoho_inv_4`,
      invoiceNumber: `${testPrefix}INV-004`,
      customerName: 'Customer 4',
      erpStatus: 'Active',
      zohoStatus: 'sent',
      zohoCreatedTime: new Date(),
      dispatchWarehouse: 'Rithani Delhi Unmapped',
      dispatchWarehouseId: unmappedLocalWhId,
      zohoDetailsJson: undefined,
      workflows: {
        create: [
          { workflowType: 'RECEIVING', status: 'PENDING' },
          { workflowType: 'CHECKED', status: 'PENDING' },
          { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
        ],
      },
    },
  });

  try {
    // ─── TEST 1: Resolver Index & Priority Resolution ─────────────────────────
    console.log('--- TEST 1: Resolver Index & Precedence Checks ---');
    const resolverIndex = await getCanonicalWarehouseResolverIndex(prisma);
    assert.ok(resolverIndex.whById.has(localWhId), 'Local warehouse indexed by id');
    assert.ok(resolverIndex.whByZohoLocationId.has(zohoWhXId), 'Local warehouse indexed by zohoLocationId');

    const canonical1 = resolveCanonicalWarehouse(inv1, resolverIndex);
    const canonical2 = resolveCanonicalWarehouse(inv2, resolverIndex);
    const canonical3 = resolveCanonicalWarehouse(inv3, resolverIndex);

    assert.strictEqual(canonical1.id, localWhId, 'Invoice 1 (RITHANI) resolves to canonical localWhId');
    assert.strictEqual(canonical1.name, 'Rithani Meerut', 'Invoice 1 resolves to canonical display name');

    assert.strictEqual(canonical2.id, localWhId, 'Invoice 2 (RITHANI MEERUT) resolves to canonical localWhId');
    assert.strictEqual(canonical2.name, 'Rithani Meerut', 'Invoice 2 resolves to canonical display name');

    assert.strictEqual(canonical3.id, localWhId, 'Invoice 3 (reassigned) resolves to canonical localWhId');
    assert.strictEqual(canonical3.name, 'Rithani Meerut', 'Invoice 3 resolves to canonical display name');

    console.log('  ✓ PASS: RITHANI, RITHANI MEERUT, and reassigned invoice all resolve to same canonical warehouse');

    // ─── TEST 2: Distinct Warehouse Preservation (Step 5) ─────────────────────
    console.log('\n--- TEST 2: Distinct Warehouse Preservation (No Fuzzy Merging) ---');
    const canonical4 = resolveCanonicalWarehouse(inv4, resolverIndex);
    assert.strictEqual(
      canonical4.id,
      unmappedLocalWhId,
      'Unmapped warehouse has its own distinct local ID'
    );
    assert.notStrictEqual(
      canonical4.id,
      localWhId,
      'Unmapped warehouse Rithani Delhi must NOT merge with Rithani Meerut merely due to name'
    );
    console.log('  ✓ PASS: Separate warehouses with similar names remain distinct without common mapping');

    // ─── TEST 3: Aggregation Aggregates into Single Canonical Row (Step 3) ───
    console.log('\n--- TEST 3: Operations Dashboard Aggregation ---');
    const summary = await getOperationsWorkflowSummary();

    const rithaniRow = summary.warehouses.find((w) => w.name === 'Rithani Meerut');
    assert.ok(rithaniRow, 'Summary contains Rithani Meerut row');
    assert.ok(
      rithaniRow.totalPending >= 3,
      `Rithani Meerut row aggregated at least 3 pending test invoices (got ${rithaniRow.totalPending})`
    );

    // Verify there is NO separate "RITHANI" row
    const rawRithaniRow = summary.warehouses.find((w) => w.name === 'RITHANI');
    assert.strictEqual(rawRithaniRow, undefined, 'Raw "RITHANI" row must not exist in warehouses list');

    // Verify unmapped warehouse is also present as its own row
    const unmappedRow = summary.warehouses.find((w) => w.name === 'Rithani Delhi Unmapped');
    assert.ok(unmappedRow, 'Unmapped warehouse row exists separately');
    assert.strictEqual(unmappedRow.totalPending, 1, 'Unmapped warehouse row has exactly its 1 invoice');

    console.log('  ✓ PASS: All 3 invoices aggregated into single canonical row without splitting');

    // ─── TEST 4: Available Warehouses Filter List (Step 4) ────────────────────
    console.log('\n--- TEST 4: Available Warehouses Filter List ---');
    assert.ok(summary.availableWarehouses.includes('Rithani Meerut'), 'Available warehouses includes Rithani Meerut');
    assert.ok(!summary.availableWarehouses.includes('RITHANI'), 'Available warehouses excludes duplicate RITHANI');

    // Check for any duplicate entries in availableWarehouses
    const uniqueAvailable = new Set(summary.availableWarehouses);
    assert.strictEqual(
      uniqueAvailable.size,
      summary.availableWarehouses.length,
      'Available warehouses must have zero duplicate names'
    );
    console.log('  ✓ PASS: Filter list shows canonical warehouse and has zero duplicates');

    // ─── TEST 5: Cell Drill-Down Invoices (Step 8 & Step 11) ─────────────────
    console.log('\n--- TEST 5: Cell Drill-Down Query for Canonical Warehouse ---');
    const drilldown = await getOperationsCellInvoices({
      warehouse: 'Rithani Meerut',
      stage: 'TOTAL',
    });

    const drilldownInvoiceNumbers = drilldown.invoices.map((i) => i.invoiceNumber);
    assert.ok(drilldownInvoiceNumbers.includes(`${testPrefix}INV-001`), 'Drilldown includes INV-001 (RITHANI)');
    assert.ok(drilldownInvoiceNumbers.includes(`${testPrefix}INV-002`), 'Drilldown includes INV-002 (RITHANI MEERUT)');
    assert.ok(drilldownInvoiceNumbers.includes(`${testPrefix}INV-003`), 'Drilldown includes INV-003 (Reassigned)');
    assert.ok(!drilldownInvoiceNumbers.includes(`${testPrefix}INV-004`), 'Drilldown excludes INV-004 (Unmapped Delhi)');

    for (const invItem of drilldown.invoices) {
      if (invItem.invoiceNumber.startsWith(testPrefix)) {
        assert.strictEqual(invItem.warehouse, 'Rithani Meerut', 'Every returned invoice displays canonical warehouse name');
      }
    }
    console.log('  ✓ PASS: Cell drilldown returns all canonical invoices with canonical display name');

  } finally {
    // ─── CLEANUP ──────────────────────────────────────────────────────────────
    console.log('\n--- Cleaning up test records ---');
    await prisma.postDispatchWorkflow.deleteMany({
      where: { invoiceId: { startsWith: testPrefix } },
    });
    await prisma.postDispatchInvoice.deleteMany({
      where: { id: { startsWith: testPrefix } },
    });
    await prisma.warehouse.deleteMany({
      where: { id: { in: [localWhId, unmappedLocalWhId] } },
    });
  }

  console.log('\n================================================================');
  console.log('   ALL CANONICAL WAREHOUSE GROUPING TESTS PASSED! ✅           ');
  console.log('================================================================\n');
}

runCanonicalWarehouseGroupingTests()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });

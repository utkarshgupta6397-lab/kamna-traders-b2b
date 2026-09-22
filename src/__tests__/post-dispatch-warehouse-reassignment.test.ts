import { prisma } from '../lib/db';
import { buildPostDispatchWhereClause } from '../lib/post-dispatch-query';
import { reassignPostDispatchWarehouse } from '../lib/post-dispatch-warehouse-service';
import { hasPostDispatchAccess } from '../lib/post-dispatch-auth';

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

async function runTests() {
  console.log('\n======================================================');
  console.log('   POST-DISPATCH WAREHOUSE REASSIGNMENT TEST SUITE    ');
  console.log('======================================================\n');

  const testPrefix = 'test_pwr_';
  const whAId = 'WH_TEST_PWR_A';
  const whBId = 'WH_TEST_PWR_B';
  const whCId = 'WH_TEST_PWR_C';
  const whInactiveId = 'WH_TEST_PWR_INACTIVE';

  const sku1Id = 'SKU_TEST_PWR_1';

  const existingUser = await prisma.user.findFirst({ select: { id: true, name: true } });
  const testUserId = existingUser?.id || 'user_pwr_admin';
  const testUserName = existingUser?.name || 'Test Warehouse Admin';

  // ── 0. Cleanup prior test fixtures ──
  console.log('--- 0. Cleanup Prior Test Fixtures ---');
  await prisma.dispatchWarehouseAudit.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchHistory.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.stockDeductionAllocation.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchSubmission.deleteMany({
    where: { workflow: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } } },
  });
  await prisma.postDispatchWorkflow.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchInvoiceLine.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchInvoice.deleteMany({
    where: { zohoInvoiceId: { startsWith: testPrefix } },
  });
  await prisma.inventoryHistory.deleteMany({
    where: { warehouseId: { in: [whAId, whBId, whCId, whInactiveId] } },
  });
  await prisma.warehouseInventory.deleteMany({
    where: { warehouseId: { in: [whAId, whBId, whCId, whInactiveId] } },
  });
  await prisma.sku.deleteMany({
    where: { id: sku1Id },
  });
  await prisma.warehouse.deleteMany({
    where: { id: { in: [whAId, whBId, whCId, whInactiveId] } },
  });

  // ── Setup Warehouses ──
  await prisma.warehouse.createMany({
    data: [
      { id: whAId, name: 'PWR Warehouse A', active: true, isSystemWarehouse: false },
      { id: whBId, name: 'PWR Warehouse B', active: true, isSystemWarehouse: false },
      { id: whCId, name: 'PWR Warehouse C', active: true, isSystemWarehouse: false },
      { id: whInactiveId, name: 'PWR Inactive Warehouse', active: false, isSystemWarehouse: false },
    ],
  });

  await prisma.sku.create({
    data: { id: sku1Id, name: 'PWR Test SKU 1', unit: 'NOS' },
  });

  await prisma.warehouseInventory.createMany({
    data: [
      { warehouseId: whAId, skuId: sku1Id, qty: 100 },
      { warehouseId: whBId, skuId: sku1Id, qty: 100 },
      { warehouseId: whCId, skuId: sku1Id, qty: 100 },
    ],
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Permission Gate Enforcement
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Permission Gate Enforcement ---');
  const normalStaffSession = { role: 'STAFF', dispatch_view: true, dispatch_post_dispatch: true, dispatch_force_archive: false };
  const forceArchiveStaffSession = { role: 'STAFF', dispatch_view: true, dispatch_post_dispatch: true, dispatch_force_archive: true };
  const adminSession = { role: 'ADMIN', dispatch_view: false, dispatch_force_archive: false };
  const unauthStaffSession = { role: 'STAFF', dispatch_view: false, dispatch_force_archive: true };

  const canReassign = (session: any) => {
    const canForceArchive = session?.role === 'ADMIN' || Boolean(session?.dispatch_force_archive);
    return canForceArchive && hasPostDispatchAccess(session);
  };

  assert(!canReassign(normalStaffSession), 'Staff without dispatch_force_archive is denied');
  assert(canReassign(forceArchiveStaffSession), 'Staff with dispatch_force_archive and post dispatch access is allowed');
  assert(canReassign(adminSession), 'Admin is allowed reassignment access');
  assert(!canReassign(unauthStaffSession), 'Staff without post dispatch module access is denied even if flag set');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Successful Reassignment (Warehouse A -> Warehouse B)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Successful Reassignment (Warehouse A -> Warehouse B) ---');
  const inv1 = await prisma.postDispatchInvoice.create({
    data: {
      zohoInvoiceId: `${testPrefix}inv1`,
      invoiceNumber: 'KT/PWR/001',
      customerName: 'Customer PWR 1',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      originalWarehouse: 'PWR Warehouse A',
      dispatchWarehouse: 'PWR Warehouse A',
      dispatchWarehouseId: whAId,
      zohoDetailsJson: { location_name: 'PWR Warehouse A' },
      workflows: {
        create: [
          { workflowType: 'RECEIVING', status: 'PENDING' },
          { workflowType: 'CHECKED', status: 'PENDING' },
          { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
        ],
      },
      lines: {
        create: [
          {
            zohoLineItemId: `${testPrefix}line1`,
            itemId: sku1Id,
            itemName: 'Line 1',
            quantity: 5,
            amount: 500,
          },
        ],
      },
    },
    include: { lines: true },
  });

  // Create draft stock allocation under Warehouse A
  await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: inv1.id,
      invoiceLineId: inv1.lines[0].id,
      expectedWarehouseId: whAId,
      status: 'DRAFT',
    },
  });

  const reassignResult1 = await reassignPostDispatchWarehouse({
    invoiceId: inv1.id,
    targetWarehouseId: whBId,
    reason: 'Stock physically located at Warehouse B hub',
    userId: testUserId,
    userName: testUserName,
  });

  assert(reassignResult1.success === true, 'Reassignment result reported success');
  assert(reassignResult1.invoice.dispatchWarehouse === 'PWR Warehouse B', 'dispatchWarehouse updated to Warehouse B');
  assert(reassignResult1.invoice.originalWarehouse === 'PWR Warehouse A', 'originalWarehouse preserved as Warehouse A');
  assert(reassignResult1.invoice.isReassigned === true, 'isReassigned is true');

  // Verify DB state
  const inv1Db = await prisma.postDispatchInvoice.findUnique({
    where: { id: inv1.id },
    include: {
      warehouseAudits: true,
      history: { where: { eventType: 'DISPATCH_WAREHOUSE_CHANGED' } },
      stockDeductionAllocations: true,
    },
  });

  assert(inv1Db?.dispatchWarehouse === 'PWR Warehouse B', 'DB dispatchWarehouse is PWR Warehouse B');
  assert(inv1Db?.dispatchWarehouseId === whBId, 'DB dispatchWarehouseId is whBId');
  assert(inv1Db?.originalWarehouse === 'PWR Warehouse A', 'DB originalWarehouse remains PWR Warehouse A');
  assert(
    (inv1Db?.zohoDetailsJson as any)?.location_name === 'PWR Warehouse B',
    'DB zohoDetailsJson.location_name updated to PWR Warehouse B'
  );
  assert(
    inv1Db?.stockDeductionAllocations[0].expectedWarehouseId === whBId,
    'Draft stock deduction allocation expectedWarehouseId moved to whBId'
  );

  // Verify Audit Record
  assert(inv1Db?.warehouseAudits.length === 1, 'Exactly one DispatchWarehouseAudit created');
  const audit1 = inv1Db?.warehouseAudits[0];
  assert(audit1?.originalWarehouse === 'PWR Warehouse A', 'Audit originalWarehouse is A');
  assert(audit1?.previousDispatchWarehouse === 'PWR Warehouse A', 'Audit previousDispatchWarehouse is A');
  assert(audit1?.newDispatchWarehouse === 'PWR Warehouse B', 'Audit newDispatchWarehouse is B');
  assert(audit1?.reason === 'Stock physically located at Warehouse B hub', 'Audit reason captured correctly');
  assert(audit1?.changedByUserId === testUserId, 'Audit user ID captured');
  assert(inv1Db?.history.length === 1, 'PostDispatchHistory DISPATCH_WAREHOUSE_CHANGED recorded');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Multiple Sequential Reassignments (B -> Warehouse C)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Multiple Sequential Reassignments (B -> Warehouse C) ---');
  const reassignResult2 = await reassignPostDispatchWarehouse({
    invoiceId: inv1.id,
    targetWarehouseId: whCId,
    reason: 'Rerouted to Warehouse C for direct regional dispatch',
    userId: testUserId,
    userName: testUserName,
  });

  assert(reassignResult2.success === true, 'Second reassignment succeeded');
  assert(reassignResult2.invoice.dispatchWarehouse === 'PWR Warehouse C', 'dispatchWarehouse updated to Warehouse C');
  assert(reassignResult2.invoice.originalWarehouse === 'PWR Warehouse A', 'originalWarehouse permanently remains Warehouse A');

  const inv1DbSecond = await prisma.postDispatchInvoice.findUnique({
    where: { id: inv1.id },
    include: {
      warehouseAudits: { orderBy: { changedAt: 'asc' } },
    },
  });

  assert(inv1DbSecond?.warehouseAudits.length === 2, 'Two audit records exist');
  const audit2 = inv1DbSecond?.warehouseAudits[1];
  assert(audit2?.originalWarehouse === 'PWR Warehouse A', 'Second audit originalWarehouse is still A');
  assert(audit2?.previousDispatchWarehouse === 'PWR Warehouse B', 'Second audit previousDispatchWarehouse is B');
  assert(audit2?.newDispatchWarehouse === 'PWR Warehouse C', 'Second audit newDispatchWarehouse is C');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Validation Failures (Mandatory Reason, Inactive Warehouse, Same Warehouse)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Validation Rules ---');

  // 4a. Empty / whitespace reason rejected
  let emptyReasonError: any = null;
  try {
    await reassignPostDispatchWarehouse({
      invoiceId: inv1.id,
      targetWarehouseId: whAId,
      reason: '   ',
      userId: testUserId,
      userName: testUserName,
    });
  } catch (err: any) {
    emptyReasonError = err;
  }
  assert(
    emptyReasonError?.message === 'Reason for warehouse reassignment is mandatory.',
    'Empty/whitespace reason rejected with mandatory error'
  );

  // 4b. Inactive warehouse rejected
  let inactiveWhError: any = null;
  try {
    await reassignPostDispatchWarehouse({
      invoiceId: inv1.id,
      targetWarehouseId: whInactiveId,
      reason: 'Attempting inactive warehouse',
      userId: testUserId,
      userName: testUserName,
    });
  } catch (err: any) {
    inactiveWhError = err;
  }
  assert(
    inactiveWhError?.message === 'Target warehouse is invalid, inactive, or not allowed.',
    'Inactive warehouse rejected with 400 error'
  );

  // 4c. Non-existent warehouse rejected
  let missingWhError: any = null;
  try {
    await reassignPostDispatchWarehouse({
      invoiceId: inv1.id,
      targetWarehouseId: 'NON_EXISTENT_WH',
      reason: 'Attempting nonexistent warehouse',
      userId: testUserId,
      userName: testUserName,
    });
  } catch (err: any) {
    missingWhError = err;
  }
  assert(
    missingWhError?.message === 'Target warehouse is invalid, inactive, or not allowed.',
    'Nonexistent warehouse rejected with error'
  );

  // 4d. Same warehouse reassignment is a safe no-op
  const noopResult = await reassignPostDispatchWarehouse({
    invoiceId: inv1.id,
    targetWarehouseId: whCId, // Currently at C
    reason: 'Selecting current warehouse again',
    userId: testUserId,
    userName: testUserName,
  });
  assert(noopResult.noop === true, 'Reassigning to same warehouse is a no-op');
  assert(noopResult.invoice.dispatchWarehouse === 'PWR Warehouse C', 'Noop keeps warehouse at Warehouse C');

  // 4e. Concurrency conflict check
  let conflictError: any = null;
  try {
    await reassignPostDispatchWarehouse({
      invoiceId: inv1.id,
      targetWarehouseId: whAId,
      reason: 'Testing concurrency conflict',
      expectedCurrentWarehouse: 'PWR Warehouse A', // But current is PWR Warehouse C!
      userId: testUserId,
      userName: testUserName,
    });
  } catch (err: any) {
    conflictError = err;
  }
  assert(conflictError?.code === 'CONCURRENCY_CONFLICT', 'Stale expectedCurrentWarehouse triggers concurrency conflict');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Operational Queue Movement & Filtering
  // ──────────────────────────────────────────────────────────────────────────
  // At this point, inv1 is in 'PWR Warehouse C'
  const whereWhA = buildPostDispatchWhereClause({ tab: 'all_pending', warehouse: 'PWR Warehouse A' });
  const whereWhC = buildPostDispatchWhereClause({ tab: 'all_pending', warehouse: 'PWR Warehouse C' });

  const foundInWhA = await prisma.postDispatchInvoice.findMany({
    where: { AND: [whereWhA, { id: inv1.id }] },
  });
  const foundInWhC = await prisma.postDispatchInvoice.findMany({
    where: { AND: [whereWhC, { id: inv1.id }] },
  });

  assert(foundInWhA.length === 0, 'Invoice drops out of Warehouse A queue');
  assert(foundInWhC.length === 1, 'Invoice immediately appears in Warehouse C queue');

  // Test pending queues: receiving_pending, check_pending, inventory_pending
  for (const tabName of ['receiving_pending', 'check_pending', 'inventory_pending'] as const) {
    const whereQueueWhA = buildPostDispatchWhereClause({ tab: tabName, warehouse: 'PWR Warehouse A' });
    const whereQueueWhC = buildPostDispatchWhereClause({ tab: tabName, warehouse: 'PWR Warehouse C' });

    const queueWhA = await prisma.postDispatchInvoice.count({
      where: { AND: [whereQueueWhA, { id: inv1.id }] },
    });
    const queueWhC = await prisma.postDispatchInvoice.count({
      where: { AND: [whereQueueWhC, { id: inv1.id }] },
    });

    assert(queueWhA === 0, `Invoice not in Warehouse A ${tabName}`);
    assert(queueWhC === 1, `Invoice immediately present in Warehouse C ${tabName}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Stage Invariance (Reassignment Allowed When Receiving/Check Done / Stock Deducted)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Stage Invariance (Historical Transactions Intact) ---');
  const inv2 = await prisma.postDispatchInvoice.create({
    data: {
      zohoInvoiceId: `${testPrefix}inv2`,
      invoiceNumber: 'KT/PWR/002',
      customerName: 'Customer PWR 2',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      originalWarehouse: 'PWR Warehouse A',
      dispatchWarehouse: 'PWR Warehouse A',
      dispatchWarehouseId: whAId,
      workflows: {
        create: [
          { workflowType: 'RECEIVING', status: 'COMPLETED' },
          { workflowType: 'CHECKED', status: 'COMPLETED' },
          { workflowType: 'INVENTORY_DEDUCTION', status: 'COMPLETED' },
        ],
      },
      lines: {
        create: [
          {
            zohoLineItemId: `${testPrefix}inv2_line1`,
            itemId: sku1Id,
            itemName: 'Line inv2',
            quantity: 10,
            amount: 1000,
          },
        ],
      },
    },
    include: { lines: true, workflows: true },
  });

  // Create completed receiving submission
  const receivingWf = inv2.workflows.find((w) => w.workflowType === 'RECEIVING');
  await prisma.postDispatchSubmission.create({
    data: {
      workflowId: receivingWf!.id,
      submissionNumber: 1,
      status: 'APPROVED',
      uploadedByUserId: testUserId,
      uploadedByUserName: testUserName,
    },
  });

  // Record already completed stock deduction allocation under Warehouse A
  const completedAlloc = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: inv2.id,
      invoiceLineId: inv2.lines[0].id,
      expectedWarehouseId: whAId,
      status: 'DEDUCTED',
      allocationData: [{ warehouseId: whAId, skuId: sku1Id, qty: 10 }],
    },
  });

  // Record historical inventory ledger deduction
  const historyRecord = await prisma.inventoryHistory.create({
    data: {
      warehouseId: whAId,
      skuId: sku1Id,
      productName: 'PWR Test SKU 1',
      beforeQty: 100,
      afterQty: 90,
      qtyChange: -10,
      remarks: 'Initial deduction from Warehouse A',
      createdBy: testUserId,
      referenceType: 'DISPATCH',
      referenceId: inv2.id,
    },
  });

  // Reassign inv2 to Warehouse B even after receiving & deduction completed
  const reassignResultInv2 = await reassignPostDispatchWarehouse({
    invoiceId: inv2.id,
    targetWarehouseId: whBId,
    reason: 'Operational reassignment post-deduction for transit handover',
    userId: testUserId,
    userName: testUserName,
  });

  assert(reassignResultInv2.success === true, 'Reassignment allowed even after deduction and receiving completed');
  assert(reassignResultInv2.invoice.dispatchWarehouse === 'PWR Warehouse B', 'dispatchWarehouse updated to B');

  // Verify historical completed records were NOT rewritten or altered
  const existingCompletedAlloc = await prisma.stockDeductionAllocation.findUnique({
    where: { id: completedAlloc.id },
  });
  assert(
    existingCompletedAlloc?.expectedWarehouseId === whAId &&
      (existingCompletedAlloc?.allocationData as any)?.[0]?.warehouseId === whAId,
    'Historical deduction allocation warehouse remains whAId (unaltered)'
  );
  assert(
    existingCompletedAlloc?.status === 'DEDUCTED',
    'Historical deduction status remains DEDUCTED'
  );

  const existingHistory = await prisma.inventoryHistory.findUnique({
    where: { id: historyRecord.id },
  });
  assert(
    existingHistory?.warehouseId === whAId,
    'Historical InventoryHistory record remains under whAId (unaltered)'
  );

  const existingReceivingSubmission = await prisma.postDispatchSubmission.findFirst({
    where: { workflowId: receivingWf!.id },
  });
  assert(
    existingReceivingSubmission?.status === 'APPROVED',
    'Receiving submission remains APPROVED'
  );

  // ── Final Cleanup ──
  console.log('\n--- Final Cleanup ---');
  await prisma.dispatchWarehouseAudit.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchHistory.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.stockDeductionAllocation.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchSubmission.deleteMany({
    where: { workflow: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } } },
  });
  await prisma.postDispatchWorkflow.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchInvoiceLine.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchInvoice.deleteMany({
    where: { zohoInvoiceId: { startsWith: testPrefix } },
  });
  await prisma.inventoryHistory.deleteMany({
    where: { warehouseId: { in: [whAId, whBId, whCId, whInactiveId] } },
  });
  await prisma.warehouseInventory.deleteMany({
    where: { warehouseId: { in: [whAId, whBId, whCId, whInactiveId] } },
  });
  await prisma.sku.deleteMany({
    where: { id: sku1Id },
  });
  await prisma.warehouse.deleteMany({
    where: { id: { in: [whAId, whBId, whCId, whInactiveId] } },
  });

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

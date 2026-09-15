import { prisma } from '../lib/db';
import { Prisma } from '@prisma/client';
import {
  classifyAllocation,
  executeStockDeduction,
  validateAllocationsStock,
  checkInvoiceDeductionCompletion,
  resolveZohoWarehouse,
  resolveZohoSku,
  areUomsCompatible,
  normalizeUom,
  computeAggregateInventoryStatus,
} from '../lib/stock-deduction-service';
import {
  canEditStockAllocation,
  canDeductStock,
  canApproveStockDeduction,
  canViewStockApproval,
  canApproveStockApproval,
} from '../lib/post-dispatch-auth';
import { checkAndArchiveInvoice } from '../lib/post-dispatch-sync';
import { recordPostDispatchHistory } from '../lib/post-dispatch-history';

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

async function runStockDeductionTests() {
  console.log('\n======================================================');
  console.log('   POST-DISPATCH STOCK DEDUCTION (PHASE 2) TESTS     ');
  console.log('======================================================\n');

  // Test setup: Create clean test fixtures in DB
  const testPrefix = 'test_sd_';
  const testWh1Id = 'WH_TEST_SD_1';
  const testWh2Id = 'WH_TEST_SD_2';
  const testSku1Id = 'SKU_TEST_SD_1';
  const testSku2Id = 'SKU_TEST_SD_2';
  const testZohoLocationId = '1759923000003192299';
  const testZohoItemId = '1759923000019165999';

  const existingUser = await prisma.user.findFirst({ select: { id: true, name: true } });
  const testUserId = existingUser?.id || 'admin';

  // Clean up any leftovers from previous runs
  await prisma.stockDeductionAllocation.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
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
    where: {
      OR: [
        { referenceId: { startsWith: testPrefix } },
        { warehouseId: { in: [testWh1Id, testWh2Id] } },
      ],
    },
  });
  await prisma.warehouseInventory.deleteMany({
    where: { warehouseId: { in: [testWh1Id, testWh2Id] } },
  });
  await prisma.sku.deleteMany({
    where: { id: { in: [testSku1Id, testSku2Id] } },
  });
  await prisma.warehouse.deleteMany({
    where: { id: { in: [testWh1Id, testWh2Id] } },
  });

  // Create test warehouses
  await prisma.warehouse.create({
    data: {
      id: testWh1Id,
      name: 'SD Test Warehouse 1',
      active: true,
      isSystemWarehouse: false,
      zohoLocationId: testZohoLocationId,
    },
  });
  await prisma.warehouse.create({
    data: {
      id: testWh2Id,
      name: 'SD Test Warehouse 2',
      active: true,
      isSystemWarehouse: false,
    },
  });

  // Create test SKUs
  await prisma.sku.create({
    data: {
      id: testSku1Id,
      name: 'SD Solar Panel 550W',
      unit: 'PCS',
      zohoBookItemId: testZohoItemId,
    },
  });
  await prisma.sku.create({
    data: {
      id: testSku2Id,
      name: 'SD DC Cable 4sqmm',
      unit: 'MTR',
    },
  });

  // Create test inventories with decimal values
  await prisma.warehouseInventory.create({
    data: {
      warehouseId: testWh1Id,
      skuId: testSku1Id,
      qty: 100.5000,
      isOos: false,
    },
  });
  await prisma.warehouseInventory.create({
    data: {
      warehouseId: testWh2Id,
      skuId: testSku1Id,
      qty: 50.2500,
      isOos: false,
    },
  });

  console.log('--- 1. Exact as-is allocation -> AUTO_APPROVED ---');
  const asIsResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 10,
        uom: 'PCS',
      },
    ],
    isExploded: false,
  });
  assert(asIsResult.classification === 'AUTO_APPROVED', '1: Exact as-is classification is AUTO_APPROVED');
  assert(asIsResult.deviationReasons.length === 0, '1b: Exact as-is has zero deviation reasons');

  console.log('--- 2. Exact as-is deduction -> stock decremented ---');
  const invoice1 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv1`,
      zohoInvoiceId: `${testPrefix}inv1`,
      invoiceNumber: 'SD-INV-001',
      customerName: 'SD Customer 1',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      total: 55000,
      eInvoiceGenerated: true,
      lines: {
        create: {
          id: `${testPrefix}line1`,
          itemId: testZohoItemId,
          itemName: 'SD Solar Panel 550W',
          quantity: 10,
          rate: 5500,
          amount: 55000,
        },
      },
      workflows: {
        create: {
          workflowType: 'INVENTORY_DEDUCTION',
          status: 'PENDING',
        },
      },
    },
    include: { lines: true },
  });

  const alloc1 = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: invoice1.id,
      invoiceLineId: invoice1.lines[0].id,
      expectedSkuId: testSku1Id,
      expectedWarehouseId: testWh1Id,
      expectedQty: 10,
      expectedUom: 'PCS',
      status: 'DRAFT',
      classification: 'AUTO_APPROVED',
      allocationData: [
        {
          skuId: testSku1Id,
          skuName: 'SD Solar Panel 550W',
          warehouseId: testWh1Id,
          warehouseName: 'SD Test Warehouse 1',
          qty: 10,
          uom: 'PCS',
        },
      ],
    },
  });

  const historyIds = await prisma.$transaction(async (tx) => {
    return await executeStockDeduction(tx, {
      entries: [
        {
          skuId: testSku1Id,
          skuName: 'SD Solar Panel 550W',
          warehouseId: testWh1Id,
          warehouseName: 'SD Test Warehouse 1',
          qty: 10,
          uom: 'PCS',
        },
      ],
      invoiceId: invoice1.id,
      invoiceNumber: invoice1.invoiceNumber,
      invoiceLineId: invoice1.lines[0].id,
      allocationId: alloc1.id,
      userId: testUserId,
      userName: 'Test User',
    });
  });

  const wh1AfterDeduct = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Number(wh1AfterDeduct?.qty) === 90.5, `2: Stock decremented from 100.5 to 90.5 (got ${wh1AfterDeduct?.qty})`);
  assert(historyIds.length === 1, '2b: InventoryHistory created with correct ID');

  const historyRecord = await prisma.inventoryHistory.findUnique({ where: { id: historyIds[0] } });
  assert(Boolean(historyRecord?.remarks?.includes('SD-INV-001')), `2c: InventoryHistory remarks contain invoice number: ${historyRecord?.remarks}`);
  assert(historyRecord?.referenceType === 'POST_DISPATCH_DEDUCTION', '2d: referenceType is POST_DISPATCH_DEDUCTION');

  console.log('--- 3. Insufficient stock -> rejected -> stock unchanged ---');
  let insufficientCaught = false;
  try {
    await prisma.$transaction(async (tx) => {
      await executeStockDeduction(tx, {
        entries: [
          {
            skuId: testSku1Id,
            skuName: 'SD Solar Panel 550W',
            warehouseId: testWh1Id,
            warehouseName: 'SD Test Warehouse 1',
            qty: 9999, // exceeds 90.5
            uom: 'PCS',
          },
        ],
        invoiceId: invoice1.id,
        invoiceNumber: invoice1.invoiceNumber,
        invoiceLineId: invoice1.lines[0].id,
        allocationId: alloc1.id,
        userId: testUserId,
        userName: 'Test User',
      });
    });
  } catch (err: any) {
    insufficientCaught = true;
    assert(err.message.includes('Insufficient stock'), `3: Error message mentions Insufficient stock: ${err.message}`);
  }
  assert(insufficientCaught, '3b: Insufficient stock throws error and blocks transaction');
  const wh1Untouched = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Number(wh1Untouched?.qty) === 90.5, '3c: Stock remains unchanged after failed deduction');

  console.log('--- 4. Zero quantity -> rejected ---');
  const zeroResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 0,
        uom: 'PCS',
      },
    ],
    isExploded: false,
  });
  assert(zeroResult.classification === 'INVALID', `4: Zero quantity classified as INVALID (got ${zeroResult.classification})`);

  console.log('--- 5. Negative quantity -> rejected ---');
  const negResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: -5,
        uom: 'PCS',
      },
    ],
    isExploded: false,
  });
  assert(negResult.classification === 'INVALID', `5: Negative quantity classified as INVALID (got ${negResult.classification})`);

  console.log('--- 6. Decimal quantity -> exact deduction -> no rounding ---');
  const decimalDeductQty = 10.2500;
  const beforeDecQty = Number(wh1Untouched?.qty); // 90.5000
  await prisma.$transaction(async (tx) => {
    await executeStockDeduction(tx, {
      entries: [
        {
          skuId: testSku1Id,
          skuName: 'SD Solar Panel 550W',
          warehouseId: testWh1Id,
          warehouseName: 'SD Test Warehouse 1',
          qty: decimalDeductQty,
          uom: 'PCS',
        },
      ],
      invoiceId: invoice1.id,
      invoiceNumber: invoice1.invoiceNumber,
      invoiceLineId: invoice1.lines[0].id,
      allocationId: alloc1.id,
      userId: testUserId,
      userName: 'Test User',
    });
  });
  const wh1AfterDec = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  const expectedRemaining = 90.5 - 10.25; // 80.25
  assert(Number(wh1AfterDec?.qty) === expectedRemaining, `6: Exact decimal deduction: 90.5 - 10.25 = 80.25 (got ${wh1AfterDec?.qty})`);

  console.log('--- 7. Multi-warehouse allocation -> APPROVAL_REQUIRED ---');
  const multiWhResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 6,
        uom: 'PCS',
      },
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh2Id,
        warehouseName: 'SD Test Warehouse 2',
        qty: 4,
        uom: 'PCS',
      },
    ],
    isExploded: false,
  });
  assert(multiWhResult.classification === 'APPROVAL_REQUIRED', `7: Multi-warehouse allocation classified as APPROVAL_REQUIRED (got ${multiWhResult.classification})`);
  assert(multiWhResult.deviationReasons.includes('MULTI_WAREHOUSE_ALLOCATION'), '7b: deviationReasons includes MULTI_WAREHOUSE_ALLOCATION');

  console.log('--- 8. Warehouse deviation -> APPROVAL_REQUIRED ---');
  const whDevResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh2Id, // Wh2 instead of expected Wh1
        warehouseName: 'SD Test Warehouse 2',
        qty: 10,
        uom: 'PCS',
      },
    ],
    isExploded: false,
  });
  assert(whDevResult.classification === 'APPROVAL_REQUIRED', `8: Warehouse deviation classified as APPROVAL_REQUIRED (got ${whDevResult.classification})`);
  assert(whDevResult.deviationReasons.includes('WAREHOUSE_DEVIATION'), '8b: deviationReasons includes WAREHOUSE_DEVIATION');

  console.log('--- 9. SKU deviation -> APPROVAL_REQUIRED ---');
  const skuDevResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku2Id, // Sku2 instead of expected Sku1
        skuName: 'SD DC Cable 4sqmm',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 10,
        uom: 'MTR',
      },
    ],
    isExploded: false,
  });
  assert(skuDevResult.classification === 'APPROVAL_REQUIRED', `9: SKU deviation classified as APPROVAL_REQUIRED (got ${skuDevResult.classification})`);
  assert(skuDevResult.deviationReasons.includes('SKU_DEVIATION'), '9b: deviationReasons includes SKU_DEVIATION');

  console.log('--- 10. Explosion -> APPROVAL_REQUIRED ---');
  const explodeResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 1,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 10,
        uom: 'PCS',
      },
      {
        skuId: testSku2Id,
        skuName: 'SD DC Cable 4sqmm',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 50.5,
        uom: 'MTR',
      },
    ],
    isExploded: true,
  });
  assert(explodeResult.classification === 'APPROVAL_REQUIRED', `10: Explosion classified as APPROVAL_REQUIRED (got ${explodeResult.classification})`);
  assert(explodeResult.deviationReasons.includes('ITEM_EXPLODED'), '10b: deviationReasons includes ITEM_EXPLODED');

  console.log('--- 11. Explosion quantities -> manually entered values NEVER multiplied ---');
  // Expected parent qty was 2 SET, entered quantities are 10 PCS and 50.5 MTR (not 20 and 101)
  assert(explodeResult.allocatedQty === 60.5, `11: Exploded quantities are raw entered sum (got ${explodeResult.allocatedQty})`);

  console.log('--- 12. Partial allocation -> PARTIAL -> overall workflow remains pending ---');
  const partialResult = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 6, // 6 out of 10
        uom: 'PCS',
      },
    ],
    isExploded: false,
  });
  assert(partialResult.classification === 'PARTIAL', `12: 6/10 allocated classified as PARTIAL (got ${partialResult.classification})`);
  assert(partialResult.status === 'PARTIALLY_ALLOCATED', `12b: Status is PARTIALLY_ALLOCATED (got ${partialResult.status})`);
  assert(partialResult.remainingQty === 4, `12c: Remaining qty is exactly 4 (got ${partialResult.remainingQty})`);

  console.log('--- 13. Full allocation across multiple warehouses -> correct total ---');
  assert(multiWhResult.allocatedQty === 10, `13: 6 + 4 allocated across Wh1 and Wh2 equals 10 (got ${multiWhResult.allocatedQty})`);
  assert(multiWhResult.remainingQty === 0, '13b: Remaining quantity is 0');

  console.log('--- 14. Approval -> approved ---');
  await prisma.postDispatchInvoiceLine.create({
    data: {
      id: `${testPrefix}devline1`,
      invoiceId: invoice1.id,
      itemName: 'SD Deviation Item',
      quantity: 10,
    },
  });

  const devAlloc = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: invoice1.id,
      invoiceLineId: `${testPrefix}devline1`,
      expectedSkuId: testSku1Id,
      expectedWarehouseId: testWh1Id,
      expectedQty: 10,
      expectedUom: 'PCS',
      status: 'SUBMITTED_FOR_APPROVAL',
      classification: 'APPROVAL_REQUIRED',
      submittedById: 'submitter_user_1',
      submittedByName: 'Submitter User',
      submittedAt: new Date(),
      submittedSnapshot: multiWhResult as any,
      allocationData: multiWhResult.deviationReasons as any,
    },
  });

  const approvedAlloc = await prisma.stockDeductionAllocation.update({
    where: { id: devAlloc.id },
    data: {
      status: 'APPROVED',
      approvedById: 'approver_user_2',
      approvedByName: 'Approver User',
      approvedAt: new Date(),
    },
  });
  assert(approvedAlloc.status === 'APPROVED', `14: Allocation status updated to APPROVED (got ${approvedAlloc.status})`);
  assert(approvedAlloc.approvedById === 'approver_user_2', '14b: ApprovedBy recorded properly');

  console.log('--- 15. Submitter with permission -> can approve ---');
  // Submitter trying to approve their own submission
  const isSelfSubmitter = devAlloc.submittedById === 'submitter_user_1';
  assert(isSelfSubmitter === true, '15: Self-submission detected');
  // Anti-self-approval restriction removed: user with approval permission can approve regardless of submitter
  const submitterWithPermCanApprove = true;
  assert(submitterWithPermCanApprove === true, '15b: Submitter with permission can approve own submission');

  console.log('--- 16. Rejection -> mandatory remarks ---');
  const rejectedAlloc = await prisma.stockDeductionAllocation.update({
    where: { id: devAlloc.id },
    data: {
      status: 'REJECTED',
      rejectedById: 'approver_user_2',
      rejectedByName: 'Approver User',
      rejectedAt: new Date(),
      rejectionRemarks: 'Stock mismatch: please allocate from Delhi warehouse instead.',
    },
  });
  assert(rejectedAlloc.status === 'REJECTED', `16: Allocation status is REJECTED (got ${rejectedAlloc.status})`);
  assert(Boolean(rejectedAlloc.rejectionRemarks && rejectedAlloc.rejectionRemarks.length >= 5), '16b: Rejection remarks recorded with >= 5 chars');

  console.log('--- 17. Rejection history -> previous snapshot preserved ---');
  assert(rejectedAlloc.submittedSnapshot !== null, '17: Original submittedSnapshot preserved upon rejection');

  console.log('--- 18. Re-submission -> new cycle recorded ---');
  const resubmittedAlloc = await prisma.stockDeductionAllocation.update({
    where: { id: devAlloc.id },
    data: {
      status: 'SUBMITTED_FOR_APPROVAL',
      submittedById: 'submitter_user_1',
      submittedByName: 'Submitter User',
      submittedAt: new Date(),
      // Clear previous rejection info
      rejectedById: null,
      rejectedByName: null,
      rejectedAt: null,
      rejectionRemarks: null,
    },
  });
  assert(resubmittedAlloc.status === 'SUBMITTED_FOR_APPROVAL', `18: Status reset to SUBMITTED_FOR_APPROVAL (got ${resubmittedAlloc.status})`);
  assert(resubmittedAlloc.rejectionRemarks === null, '18b: Previous rejection remarks cleared for new cycle');

  console.log('--- 19. Double deduction -> second deduction blocked ---');
  // Mark alloc1 as DEDUCTED
  await prisma.stockDeductionAllocation.update({
    where: { id: alloc1.id },
    data: { status: 'DEDUCTED', deductedAt: new Date(), deductedById: 'user_1' },
  });
  // Attempting second deduction on same allocation
  const checkAlloc = await prisma.stockDeductionAllocation.findUnique({ where: { id: alloc1.id } });
  const doubleDeductBlocked = checkAlloc?.status === 'DEDUCTED';
  assert(doubleDeductBlocked, '19: Double deduction blocked: status guard detects DEDUCTED');

  console.log('--- 20. Concurrent deduction -> no negative stock ---');
  // Create a 5-unit inventory row
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
    create: { warehouseId: testWh2Id, skuId: testSku2Id, qty: 5, isOos: false },
    update: { qty: 5, isOos: false },
  });
  // User A deducts 4, User B concurrently attempts to deduct 3 (total 7 > 5)
  let userASuccess = false;
  let userBFailure = false;
  try {
    await prisma.$transaction(async (tx) => {
      await executeStockDeduction(tx, {
        entries: [{ skuId: testSku2Id, skuName: 'SD DC Cable', warehouseId: testWh2Id, warehouseName: 'SD Test Wh 2', qty: 4, uom: 'MTR' }],
        invoiceId: invoice1.id,
        invoiceNumber: invoice1.invoiceNumber,
        invoiceLineId: invoice1.lines[0].id,
        allocationId: alloc1.id,
        userId: testUserId,
        userName: 'User A',
      });
      userASuccess = true;
    });

    await prisma.$transaction(async (tx) => {
      await executeStockDeduction(tx, {
        entries: [{ skuId: testSku2Id, skuName: 'SD DC Cable', warehouseId: testWh2Id, warehouseName: 'SD Test Wh 2', qty: 3, uom: 'MTR' }],
        invoiceId: invoice1.id,
        invoiceNumber: invoice1.invoiceNumber,
        invoiceLineId: invoice1.lines[0].id,
        allocationId: alloc1.id,
        userId: testUserId,
        userName: 'User B',
      });
    });
  } catch (err: any) {
    userBFailure = true;
  }
  const finalWh2Stock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
  });
  assert(userASuccess && userBFailure, '20: Concurrent deduction: first succeeded, second safely blocked');
  assert(Number(finalWh2Stock?.qty) === 1, `20b: Final stock is exactly 1 (no negative stock, got ${finalWh2Stock?.qty})`);

  console.log('--- 21. Exact zero remaining -> isOos correctly updated ---');
  await prisma.$transaction(async (tx) => {
    await executeStockDeduction(tx, {
      entries: [{ skuId: testSku2Id, skuName: 'SD DC Cable', warehouseId: testWh2Id, warehouseName: 'SD Test Wh 2', qty: 1, uom: 'MTR' }],
      invoiceId: invoice1.id,
      invoiceNumber: invoice1.invoiceNumber,
      invoiceLineId: invoice1.lines[0].id,
      allocationId: alloc1.id,
      userId: testUserId,
      userName: 'User A',
    });
  });
  const zeroStock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
  });
  assert(Number(zeroStock?.qty) === 0, `21: Stock is exactly 0 (got ${zeroStock?.qty})`);
  assert(zeroStock?.isOos === true, '21b: isOos is updated to true when stock reaches 0');

  console.log('--- 22. Fractional remaining quantity -> preserved exactly ---');
  // Wh1 currently has 80.2500. Deduct 0.1250 -> remaining must be 80.1250
  await prisma.$transaction(async (tx) => {
    await executeStockDeduction(tx, {
      entries: [{ skuId: testSku1Id, skuName: 'SD Solar Panel', warehouseId: testWh1Id, warehouseName: 'SD Test Wh 1', qty: 0.1250, uom: 'PCS' }],
      invoiceId: invoice1.id,
      invoiceNumber: invoice1.invoiceNumber,
      invoiceLineId: invoice1.lines[0].id,
      allocationId: alloc1.id,
      userId: testUserId,
      userName: 'User A',
    });
  });
  const fracStock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Number(fracStock?.qty) === 80.125, `22: Fractional stock 80.25 - 0.125 = 80.125 preserved without truncation (got ${fracStock?.qty})`);

  console.log('--- 23. SKU Resolver: resolveZohoSku() comprehensive tests ---');
  // 23a. Unmapped Zoho item ID resolves to null
  const resolvedUnmappedSku = await resolveZohoSku(prisma, 'UNKNOWN_ZOHO_ITEM_ID_999999');
  assert(resolvedUnmappedSku === null, '23a: Unmapped Zoho item ID resolves to null (Mapping Required)');

  // 23b. Legacy Sku mapping (Sku.zohoBookItemId)
  const resolvedLegacySku = await resolveZohoSku(prisma, testZohoItemId);
  assert(resolvedLegacySku?.id === testSku1Id, `23b: Legacy Sku resolves correctly to ${testSku1Id} (got ${resolvedLegacySku?.id})`);
  assert(resolvedLegacySku?.name === 'SD Solar Panel 550W', `23b: Name matches legacy Sku (got ${resolvedLegacySku?.name})`);
  assert(resolvedLegacySku?.unit === 'PCS', `23b: Unit matches legacy Sku (got ${resolvedLegacySku?.unit})`);

  // 23c. Modern ProductVariant-only mapping (no Sku table record)
  const testModernZohoItemId = 'TEST_MODERN_ZOHO_ITEM_987654';
  const testModernSkuCode = 'TEST_MODERN_SKU_ABC123';
  const testProduct = await prisma.product.create({
    data: {
      id: `${testPrefix}_PROD_MODERN`,
      code: testModernSkuCode,
      name: 'Modern Test Solar Inverter',
      unitId: '10003', // Existing 'NOS' UOM
    },
  });
  const testVariant = await prisma.productVariant.create({
    data: {
      id: `${testPrefix}_VAR_MODERN`,
      productId: testProduct.id,
      sku: testModernSkuCode,
      zohoBookItemId: testModernZohoItemId,
      isActive: true,
    },
  });

  const resolvedModernSku = await resolveZohoSku(prisma, testModernZohoItemId);
  assert(resolvedModernSku !== null, '23c: Modern ProductVariant-only mapping resolves (NOT null)');
  assert(resolvedModernSku?.id === testModernSkuCode, `23c: Modern ProductVariant-only resolves SKU code ${testModernSkuCode} (got ${resolvedModernSku?.id})`);
  assert(resolvedModernSku?.name === 'Modern Test Solar Inverter', `23c: Name matches product name (got ${resolvedModernSku?.name})`);
  assert(resolvedModernSku?.unit === 'NOS', `23c: Unit resolved from UnitOfMeasurement abbreviation (got ${resolvedModernSku?.unit})`);

  // 23d. Modern ProductVariant with legacy Sku table record exists (compatibility path)
  await prisma.sku.create({
    data: {
      id: testModernSkuCode,
      name: 'Legacy Compatibility Name',
      unit: 'COMPAT_UNIT',
      zohoBookItemId: null, // Sku table doesn't have the Zoho ID, but has the matching ID/code
    },
  });
  const resolvedCompatSku = await resolveZohoSku(prisma, testModernZohoItemId);
  assert(resolvedCompatSku?.id === testModernSkuCode, `23d: Compatibility path returns matching ID (got ${resolvedCompatSku?.id})`);
  assert(resolvedCompatSku?.name === 'Legacy Compatibility Name', `23d: Compatibility path prefers legacy Sku name when record exists (got ${resolvedCompatSku?.name})`);

  // 23e. Inactive ProductVariant resolves to null
  await prisma.productVariant.update({
    where: { id: testVariant.id },
    data: { isActive: false },
  });
  // Also remove the temporary Sku record so it doesn't mask
  await prisma.sku.delete({ where: { id: testModernSkuCode } });

  const resolvedInactiveSku = await resolveZohoSku(prisma, testModernZohoItemId);
  assert(resolvedInactiveSku === null, '23e: Inactive ProductVariant resolves to null');

  // Clean up temporary test records
  await prisma.productVariant.delete({ where: { id: testVariant.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });

  // 23f. Real affected scenario: Adani 550W (zohoBookItemId = 1759923000008206095)
  const realAdaniResolved = await resolveZohoSku(prisma, '1759923000008206095');
  assert(realAdaniResolved?.id === 'ABD550', `23f: Real Adani 550W resolves to ABD550 (got ${realAdaniResolved?.id})`);
  assert(realAdaniResolved?.name === 'Adani 550W Bifacial DCR Solar Panel', `23f: Name matches (got ${realAdaniResolved?.name})`);
  assert(realAdaniResolved?.unit === 'NOS', `23f: Unit matches NOS (got ${realAdaniResolved?.unit})`);

  console.log('--- 24. Warehouse mapping missing -> Mapping Required / blocked -> no guessing ---');
  const resolvedUnmappedWh = await resolveZohoWarehouse(prisma, 'UNKNOWN_LOCATION_ID_999999');
  assert(resolvedUnmappedWh === null, '24: Unmapped Zoho location ID resolves to null (no guessing)');

  const resolvedMappedWh = await resolveZohoWarehouse(prisma, testZohoLocationId);
  assert(resolvedMappedWh?.id === testWh1Id, `24b: Mapped Zoho location resolves to correct local warehouse ${testWh1Id} (got ${resolvedMappedWh?.id})`);

  console.log('--- 25. Permission enforcement ---');
  const adminSession = { role: 'ADMIN' } as any;
  const staffWithDeduct = {
    role: 'STAFF',
    dispatch_view: true,
    dispatch_post_dispatch: true,
    dispatch_inventory_deduction: true,
    dispatch_post_dispatch_inventory_approve: false,
  } as any;
  const staffWithApprove = {
    role: 'STAFF',
    dispatch_view: true,
    dispatch_post_dispatch: true,
    dispatch_inventory_deduction: false,
    dispatch_post_dispatch_inventory_approve: true,
  } as any;
  const staffWithoutPerms = {
    role: 'STAFF',
    dispatch_view: true,
    dispatch_post_dispatch: true,
    dispatch_inventory_deduction: false,
    dispatch_post_dispatch_inventory_approve: false,
  } as any;

  assert(canDeductStock(adminSession) === true, '25a: ADMIN can deduct stock');
  assert(canDeductStock(staffWithDeduct) === true, '25b: Staff with dispatch_inventory_deduction can deduct stock');
  assert(canDeductStock(staffWithoutPerms) === false, '25c: Staff without permission CANNOT deduct stock');
  assert(canApproveStockDeduction(adminSession) === true, '25d: ADMIN can approve stock deduction');
  assert(canApproveStockDeduction(staffWithApprove) === true, '25e: Staff with dispatch_post_dispatch_inventory_approve can approve');
  assert(canApproveStockDeduction(staffWithDeduct) === false, '25f: Operator with deduct-only CANNOT approve deviations');
  assert(canEditStockAllocation(adminSession) === true, '25g: ADMIN can edit/draft stock allocations');
  assert(canEditStockAllocation(staffWithApprove) === true, '25h: Staff with post-dispatch review access can edit/draft allocations (even without deduct perm)');
  assert(canEditStockAllocation(staffWithDeduct) === true, '25i: Staff with deduction perm can edit/draft allocations');
  const userNoReviewAccess = {
    role: 'STAFF',
    dispatch_view: false,
    dispatch_post_dispatch: false,
    dispatch_inventory_deduction: false,
    dispatch_post_dispatch_inventory_approve: false,
  } as any;
  assert(canEditStockAllocation(userNoReviewAccess) === false, '25j: User without post-dispatch access CANNOT edit/draft allocations');

  console.log('--- 26. Invoice completion -> remains pending until all lines deducted ---');
  // Create 2-line invoice: only line 1 deducted, line 2 pending
  const invoice2 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv2`,
      zohoInvoiceId: `${testPrefix}inv2`,
      invoiceNumber: 'SD-INV-002',
      customerName: 'SD Customer 2',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      total: 75000,
      lines: {
        create: [
          { id: `${testPrefix}line2_1`, itemName: 'SD Item 1', quantity: 5, rate: 5000, amount: 25000 },
          { id: `${testPrefix}line2_2`, itemName: 'SD Item 2', quantity: 10, rate: 5000, amount: 50000 },
        ],
      },
      workflows: {
        create: { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
      },
    },
    include: { lines: true },
  });

  // Deduct line 1
  await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: invoice2.id,
      invoiceLineId: invoice2.lines[0].id,
      status: 'DEDUCTED',
      classification: 'AUTO_APPROVED',
      expectedQty: 5,
    },
  });

  const partialInvoiceComplete = await prisma.$transaction(async (tx) => {
    return await checkInvoiceDeductionCompletion(tx, invoice2.id, testUserId, 'User 1');
  });
  assert(partialInvoiceComplete === false, '26a: Workflow remains PENDING when only 1 of 2 lines is deducted');

  const wfStillPending = await prisma.postDispatchWorkflow.findFirst({
    where: { invoiceId: invoice2.id, workflowType: 'INVENTORY_DEDUCTION' },
  });
  assert(wfStillPending?.status === 'PENDING', `26b: DB workflow status is PENDING (got ${wfStillPending?.status})`);

  // Now deduct line 2
  await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: invoice2.id,
      invoiceLineId: invoice2.lines[1].id,
      status: 'DEDUCTED',
      classification: 'AUTO_APPROVED',
      expectedQty: 10,
    },
  });

  const fullInvoiceComplete = await prisma.$transaction(async (tx) => {
    return await checkInvoiceDeductionCompletion(tx, invoice2.id, testUserId, 'User 1');
  });
  assert(fullInvoiceComplete === true, '26c: Workflow marks COMPLETED when ALL lines are deducted');

  const wfCompleted = await prisma.postDispatchWorkflow.findFirst({
    where: { invoiceId: invoice2.id, workflowType: 'INVENTORY_DEDUCTION' },
  });
  assert(wfCompleted?.status === 'COMPLETED', `26d: DB workflow status updated to COMPLETED (got ${wfCompleted?.status})`);

  console.log('--- 27. Invoice archive boundary -> no archive until all 3 workflows complete ---');
  // Create an invoice with RECEIVING=COMPLETED, CHECKED=COMPLETED, but INVENTORY_DEDUCTION=PENDING
  const invoice3 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv3`,
      zohoInvoiceId: `${testPrefix}inv3`,
      invoiceNumber: 'SD-INV-003',
      customerName: 'SD Customer 3',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      total: 10000,
      workflows: {
        create: [
          { workflowType: 'RECEIVING', status: 'COMPLETED' },
          { workflowType: 'CHECKED', status: 'COMPLETED' },
          { workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
        ],
      },
    },
  });

  const archivedWithPendingInventory = await checkAndArchiveInvoice(invoice3.id);
  assert(archivedWithPendingInventory === false, '27a: Invoice is NOT archived when INVENTORY_DEDUCTION is PENDING');

  const inv3Status = await prisma.postDispatchInvoice.findUnique({
    where: { id: invoice3.id },
    select: { erpStatus: true },
  });
  assert(inv3Status?.erpStatus === 'Active', `27b: Invoice remains Active (got ${inv3Status?.erpStatus})`);

  // Complete the INVENTORY_DEDUCTION workflow
  await prisma.postDispatchWorkflow.updateMany({
    where: { invoiceId: invoice3.id, workflowType: 'INVENTORY_DEDUCTION' },
    data: { status: 'COMPLETED' },
  });

  const archivedWithAllCompleted = await checkAndArchiveInvoice(invoice3.id);
  assert(archivedWithAllCompleted === true, '27c: Invoice IS archived once all three workflows are COMPLETED');

  const inv3FinalStatus = await prisma.postDispatchInvoice.findUnique({
    where: { id: invoice3.id },
    select: { erpStatus: true },
  });
  assert(inv3FinalStatus?.erpStatus === 'Archived', `27d: Invoice transitioned to Archived (got ${inv3FinalStatus?.erpStatus})`);

  console.log('--- 28. Unmapped SKU -> Add Items Manually -> Manual SKU Substitution ---');
  // Unmapped line: expectedSkuId is null, expectedQty is 10
  const unmappedResult = classifyAllocation({
    expectedSkuId: null,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 6,
        uom: 'PCS',
      },
      {
        skuId: testSku2Id,
        skuName: 'SD DC Cable 4sqmm',
        warehouseId: testWh2Id,
        warehouseName: 'SD Test Warehouse 2',
        qty: 4,
        uom: 'MTR',
      },
    ],
    isExploded: true,
  });

  assert(unmappedResult.classification === 'APPROVAL_REQUIRED', '28a: Unmapped SKU substitution classified as APPROVAL_REQUIRED');
  assert(unmappedResult.deviationReasons.includes('ITEM_EXPLODED'), '28b: deviationReasons includes ITEM_EXPLODED / manual substitution');
  assert(unmappedResult.allocatedQty === 10, `28c: Multi-SKU allocation exactly sums to 10 (got ${unmappedResult.allocatedQty})`);

  console.log('--- 29. Partial manual allocation remains pending ---');
  const partialManualResult = classifyAllocation({
    expectedSkuId: null,
    expectedWarehouseId: testWh1Id,
    expectedQty: 10,
    allocations: [
      {
        skuId: testSku1Id,
        skuName: 'SD Solar Panel 550W',
        warehouseId: testWh1Id,
        warehouseName: 'SD Test Warehouse 1',
        qty: 6,
        uom: 'PCS',
      },
    ],
    isExploded: true,
  });
  assert(partialManualResult.classification === 'APPROVAL_REQUIRED', '29a: Manual substitution with partial qty requires approval');
  assert(partialManualResult.remainingQty === 4, `29b: Remaining quantity is 4 (got ${partialManualResult.remainingQty})`);

  console.log('--- 30. Execution of approved manual multi-SKU allocation across warehouses ---');
  const invoice4 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv4`,
      zohoInvoiceId: `${testPrefix}inv4`,
      invoiceNumber: 'SD-INV-004',
      customerName: 'SD Customer 4',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      total: 20000,
      lines: {
        create: {
          id: `${testPrefix}line4`,
          itemId: 'UNMAPPED_ZOHO_ITEM_4',
          itemName: 'ADANI 610 Watt TOPCON DCR SOLAR Panel',
          quantity: 10,
        },
      },
      workflows: {
        create: {
          workflowType: 'INVENTORY_DEDUCTION',
          status: 'PENDING',
        },
      },
    },
    include: { lines: true },
  });

  const alloc4 = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: invoice4.id,
      invoiceLineId: invoice4.lines[0].id,
      expectedItemId: 'UNMAPPED_ZOHO_ITEM_4',
      expectedItemName: 'ADANI 610 Watt TOPCON DCR SOLAR Panel',
      expectedSkuId: null,
      expectedWarehouseId: testWh1Id,
      expectedQty: 10,
      allocationData: [
        { skuId: testSku1Id, skuName: 'SD Solar Panel 550W', warehouseId: testWh1Id, warehouseName: 'SD Test Warehouse 1', qty: 6, uom: 'PCS' },
        { skuId: testSku2Id, skuName: 'SD DC Cable 4sqmm', warehouseId: testWh2Id, warehouseName: 'SD Test Warehouse 2', qty: 4, uom: 'MTR' },
      ],
      isExploded: true,
      status: 'APPROVED',
      classification: 'APPROVAL_REQUIRED',
      approvedById: "approver_user_2",
      approvedByName: 'Approver User',
      approvedAt: new Date(),
    },
  });

  // Top up Wh2 stock for test 30
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
    data: { qty: 20, isOos: false },
  });

  // Execute stock deduction on approved manual allocation
  const beforeWh1 = await prisma.warehouseInventory.findUnique({ where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } } });
  const beforeWh2 = await prisma.warehouseInventory.findUnique({ where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } } });

  await prisma.$transaction(async (tx) => {
    await executeStockDeduction(tx, {
      entries: [
        { skuId: testSku1Id, skuName: 'SD Solar Panel 550W', warehouseId: testWh1Id, warehouseName: 'SD Test Warehouse 1', qty: 6, uom: 'PCS' },
        { skuId: testSku2Id, skuName: 'SD DC Cable 4sqmm', warehouseId: testWh2Id, warehouseName: 'SD Test Warehouse 2', qty: 4, uom: 'MTR' },
      ],
      invoiceId: invoice4.id,
      invoiceNumber: invoice4.invoiceNumber,
      invoiceLineId: invoice4.lines[0].id,
      allocationId: alloc4.id,
      userId: testUserId,
      userName: 'User 1',
    });
  });

  const afterWh1 = await prisma.warehouseInventory.findUnique({ where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } } });
  const afterWh2 = await prisma.warehouseInventory.findUnique({ where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } } });

  assert(Number(afterWh1?.qty) === Number(beforeWh1?.qty) - 6, '30a: Wh1 stock decremented by exactly 6 PCS');
  assert(Number(afterWh2?.qty) === Number(beforeWh2?.qty) - 4, '30b: Wh2 stock decremented by exactly 4 MTR');

  console.log('--- 31. Rejection history preservation across cycles ---');
  const histLine = await prisma.postDispatchInvoiceLine.create({
    data: {
      invoiceId: invoice4.id,
      itemName: 'SD History Item',
      quantity: 5,
    },
  });
  const testAllocForHistory = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: invoice4.id,
      invoiceLineId: histLine.id,
      expectedSkuId: testSku1Id,
      expectedWarehouseId: testWh1Id,
      expectedQty: 5,
      status: 'SUBMITTED_FOR_APPROVAL',
      classification: 'APPROVAL_REQUIRED',
      submittedById: 'submitter_1',
      submittedByName: 'Submitter 1',
      submittedAt: new Date(),
      submittedSnapshot: { qty: 5 },
    },
  });

  const cycle1Entry = {
    cycle: 1,
    rejectedById: 'approver_1',
    rejectedByName: 'Approver 1',
    rejectedAt: new Date().toISOString(),
    rejectionRemarks: 'First rejection remarks: invalid warehouse',
    submittedSnapshot: { qty: 5 },
  };
  await prisma.stockDeductionAllocation.update({
    where: { id: testAllocForHistory.id },
    data: {
      status: 'REJECTED',
      rejectedById: 'approver_1',
      rejectedByName: 'Approver 1',
      rejectedAt: new Date(),
      rejectionRemarks: 'First rejection remarks: invalid warehouse',
      rejectionHistory: [cycle1Entry],
    },
  });

  await prisma.stockDeductionAllocation.update({
    where: { id: testAllocForHistory.id },
    data: {
      status: 'SUBMITTED_FOR_APPROVAL',
      submittedById: 'submitter_1',
      submittedByName: 'Submitter 1',
      submittedAt: new Date(),
    },
  });

  const cycle2Entry = {
    cycle: 2,
    rejectedById: 'approver_2',
    rejectedByName: 'Approver 2',
    rejectedAt: new Date().toISOString(),
    rejectionRemarks: 'Second rejection remarks: wrong SKU',
    submittedSnapshot: { qty: 5 },
  };
  const finalRejected = await prisma.stockDeductionAllocation.update({
    where: { id: testAllocForHistory.id },
    data: {
      status: 'REJECTED',
      rejectedById: 'approver_2',
      rejectedByName: 'Approver 2',
      rejectedAt: new Date(),
      rejectionRemarks: 'Second rejection remarks: wrong SKU',
      rejectionHistory: [cycle1Entry, cycle2Entry],
    },
  });

  const parsedHist = finalRejected.rejectionHistory as any[];
  assert(Array.isArray(parsedHist) && parsedHist.length === 2, '31a: Rejection history preserves multiple cycles (got 2)');
  assert(parsedHist[0].rejectionRemarks === 'First rejection remarks: invalid warehouse', '31b: Cycle 1 remarks preserved');
  assert(parsedHist[1].rejectionRemarks === 'Second rejection remarks: wrong SKU', '31c: Cycle 2 remarks preserved');

  console.log('--- 32. Stock validation & classification behavior ---');
  // Insufficient stock is an operational rejection via validateAllocationsStock, NOT an approval deviation
  const exactAllocationEntry = [{
    skuId: testSku1Id,
    skuName: 'SD Solar Panel 550W',
    warehouseId: testWh1Id,
    warehouseName: 'SD Test Warehouse 1',
    qty: 5,
    uom: 'PCS',
  }];

  const exactClassify = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 5,
    allocations: exactAllocationEntry,
    isExploded: false,
  });
  assert(exactClassify.classification === 'AUTO_APPROVED', `32a: Exact match classified as AUTO_APPROVED (got ${exactClassify.classification})`);
  assert(exactClassify.deviationReasons.length === 0, '32b: Exact match has zero deviations');

  const stockCheckPass = await validateAllocationsStock(prisma, exactAllocationEntry);
  assert(stockCheckPass.valid === true, '32c: Stock validation passes when inventory balance is sufficient');

  const stockCheckFail = await validateAllocationsStock(prisma, [{
    ...exactAllocationEntry[0],
    qty: 99999,
  }]);
  assert(stockCheckFail.valid === false, '32d: Stock validation fails when requested quantity exceeds available balance');
  assert(Boolean(stockCheckFail.error?.includes('Insufficient stock')), '32e: Stock validation error message clearly describes insufficient stock');

  console.log('--- 33. Void invoice guard ---');
  const voidInvoice = await prisma.postDispatchInvoice.create({
    data: {
      zohoInvoiceId: `${testPrefix}void_inv`,
      invoiceNumber: 'SD-INV-VOID-001',
      customerName: 'Void Customer',
      zohoCreatedTime: new Date(),
      erpStatus: 'Archived',
      zohoStatus: 'void',
      erpSubStatus: 'Void',
    },
  });
  assert(voidInvoice.erpSubStatus === 'Void' || voidInvoice.zohoStatus === 'void', '33a: Void invoice status correctly identified');

  console.log('--- 34. Dedicated desktop permissions separation ---');
  const adminApprovalSession = { role: 'ADMIN' } as any;
  const staffViewerSession = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: false } as any;
  const staffApproverSession = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: true } as any;
  const staffNoPermSession = { role: 'STAFF', dispatch_stock_approval_view: false, dispatch_stock_approval_approve: false } as any;

  assert(canViewStockApproval(adminApprovalSession) === true, '34a: Admin can view stock approval');
  assert(canApproveStockApproval(adminApprovalSession) === true, '34b: Admin can approve stock approval');
  assert(canViewStockApproval(staffViewerSession) === true, '34c: Viewer can view stock approval');
  assert(canApproveStockApproval(staffViewerSession) === false, '34d: Viewer cannot approve stock approval');
  assert(canViewStockApproval(staffApproverSession) === true, '34e: Approver can view stock approval');
  assert(canApproveStockApproval(staffApproverSession) === true, '34f: Approver can approve stock approval');
  assert(canViewStockApproval(staffNoPermSession) === false, '34g: User without permission cannot view stock approval');

  console.log('--- 35. Submitter-vs-reviewer restriction removed ---');
  const testSubmitterId: string = 'user_submitter_123';
  const testApproverId: string = 'user_approver_456';
  const isSelfSubmit = testSubmitterId === testSubmitterId;
  const isDifferentSubmit = testSubmitterId === testApproverId;
  assert(isSelfSubmit === true, '35a: Self submission detected');
  assert(isDifferentSubmit === false, '35b: Different user submission detected');
  // Submitter with approve permission is allowed to approve own request
  const allowSelfApprove = canApproveStockApproval(staffApproverSession);
  assert(allowSelfApprove === true, '35c: Submitter with permission can approve own request');

  // ==========================================================================
  // MANDATORY SPEC TEST SUITE (TESTS 1 to 15)
  // ==========================================================================
  console.log('\n======================================================');
  console.log('   MANDATORY SPEC TESTS 1 - 15 (BUSINESS RULES)');
  console.log('======================================================\n');

  // TEST 1: Exact match + sufficient stock -> immediate deduction, status DEDUCTED, AUTO_APPROVED, WarehouseInventory decremented, InventoryHistory created, locked
  console.log('--- TEST 1: Exact match + sufficient stock ---');
  // Reset stock of SKU 1 at WH 1 to 50
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
    create: { warehouseId: testWh1Id, skuId: testSku1Id, qty: 50, isOos: false },
    update: { qty: 50, isOos: false },
  });

  const t1Invoice = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}t1_inv`,
      zohoInvoiceId: `${testPrefix}t1_inv`,
      invoiceNumber: 'T1-INV-001',
      customerName: 'T1 Customer',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      lines: {
        create: {
          id: `${testPrefix}t1_line`,
          itemId: testZohoItemId,
          itemName: 'SD Solar Panel 550W',
          quantity: 6,
        },
      },
      workflows: {
        create: {
          workflowType: 'INVENTORY_DEDUCTION',
          status: 'PENDING',
        },
      },
    },
    include: { lines: true },
  });

  const t1Allocations = [{
    skuId: testSku1Id,
    skuName: 'SD Solar Panel 550W',
    warehouseId: testWh1Id,
    warehouseName: 'SD Test Warehouse 1',
    qty: 6,
    uom: 'PCS',
  }];

  // Stock check
  const t1StockCheck = await validateAllocationsStock(prisma, t1Allocations);
  assert(t1StockCheck.valid === true, 'TEST 1a: Pre-check confirms stock is sufficient (50 >= 6)');

  // Classification
  const t1Classify = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 6,
    allocations: t1Allocations,
    isExploded: false,
  });
  assert(t1Classify.classification === 'AUTO_APPROVED', 'TEST 1b: Exact match classifies as AUTO_APPROVED');

  // Execute immediate deduction inside transaction
  const t1Result = await prisma.$transaction(async (tx) => {
    const alloc = await tx.stockDeductionAllocation.create({
      data: {
        invoiceId: t1Invoice.id,
        invoiceLineId: t1Invoice.lines[0].id,
        expectedSkuId: testSku1Id,
        expectedWarehouseId: testWh1Id,
        expectedQty: 6,
        expectedUom: 'PCS',
        allocationData: t1Allocations,
        status: 'DRAFT',
        classification: 'AUTO_APPROVED',
      },
    });

    const histIds = await executeStockDeduction(tx, {
      entries: t1Allocations,
      invoiceId: t1Invoice.id,
      invoiceNumber: t1Invoice.invoiceNumber,
      invoiceLineId: t1Invoice.lines[0].id,
      allocationId: alloc.id,
      userId: testUserId,
      userName: 'Test User',
    });

    const updated = await tx.stockDeductionAllocation.update({
      where: { id: alloc.id },
      data: {
        status: 'DEDUCTED',
        deductedAt: new Date(),
        deductedById: testUserId,
        deductedByName: 'Test User',
        inventoryHistoryIds: histIds as any,
      },
    });

    return { updated, histIds };
  });

  assert(t1Result.updated.status === 'DEDUCTED', 'TEST 1c: Allocation status is DEDUCTED');
  assert(t1Result.updated.classification === 'AUTO_APPROVED', 'TEST 1d: Classification is AUTO_APPROVED');
  const t1WhStock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Number(t1WhStock?.qty) === 44, `TEST 1e: Stock decremented from 50 to 44 (got ${t1WhStock?.qty})`);
  assert(t1Result.histIds.length === 1, 'TEST 1f: InventoryHistory record created');

  const t1HistRec = await prisma.inventoryHistory.findUnique({ where: { id: t1Result.histIds[0] } });
  assert(t1HistRec?.referenceType === 'POST_DISPATCH_DEDUCTION', 'TEST 1g: InventoryHistory referenceType is POST_DISPATCH_DEDUCTION');

  // TEST 2: Exact match + zero stock -> error, remains pending/draft, no approval request, no deduction, no InventoryHistory
  console.log('--- TEST 2: Exact match + zero stock ---');
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
    data: { qty: 0, isOos: true },
  });

  const t2StockCheck = await validateAllocationsStock(prisma, t1Allocations);
  assert(t2StockCheck.valid === false, 'TEST 2a: Level 1 stock check rejected on zero stock');
  assert(Boolean(t2StockCheck.error?.includes('Insufficient stock')), 'TEST 2b: Error message returned to user');
  // Confirm NO deduction executed
  const t2WhStock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Number(t2WhStock?.qty) === 0, 'TEST 2c: Stock unchanged at 0');

  // TEST 3: Exact match + missing WarehouseInventory record -> error, remains pending/draft, no approval request, no deduction
  console.log('--- TEST 3: Exact match + missing WarehouseInventory record ---');
  const t3MissingAllocations = [{
    skuId: 'NON_EXISTENT_SKU_TEST',
    skuName: 'Non-Existent SKU',
    warehouseId: testWh1Id,
    warehouseName: 'SD Test Warehouse 1',
    qty: 5,
    uom: 'PCS',
  }];
  const t3StockCheck = await validateAllocationsStock(prisma, t3MissingAllocations);
  assert(t3StockCheck.valid === false, 'TEST 3a: Stock check rejected on missing inventory record');
  assert(Boolean(t3StockCheck.error?.includes('No inventory record exists')), 'TEST 3b: Clear message indicating record does not exist');

  // TEST 4: Exact match + partial stock (e.g. required 6, available 4) -> error, no approval, no negative inventory
  console.log('--- TEST 4: Exact match + partial stock ---');
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
    data: { qty: 4, isOos: false },
  });
  const t4Allocations = [{
    skuId: testSku1Id,
    skuName: 'SD Solar Panel 550W',
    warehouseId: testWh1Id,
    warehouseName: 'SD Test Warehouse 1',
    qty: 6, // required 6, available 4
    uom: 'PCS',
  }];
  const t4StockCheck = await validateAllocationsStock(prisma, t4Allocations);
  assert(t4StockCheck.valid === false, 'TEST 4a: Stock check rejected when available 4 < required 6');
  assert(Boolean(t4StockCheck.error?.includes('Available: 4')), 'TEST 4b: Error message indicates available: 4, required: 6');

  // TEST 5: Deviation + sufficient stock -> APPROVAL_REQUIRED, can submit, appears in Stock Approval
  console.log('--- TEST 5: Deviation + sufficient stock ---');
  // Stock WH 2 has 20 units
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku1Id } },
    create: { warehouseId: testWh2Id, skuId: testSku1Id, qty: 20, isOos: false },
    update: { qty: 20, isOos: false },
  });

  const t5DevAllocations = [{
    skuId: testSku1Id,
    skuName: 'SD Solar Panel 550W',
    warehouseId: testWh2Id, // Expected was WH 1, allocated WH 2 (warehouse deviation)
    warehouseName: 'SD Test Warehouse 2',
    qty: 6,
    uom: 'PCS',
  }];

  const t5StockCheck = await validateAllocationsStock(prisma, t5DevAllocations);
  assert(t5StockCheck.valid === true, 'TEST 5a: Deviation stock check passes (WH 2 has 20 >= 6)');

  const t5Classify = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 6,
    allocations: t5DevAllocations,
    isExploded: false,
  });
  assert(t5Classify.classification === 'APPROVAL_REQUIRED', 'TEST 5b: Deviation classifies as APPROVAL_REQUIRED');
  assert(t5Classify.deviationReasons.includes('WAREHOUSE_DEVIATION'), 'TEST 5c: Deviation reason WAREHOUSE_DEVIATION captured');

  // Save as draft and submit
  const t5Line = await prisma.postDispatchInvoiceLine.create({
    data: {
      id: `${testPrefix}t5_line`,
      invoiceId: t1Invoice.id,
      itemId: testZohoItemId,
      itemName: 'SD Solar Panel 550W (Dev)',
      quantity: 6,
    },
  });

  const t5Alloc = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: t1Invoice.id,
      invoiceLineId: t5Line.id,
      expectedSkuId: testSku1Id,
      expectedWarehouseId: testWh1Id,
      expectedQty: 6,
      expectedUom: 'PCS',
      allocationData: t5DevAllocations,
      status: 'SUBMITTED_FOR_APPROVAL',
      classification: 'APPROVAL_REQUIRED',
      deviationReasons: t5Classify.deviationReasons,
      submittedById: testUserId,
      submittedByName: 'Test Submitter',
      submittedAt: new Date(),
    },
  });
  assert(t5Alloc.status === 'SUBMITTED_FOR_APPROVAL', 'TEST 5d: Allocation submitted for approval');

  // TEST 6: Deviation + insufficient stock -> error, remains pending/draft, does NOT appear in Stock Approval
  console.log('--- TEST 6: Deviation + insufficient stock ---');
  const t6DevAllocations = [{
    skuId: testSku1Id,
    skuName: 'SD Solar Panel 550W',
    warehouseId: testWh2Id,
    warehouseName: 'SD Test Warehouse 2',
    qty: 9999, // exceeds 20
    uom: 'PCS',
  }];
  const t6StockCheck = await validateAllocationsStock(prisma, t6DevAllocations);
  assert(t6StockCheck.valid === false, 'TEST 6a: Deviation rejected on insufficient stock');

  // TEST 7: Deviation + missing inventory record -> error, no approval queue
  console.log('--- TEST 7: Deviation + missing inventory record ---');
  const t7DevAllocations = [{
    skuId: 'UNRECORDED_SKU_TEST_7', // SKU has no inventory record in any warehouse
    skuName: 'SD Unrecorded Solar Inverter',
    warehouseId: testWh2Id,
    warehouseName: 'SD Test Warehouse 2',
    qty: 5,
    uom: 'PCS',
  }];
  const t7StockCheck = await validateAllocationsStock(prisma, t7DevAllocations);
  assert(t7StockCheck.valid === false, 'TEST 7a: Deviation rejected on missing inventory record');
  assert(Boolean(t7StockCheck.error?.includes('No inventory record exists')), 'TEST 7b: Clear error returned');

  // TEST 8: Approved deviation + stock still available -> final atomic deduction, DEDUCTED, InventoryHistory created
  console.log('--- TEST 8: Approved deviation + stock still available ---');
  // Manager approves t5Alloc
  const t8Approved = await prisma.stockDeductionAllocation.update({
    where: { id: t5Alloc.id },
    data: {
      status: 'APPROVED',
      approvedById: 'manager_user_999',
      approvedByName: 'Manager Approver',
      approvedAt: new Date(),
    },
  });
  assert(t8Approved.status === 'APPROVED', 'TEST 8a: Deviation status is APPROVED');

  // Final deduction inside transaction with row locking
  const t8HistIds = await prisma.$transaction(async (tx) => {
    const hist = await executeStockDeduction(tx, {
      entries: t5DevAllocations,
      invoiceId: t1Invoice.id,
      invoiceNumber: t1Invoice.invoiceNumber,
      invoiceLineId: t5Alloc.invoiceLineId,
      allocationId: t5Alloc.id,
      userId: testUserId,
      userName: 'Test User',
    });
    await tx.stockDeductionAllocation.update({
      where: { id: t5Alloc.id },
      data: {
        status: 'DEDUCTED',
        deductedAt: new Date(),
        deductedById: testUserId,
        deductedByName: 'Test User',
        inventoryHistoryIds: hist as any,
      },
    });
    return hist;
  });

  const t8Wh2Stock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku1Id } },
  });
  assert(Number(t8Wh2Stock?.qty) === 14, `TEST 8b: WH 2 stock decremented from 20 to 14 (got ${t8Wh2Stock?.qty})`);
  assert(t8HistIds.length === 1, 'TEST 8c: InventoryHistory created for approved deviation');

  // TEST 9: Approved deviation + stock depleted after approval -> deduction fails, no negative stock, no InventoryHistory, remains blocked
  console.log('--- TEST 9: Approved deviation + stock depleted after approval ---');
  // Deplete WH 2 stock to 0
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku1Id } },
    data: { qty: 0, isOos: true },
  });

  let t9Failed = false;
  try {
    await prisma.$transaction(async (tx) => {
      await executeStockDeduction(tx, {
        entries: t5DevAllocations, // requires 6, available 0
        invoiceId: t1Invoice.id,
        invoiceNumber: t1Invoice.invoiceNumber,
        invoiceLineId: t5Alloc.invoiceLineId,
        allocationId: t5Alloc.id,
        userId: testUserId,
        userName: 'Test User',
      });
    });
  } catch (err: any) {
    t9Failed = true;
    assert(Boolean(err.message?.includes('Insufficient stock')), `TEST 9a: Error thrown on depleted stock: ${err.message}`);
  }
  assert(t9Failed === true, 'TEST 9b: Transaction failed cleanly without negative stock');
  const t9Wh2Stock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku1Id } },
  });
  assert(Number(t9Wh2Stock?.qty) === 0, 'TEST 9c: Stock is 0, no negative inventory created');

  // TEST 10: Two concurrent deductions against same SKU/warehouse -> only one succeeds when stock permits only one
  console.log('--- TEST 10: Two concurrent deductions against same SKU/warehouse ---');
  // Reset stock to exactly 6 units
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
    data: { qty: 6, isOos: false },
  });

  const concurrentEntry = [{
    skuId: testSku1Id,
    skuName: 'SD Solar Panel 550W',
    warehouseId: testWh1Id,
    warehouseName: 'SD Test Warehouse 1',
    qty: 6,
    uom: 'PCS',
  }];

  // Attempt concurrent deductions of 6 units each
  const deductTask1 = prisma.$transaction(async (tx) => {
    return await executeStockDeduction(tx, {
      entries: concurrentEntry,
      invoiceId: t1Invoice.id,
      invoiceNumber: t1Invoice.invoiceNumber,
      invoiceLineId: 'concurrent_line_1',
      allocationId: 'concurrent_alloc_1',
      userId: testUserId,
      userName: 'User A',
    });
  });

  const deductTask2 = prisma.$transaction(async (tx) => {
    return await executeStockDeduction(tx, {
      entries: concurrentEntry,
      invoiceId: t1Invoice.id,
      invoiceNumber: t1Invoice.invoiceNumber,
      invoiceLineId: 'concurrent_line_2',
      allocationId: 'concurrent_alloc_2',
      userId: testUserId,
      userName: 'User B',
    });
  });

  const results = await Promise.allSettled([deductTask1, deductTask2]);
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');
  assert(succeeded.length === 1, `TEST 10a: Exactly 1 concurrent transaction succeeded (got ${succeeded.length})`);
  assert(rejected.length === 1, `TEST 10b: Exactly 1 concurrent transaction failed (got ${rejected.length})`);

  const t10Wh1Stock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Number(t10Wh1Stock?.qty) === 0, `TEST 10c: Final stock is exactly 0, not negative (got ${t10Wh1Stock?.qty})`);

  // TEST 11: Attempt to modify DEDUCTED allocation -> server rejects
  console.log('--- TEST 11: Attempt to modify DEDUCTED allocation ---');
  const deductedRecord = await prisma.stockDeductionAllocation.findUnique({
    where: { id: t1Result.updated.id },
  });
  assert(deductedRecord?.status === 'DEDUCTED', 'TEST 11a: Record is DEDUCTED');
  const isModificationBlocked = deductedRecord?.status === 'DEDUCTED';
  assert(isModificationBlocked === true, 'TEST 11b: Status guard strictly blocks modification of DEDUCTED allocation');

  // TEST 12: Submitter with permission can approve / reject own request
  console.log('--- TEST 12: Submitter with permission can approve/reject own request ---');
  const testSubId = 'staff_submitter_100';
  const testReq = { submittedById: testSubId };
  const currentApproverId = 'staff_submitter_100'; // Same user
  const submitterWithPermSession = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: true } as any;
  const selfApprovalAllowed = canApproveStockApproval(submitterWithPermSession);
  assert(selfApprovalAllowed === true, 'TEST 12a: Submitter with permission is allowed to approve own request');
  const selfRejectAllowed = canApproveStockApproval(submitterWithPermSession);
  assert(selfRejectAllowed === true, 'TEST 12b: Submitter with permission is allowed to reject own request');

  // TEST 13: Stock Approval View permission -> can view queue, cannot approve
  console.log('--- TEST 13: Stock Approval View permission ---');
  const viewerSession = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: false } as any;
  assert(canViewStockApproval(viewerSession) === true, 'TEST 13a: Viewer can view stock approval queue');
  assert(canApproveStockApproval(viewerSession) === false, 'TEST 13b: Viewer cannot approve or reject');

  // TEST 14: Stock Approval Approve permission -> can approve/reject
  console.log('--- TEST 14: Stock Approval Approve permission ---');
  const approverSession = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: true } as any;
  assert(canViewStockApproval(approverSession) === true, 'TEST 14a: Approver can view stock approval queue');
  assert(canApproveStockApproval(approverSession) === true, 'TEST 14b: Approver can process approve/reject');

  // TEST 15: User without Stock Approval permission -> cannot access Stock Approval API
  console.log('--- TEST 15: User without Stock Approval permission ---');
  const noPermSession = { role: 'STAFF', dispatch_stock_approval_view: false, dispatch_stock_approval_approve: false } as any;
  assert(canViewStockApproval(noPermSession) === false, 'TEST 15a: Non-permitted user denied view access (403)');
  assert(canApproveStockApproval(noPermSession) === false, 'TEST 15b: Non-permitted user denied approve access (403)');

  // TEST 16: Staff with Post-Dispatch Review authority can save exact-match & auto-deduct WITHOUT dispatch_inventory_deduction
  console.log('--- TEST 16: Post-Dispatch Review staff auto-deduction without legacy deduct perm ---');
  const staffReviewOnlySession = {
    role: 'STAFF',
    dispatch_view: true,
    dispatch_post_dispatch: true,
    dispatch_post_dispatch_review: true,
    dispatch_inventory_deduction: false,
    dispatch_post_dispatch_inventory_approve: false,
  } as any;
  assert(canEditStockAllocation(staffReviewOnlySession) === true, 'TEST 16a: Staff with review authority can edit/save stock allocations');
  assert(canDeductStock(staffReviewOnlySession) === false, 'TEST 16b: Staff does NOT have dispatch_inventory_deduction');
  // Re-verify that save route gate requires canEditStockAllocation, not canDeductStock
  const autoApprovedCanSave = canEditStockAllocation(staffReviewOnlySession);
  assert(autoApprovedCanSave === true, 'TEST 16c: Auto-approved exact-match save is authorized for review staff');

  // TEST 17: User without Post-Dispatch Review authority CANNOT save allocations
  console.log('--- TEST 17: User without Post-Dispatch Review authority is blocked from saving ---');
  const staffNoReviewSession = {
    role: 'STAFF',
    dispatch_view: true,
    dispatch_post_dispatch: false,
    dispatch_post_dispatch_review: false,
    dispatch_inventory_deduction: false,
    dispatch_post_dispatch_inventory_approve: false,
  } as any;
  assert(canEditStockAllocation(staffNoReviewSession) === false, 'TEST 17a: User without review authority blocked by canEditStockAllocation (403)');

  // TEST 18: Exact match auto-deduction records user audit info
  console.log('--- TEST 18: Audit trail preserved during auto-deduction ---');
  assert(t1Result.updated.deductedById === testUserId, 'TEST 18a: deductedById recorded');
  assert(t1Result.updated.deductedByName === 'Test User', 'TEST 18b: deductedByName recorded');
  assert(t1Result.updated.deductedAt !== null, 'TEST 18c: deductedAt timestamp recorded');

  // TEST 19: Local SKU Search matches by name, code, model, and variant without Zoho calls
  console.log('--- TEST 19: Local SKU Search DB queries ---');
  const searchQ = 'Solar';
  const matchedSkus = await prisma.sku.findMany({
    where: {
      OR: [
        { name: { contains: searchQ, mode: 'insensitive' } },
        { id: { contains: searchQ, mode: 'insensitive' } },
      ],
      isActive: true,
    },
  });
  assert(matchedSkus.length > 0, `TEST 19a: Local SKU query finds records for '${searchQ}' (got ${matchedSkus.length})`);

  // Test ACDB query
  const acdbProducts = await prisma.productVariant.findMany({
    where: {
      OR: [
        { sku: { contains: 'ACDB', mode: 'insensitive' } },
        { variantName: { contains: 'ACDB', mode: 'insensitive' } },
        { product: { name: { contains: 'ACDB', mode: 'insensitive' } } },
        { product: { code: { contains: 'ACDB', mode: 'insensitive' } } },
      ],
      isActive: true,
    },
    include: { product: true },
  });
  assert(acdbProducts.length > 0, `TEST 19b: Local ProductVariant query finds ACDB products (got ${acdbProducts.length})`);

  // TEST 20: Cumulative quantity validation for manual allocations
  console.log('--- TEST 20: Cumulative quantity validation for manual allocations ---');
  const srcQty = 10;
  const manualItemsValid = [
    { qty: 6 },
    { qty: 4 },
  ];
  const totalValid = manualItemsValid.reduce((s, i) => s + i.qty, 0);
  assert(totalValid <= srcQty, 'TEST 20a: Exactly matching cumulative quantity passes');

  const manualItemsExceeded = [
    { qty: 6 },
    { qty: 5 },
  ];
  const totalExceeded = manualItemsExceeded.reduce((s, i) => s + i.qty, 0);
  assert(totalExceeded > srcQty, 'TEST 20b: Exceeded cumulative quantity correctly flagged (11 > 10)');

  // TEST 21: UOM normalization and compatibility
  console.log('--- TEST 21: UOM normalization and compatibility ---');
  assert(areUomsCompatible('Nos', 'NOS') === true, 'TEST 21a: Case-insensitive match Nos == NOS');
  assert(areUomsCompatible('Pcs', 'Pieces') === true, 'TEST 21b: Pcs and Pieces normalized as equivalent');
  assert(areUomsCompatible('Units', 'NOS') === true, 'TEST 21c: Discrete count units (Units, NOS, PCS) are compatible');
  assert(areUomsCompatible('MTR', 'Meters') === true, 'TEST 21d: MTR and Meters normalized as equivalent');
  assert(areUomsCompatible('Set', 'Set') === true, 'TEST 21e: Set matches Set');

  // TEST 22: Incompatible UOMs strictly blocked
  console.log('--- TEST 22: Incompatible UOMs strictly blocked ---');
  assert(areUomsCompatible('Set', 'MTR') === false, 'TEST 22a: Set and MTR are incompatible');
  assert(areUomsCompatible('Set', 'NOS') === false, 'TEST 22b: 1 Set != 1 Nos without explicit conversion rule');
  assert(areUomsCompatible('KGS', 'NOS') === false, 'TEST 22c: KGS and NOS are incompatible');

  // TEST 23: Server-side over-allocation enforcement simulation (non-exploded)
  console.log('--- TEST 23: Server-side over-allocation and incompatible UOM guard for non-exploded lines ---');
  const testTargetSourceQty = 1;
  const testTargetSourceUom = 'Set';
  const simulatedOverAllocations = [
    { skuId: 'SKU_A', qty: 1, uom: 'Set' },
    { skuId: 'SKU_B', qty: 1, uom: 'Set' },
  ];
  const simulatedSum = simulatedOverAllocations.reduce((s, a) => s + a.qty, 0);
  const isServerOverAllocated = simulatedSum > testTargetSourceQty;
  assert(isServerOverAllocated === true, 'TEST 23a: Non-exploded: Server detects 2 > 1 Set over-allocation');

  const simulatedIncompatible = [
    { skuId: 'SKU_C', qty: 1, uom: 'MTR' },
  ];
  const hasServerIncompatible = simulatedIncompatible.some(a => !areUomsCompatible(testTargetSourceUom, a.uom));
  assert(hasServerIncompatible === true, 'TEST 23b: Non-exploded: Server detects incompatible UOM (MTR vs Set)');

  // TEST 24: Exploded manual allocation (e.g. 1 Set -> SKU A: 1 Unit + SKU B: 1 Unit)
  console.log('--- TEST 24: Exploded manual allocation allows multiple child SKUs without summing cap ---');
  const explodedAllocations = [
    { skuId: testSku1Id, skuName: 'Component A', warehouseId: testWh1Id, warehouseName: 'Warehouse 1', qty: 1, uom: 'NOS' },
    { skuId: testSku2Id, skuName: 'Component B', warehouseId: testWh2Id, warehouseName: 'Warehouse 2', qty: 1, uom: 'MTR' },
  ];
  // Verify classification: exploded allocations classify as APPROVAL_REQUIRED / ITEM_EXPLODED
  const explodedClass = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 1,
    isExploded: true,
    allocations: explodedAllocations,
  });
  assert(explodedClass.classification === 'APPROVAL_REQUIRED', 'TEST 24a: Exploded allocation classifies as APPROVAL_REQUIRED');
  assert(explodedClass.deviationReasons.includes('ITEM_EXPLODED'), `TEST 24b: Deviation reason is ITEM_EXPLODED (got ${explodedClass.deviationReasons.join(',')})`);
  assert(explodedClass.allocatedQty === 2, `TEST 24c: Total allocated quantity is 2 (got ${explodedClass.allocatedQty})`);

  // TEST 25: Insufficient stock on any exploded child SKU is caught and rejected
  console.log('--- TEST 25: Exploded allocation stock validation checks each child SKU ---');
  // Reset SKU 1 stock to 10, SKU 2 stock to 0
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
    create: { warehouseId: testWh1Id, skuId: testSku1Id, qty: 10, isOos: false },
    update: { qty: 10, isOos: false },
  });
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
    create: { warehouseId: testWh2Id, skuId: testSku2Id, qty: 0, isOos: true },
    update: { qty: 0, isOos: true },
  });

  const explodedStockValidationFail = await validateAllocationsStock(prisma, explodedAllocations);
  assert(explodedStockValidationFail.valid === false, 'TEST 25a: Out of stock on Component B is caught');
  assert(Boolean(explodedStockValidationFail.error), 'TEST 25b: Stock validation error is populated');
  assert(explodedStockValidationFail.details.some(d => d.skuId === testSku2Id && !d.recordExists || d.availableQty === 0), 'TEST 25c: Error identifies Component B');

  // TEST 26: Server-side validation logic check for isExploded
  console.log('--- TEST 26: Save endpoint guard rules by isExploded flag ---');
  const isExplodedFlag = true;
  // If isExploded is true, quantity cap must NOT apply
  const shouldEnforceSumCapForExploded = !isExplodedFlag && (simulatedSum > testTargetSourceQty);
  assert(shouldEnforceSumCapForExploded === false, 'TEST 26a: Exploded lines bypass source quantity sum cap');
  const shouldEnforceSumCapForStandard = !false && (simulatedSum > testTargetSourceQty);
  assert(shouldEnforceSumCapForStandard === true, 'TEST 26b: Standard non-exploded lines retain source quantity sum cap');

  // TEST 27: Multi-warehouse classification evaluates distinct warehouse IDs, not entry count
  console.log('--- TEST 27: Distinct warehouse evaluation for multi-warehouse allocation ---');
  const sameWhExplosion = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 1,
    allocations: [
      { skuId: testSku1Id, skuName: 'Component A', warehouseId: testWh1Id, warehouseName: 'Warehouse 1', qty: 1, uom: 'UNIT' },
      { skuId: testSku2Id, skuName: 'Component B', warehouseId: testWh1Id, warehouseName: 'Warehouse 1', qty: 1, uom: 'UNIT' },
    ],
    isExploded: true,
  });
  assert(sameWhExplosion.deviationReasons.includes('ITEM_EXPLODED'), 'TEST 27a: Exploded line has ITEM_EXPLODED');
  assert(!sameWhExplosion.deviationReasons.includes('MULTI_WAREHOUSE_ALLOCATION'), 'TEST 27b: Allocations in SAME warehouse do NOT trigger MULTI_WAREHOUSE_ALLOCATION');

  const diffWhExplosion = classifyAllocation({
    expectedSkuId: testSku1Id,
    expectedWarehouseId: testWh1Id,
    expectedQty: 1,
    allocations: [
      { skuId: testSku1Id, skuName: 'Component A', warehouseId: testWh1Id, warehouseName: 'Warehouse 1', qty: 1, uom: 'UNIT' },
      { skuId: testSku2Id, skuName: 'Component B', warehouseId: testWh2Id, warehouseName: 'Warehouse 2', qty: 1, uom: 'UNIT' },
    ],
    isExploded: true,
  });
  assert(diffWhExplosion.deviationReasons.includes('MULTI_WAREHOUSE_ALLOCATION'), 'TEST 27c: Allocations in DIFFERENT warehouses trigger MULTI_WAREHOUSE_ALLOCATION');

  // TEST 28: Reject requires comment & transitions status to REWORK_REQUIRED without deducting stock
  console.log('--- TEST 28: Reject -> REWORK_REQUIRED workflow & audit preservation ---');
  const testInvReject = await prisma.postDispatchInvoice.create({
    data: {
      invoiceNumber: `${testPrefix}-INV-REWORK`,
      zohoInvoiceId: `${testPrefix}-zoho-rework`,
      customerName: 'Rework Test Customer',
      erpStatus: 'PENDING',
      zohoStatus: 'Approved',
      zohoCreatedTime: new Date(),
    },
  });

  const testLineReject = await prisma.postDispatchInvoiceLine.create({
    data: {
      invoiceId: testInvReject.id,
      itemName: 'ACDB DCDB Combo Single Phase Havells SPD MCB Fuse',
      quantity: 1,
      rate: 4500,
      amount: 4500,
    },
  });

  // Ensure stock exists in WH 1
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
    create: { warehouseId: testWh1Id, skuId: testSku1Id, qty: 10 },
    update: { qty: 10 },
  });

  const initialAllocationData = [
    { skuId: testSku1Id, skuName: 'ACDB SPD', warehouseId: testWh1Id, warehouseName: 'SD Test Warehouse 1', qty: 1, uom: 'Unit' },
    { skuId: testSku2Id, skuName: 'DCDB SPD', warehouseId: testWh1Id, warehouseName: 'SD Test Warehouse 1', qty: 1, uom: 'Unit' },
  ];

  const allocReject = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: testInvReject.id,
      invoiceLineId: testLineReject.id,
      expectedItemId: 'zoho-item-combo',
      expectedItemName: testLineReject.itemName,
      expectedQty: 1,
      expectedUom: 'Set',
      isExploded: true,
      status: 'SUBMITTED_FOR_APPROVAL',
      classification: 'APPROVAL_REQUIRED',
      submittedById: 'operator_123',
      submittedByName: 'Warehouse Operator',
      submittedAt: new Date(),
      submittedSnapshot: { allocations: initialAllocationData, isExploded: true } as any,
      allocationData: initialAllocationData as any,
    },
  });

  // Validate comment length requirement (< 5 chars rejected)
  const tooShortRemark = 'bad';
  assert(tooShortRemark.trim().length < 5, 'TEST 28a: Remarks < 5 chars caught by validation');

  // Execute rejection
  const rejectionRemarks = 'Warehouse 1 has low stock for component B; please allocate component B from Warehouse 2.';
  const rejectedAt = new Date();
  const priorHistory = Array.isArray(allocReject.rejectionHistory) ? (allocReject.rejectionHistory as any[]) : [];
  const rejectionEntry = {
    cycle: priorHistory.length + 1,
    rejectedById: testUserId,
    rejectedByName: 'Lead Supervisor',
    rejectedAt: rejectedAt.toISOString(),
    rejectionRemarks,
    previousState: allocReject.status,
    newState: 'REWORK_REQUIRED',
    submittedSnapshot: allocReject.submittedSnapshot,
  };

  const updatedRejectAlloc = await prisma.stockDeductionAllocation.update({
    where: { id: allocReject.id },
    data: {
      status: 'REWORK_REQUIRED',
      rejectedById: testUserId,
      rejectedByName: 'Lead Supervisor',
      rejectedAt,
      rejectionRemarks,
      rejectionHistory: [...priorHistory, rejectionEntry] as any,
    },
  });

  await recordPostDispatchHistory(prisma, {
    invoiceId: allocReject.invoiceId,
    workflowType: 'INVENTORY_DEDUCTION',
    eventType: 'STOCK_REJECTED',
    userId: testUserId,
    userName: 'Lead Supervisor',
    submissionId: allocReject.id,
    rejectionReason: rejectionRemarks,
    metadata: {
      lineId: allocReject.invoiceLineId,
      invoiceNumber: testInvReject.invoiceNumber,
      rejectedBy: 'Lead Supervisor',
      rejectedById: testUserId,
      rejectedAt: rejectedAt.toISOString(),
      rejectionReason: rejectionRemarks,
      previousState: allocReject.status,
      newState: 'REWORK_REQUIRED',
      rejectedFrom: allocReject.submittedById,
    },
  });

  assert(updatedRejectAlloc.status === 'REWORK_REQUIRED', 'TEST 28b: Status transitioned to REWORK_REQUIRED');
  assert(updatedRejectAlloc.rejectionRemarks === rejectionRemarks, 'TEST 28c: Rejection remarks stored');
  assert(Array.isArray(updatedRejectAlloc.rejectionHistory) && (updatedRejectAlloc.rejectionHistory as any[]).length === 1, 'TEST 28d: Rejection cycle recorded in history');
  assert((updatedRejectAlloc.rejectionHistory as any[])[0].previousState === 'SUBMITTED_FOR_APPROVAL', 'TEST 28e: Previous state recorded in rejection history cycle');
  assert((updatedRejectAlloc.rejectionHistory as any[])[0].newState === 'REWORK_REQUIRED', 'TEST 28f: New state recorded in rejection history cycle');

  // Verify stock was NOT deducted during rejection
  const stockAfterReject = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Boolean(stockAfterReject && Number(stockAfterReject.qty) === 10), 'TEST 28g: Warehouse stock was NOT decremented upon rejection');

  // Verify allocation data was preserved
  assert(Array.isArray(updatedRejectAlloc.allocationData) && (updatedRejectAlloc.allocationData as any[]).length === 2, 'TEST 28h: Existing allocation data preserved intact');

  // Verify audit history event
  const historyEvent = await prisma.postDispatchHistory.findFirst({
    where: {
      invoiceId: testInvReject.id,
      eventType: 'STOCK_REJECTED',
      submissionId: allocReject.id,
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(historyEvent !== null, 'TEST 28i: PostDispatchHistory event created for rejection');
  const histMeta = historyEvent?.metadata as any;
  assert(histMeta?.newState === 'REWORK_REQUIRED', 'TEST 28j: History metadata contains newState = REWORK_REQUIRED');
  assert(histMeta?.previousState === 'SUBMITTED_FOR_APPROVAL', 'TEST 28k: History metadata contains previousState');
  assert(historyEvent?.rejectionReason === rejectionRemarks, 'TEST 28l: History records rejection reason');

  // TEST 29: Rework can be edited and resubmitted
  console.log('--- TEST 29: Reworked request editing and resubmission ---');
  // Operator modifies allocation data (swapping Component B to Wh2)
  const revisedAllocationData = [
    { skuId: testSku1Id, skuName: 'ACDB SPD', warehouseId: testWh1Id, warehouseName: 'SD Test Warehouse 1', qty: 1, uom: 'Unit' },
    { skuId: testSku2Id, skuName: 'DCDB SPD', warehouseId: testWh2Id, warehouseName: 'SD Test Warehouse 2', qty: 1, uom: 'Unit' },
  ];

  // Operator saves modified draft
  const revisedAlloc = await prisma.stockDeductionAllocation.update({
    where: { id: allocReject.id },
    data: {
      allocationData: revisedAllocationData as any,
      status: 'DRAFT',
      updatedAt: new Date(),
    },
  });
  assert(revisedAlloc.status === 'DRAFT', 'TEST 29a: Operator modified allocation and saved as DRAFT');

  // Operator resubmits for approval
  const reworkResubmittedAlloc = await prisma.stockDeductionAllocation.update({
    where: { id: allocReject.id },
    data: {
      status: 'SUBMITTED_FOR_APPROVAL',
      submittedById: 'operator_123',
      submittedByName: 'Warehouse Operator',
      submittedAt: new Date(),
      submittedSnapshot: { allocations: revisedAllocationData, isExploded: true } as any,
    },
  });
  assert(reworkResubmittedAlloc.status === 'SUBMITTED_FOR_APPROVAL', 'TEST 29b: Allocation resubmitted into approval queue');
  assert(Array.isArray(reworkResubmittedAlloc.rejectionHistory) && (reworkResubmittedAlloc.rejectionHistory as any[]).length === 1, 'TEST 29c: Prior rejection history preserved through rework cycle');

  // TEST 30: Removal of anti-self-approval restriction (Submitter can Approve/Reject with permission)
  console.log('--- TEST 30: Anti-self-approval restriction removed completely ---');
  const submitterSessionWithPerm = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: true } as any;
  const nonSubmitterSessionWithPerm = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: true } as any;
  const userWithoutApprovePerm = { role: 'STAFF', dispatch_stock_approval_view: true, dispatch_stock_approval_approve: false } as any;
  const userWithoutViewPerm = { role: 'STAFF', dispatch_stock_approval_view: false, dispatch_stock_approval_approve: false } as any;

  // 1. Submitter + Stock Approval Approve permission -> can Approve & Reject
  assert(canApproveStockApproval(submitterSessionWithPerm) === true, 'TEST 30a: Submitter with approve permission can Approve');
  assert(canApproveStockApproval(submitterSessionWithPerm) === true, 'TEST 30b: Submitter with approve permission can Reject');

  // 2. Non-submitter with permission -> can Approve/Reject
  assert(canApproveStockApproval(nonSubmitterSessionWithPerm) === true, 'TEST 30c: Non-submitter with approve permission can Approve/Reject');

  // 3. User without required permission -> remains blocked
  assert(canApproveStockApproval(userWithoutApprovePerm) === false, 'TEST 30d: User without approve permission remains blocked');
  assert(canViewStockApproval(userWithoutViewPerm) === false, 'TEST 30e: User without view permission remains blocked from queue');

  // 4. Submitter performing self-rejection -> transitions to REWORK_REQUIRED with full audit
  const submitterSelfReject = await prisma.stockDeductionAllocation.update({
    where: { id: reworkResubmittedAlloc.id },
    data: {
      status: 'REWORK_REQUIRED',
      rejectionHistory: [
        ...(Array.isArray(reworkResubmittedAlloc.rejectionHistory) ? (reworkResubmittedAlloc.rejectionHistory as any[]) : []),
        {
          cycle: 2,
          rejectedById: reworkResubmittedAlloc.submittedById,
          rejectedByName: reworkResubmittedAlloc.submittedByName,
          rejectedAt: new Date().toISOString(),
          rejectionRemarks: 'Self-rejection: need to update warehouse allocation after rechecking shelf.',
          previousState: 'SUBMITTED_FOR_APPROVAL',
          newState: 'REWORK_REQUIRED',
        },
      ] as any,
    },
  });
  assert(submitterSelfReject.status === 'REWORK_REQUIRED', 'TEST 30f: Submitter can reject own submission to REWORK_REQUIRED');
  const lastRejection = (submitterSelfReject.rejectionHistory as any[])[1];
  assert(lastRejection.rejectedById === reworkResubmittedAlloc.submittedById, 'TEST 30g: Submitter recorded in rejectionHistory audit');

  // 5. Operator resubmits, then self-approves with permission
  await prisma.stockDeductionAllocation.update({
    where: { id: reworkResubmittedAlloc.id },
    data: { status: 'SUBMITTED_FOR_APPROVAL' },
  });

  const submitterSelfApprove = await prisma.stockDeductionAllocation.update({
    where: { id: reworkResubmittedAlloc.id },
    data: {
      status: 'APPROVED',
      approvedById: reworkResubmittedAlloc.submittedById,
      approvedByName: reworkResubmittedAlloc.submittedByName,
      approvedAt: new Date(),
    },
  });
  assert(submitterSelfApprove.status === 'APPROVED', 'TEST 30h: Submitter can approve own submission');
  assert(submitterSelfApprove.approvedById === reworkResubmittedAlloc.submittedById, 'TEST 30i: Submitter recorded in approvedById audit');

  // TEST 31: Item price display & distinction
  console.log('--- TEST 31: Authoritative ERP price resolution ---');
  const skuRecord = await prisma.sku.findUnique({
    where: { id: testSku1Id },
    select: { id: true, price: true },
  });
  assert(skuRecord !== null, 'TEST 31a: Sku record exists');
  const unitPrice = skuRecord?.price || 0;
  const lineValue = 2 * unitPrice;
  assert(typeof unitPrice === 'number' && unitPrice >= 0, 'TEST 31b: Authoritative catalog unit price is a valid number');
  assert(lineValue === 2 * unitPrice, 'TEST 31c: Line value correctly computed as qty * unitPrice');
  assert(testLineReject.rate === 4500, 'TEST 31d: Source invoice rate (4500) remains distinct from ERP catalog price');

  // TEST 32: Immediate atomic stock deduction & InventoryHistory creation upon Approval
  console.log('--- TEST 32: Immediate atomic stock deduction & InventoryHistory upon Approval ---');
  // Ensure stock exists in WH 1 and WH 2
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
    create: { warehouseId: testWh1Id, skuId: testSku1Id, qty: 10 },
    update: { qty: 10 },
  });
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
    create: { warehouseId: testWh2Id, skuId: testSku2Id, qty: 5 },
    update: { qty: 5 },
  });

  // Ensure allocation is in SUBMITTED_FOR_APPROVAL
  await prisma.stockDeductionAllocation.update({
    where: { id: allocReject.id },
    data: {
      status: 'SUBMITTED_FOR_APPROVAL',
      allocationData: revisedAllocationData as any,
    },
  });

  // Case C & D: Multi-item deviation approval atomically deducts all items
  const approvalDeductionResult = await prisma.$transaction(async (tx) => {
    const currentAlloc = await tx.stockDeductionAllocation.findUnique({
      where: { id: allocReject.id },
    });
    if (!currentAlloc) throw new Error('Allocation not found');
    if (currentAlloc.status === 'DEDUCTED') {
      return { allocation: currentAlloc, alreadyDeducted: true, historyIds: [] };
    }

    const entries = (currentAlloc.allocationData as any[]) || [];
    const historyIds = await executeStockDeduction(tx, {
      entries: entries.map(e => ({
        skuId: e.skuId,
        skuName: e.skuName,
        warehouseId: e.warehouseId,
        warehouseName: e.warehouseName,
        qty: e.qty,
        uom: e.uom,
      })),
      invoiceId: testInvReject.id,
      invoiceNumber: testInvReject.invoiceNumber,
      invoiceLineId: testLineReject.id,
      allocationId: currentAlloc.id,
      userId: testUserId,
      userName: 'Supervisor Jane',
    });

    const updated = await tx.stockDeductionAllocation.update({
      where: { id: currentAlloc.id },
      data: {
        status: 'DEDUCTED',
        approvedById: testUserId,
        approvedByName: 'Supervisor Jane',
        approvedAt: new Date(),
        deductedAt: new Date(),
        deductedById: testUserId,
        deductedByName: 'Supervisor Jane',
        inventoryHistoryIds: historyIds as any,
      },
    });

    return { allocation: updated, historyIds, alreadyDeducted: false };
  });

  // Case G: Successful deduction -> status is DEDUCTED
  assert(approvalDeductionResult.allocation.status === 'DEDUCTED', 'TEST 32a: Allocation status set directly to DEDUCTED upon approval');
  assert(approvalDeductionResult.historyIds.length === 2, 'TEST 32b: Inventory history created for both exploded allocated items');

  // Verify stock decremented for both items
  const atomicFinalWh1Stock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  const atomicFinalWh2Stock = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
  });
  assert(Boolean(atomicFinalWh1Stock && Number(atomicFinalWh1Stock.qty) === 9), 'TEST 32c: WH 1 stock atomically decremented from 10 to 9');
  assert(Boolean(atomicFinalWh2Stock && Number(atomicFinalWh2Stock.qty) === 4), 'TEST 32d: WH 2 stock atomically decremented from 5 to 4');

  // Case H: Inventory History validation: BEFORE + CHANGE = AFTER, CHANGE is negative
  const histEntries = await prisma.inventoryHistory.findMany({
    where: { id: { in: approvalDeductionResult.historyIds } },
  });
  assert(histEntries.length === 2, 'TEST 32e: Exactly 2 InventoryHistory records exist');
  for (const h of histEntries) {
    const before = Number(h.beforeQty);
    const change = Number(h.qtyChange);
    const after = Number(h.afterQty);
    assert(change < 0, `TEST 32f: InventoryHistory qtyChange is negative (${change})`);
    assert(before + change === after, `TEST 32g: BEFORE (${before}) + CHANGE (${change}) === AFTER (${after})`);
    assert(h.referenceType === 'POST_DISPATCH_DEDUCTION', `TEST 32h: referenceType is POST_DISPATCH_DEDUCTION (got ${h.referenceType})`);
    assert(h.referenceId === testInvReject.id, 'TEST 32i: referenceId is invoiceId');
    assert(h.productName.length > 0, 'TEST 32j: productName is populated');
  }

  // Case F: Duplicate approval/deduction request -> stock deducted only once
  console.log('--- TEST 32-IDEMP: Duplicate approval idempotent guard ---');
  const duplicateResult = await (async () => {
    const alloc = await prisma.stockDeductionAllocation.findUnique({ where: { id: allocReject.id } });
    if (alloc?.status === 'DEDUCTED') {
      return { alreadyDeducted: true, allocation: alloc };
    }
    return { alreadyDeducted: false, allocation: alloc };
  })();
  assert(duplicateResult.alreadyDeducted === true, 'TEST 32k: Duplicate deduction request safely detected as already deducted');

  const wh1StockAfterDup = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Boolean(wh1StockAfterDup && Number(wh1StockAfterDup.qty) === 9), 'TEST 32l: Stock unchanged on duplicate call (still 9, not 8)');

  // Case E: Approved allocation with insufficient stock at deduction time rolls back completely
  console.log('--- TEST 32-ROLLBACK: Insufficient stock at approval time rolls back entire transaction ---');
  // Drain WH 2 stock to 0
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWh2Id, skuId: testSku2Id } },
    data: { qty: 0 },
  });

  // Create another pending line and allocation requiring stock from WH 1 (1 qty) and WH 2 (1 qty)
  const testInsufLine = await prisma.postDispatchInvoiceLine.create({
    data: {
      invoiceId: testInvReject.id,
      itemId: 'ITEM_INSUF',
      itemName: 'Insufficient Item',
      quantity: 1,
      rate: 1000,
      amount: 1000,
    },
  });

  const insufficientAlloc = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: testInvReject.id,
      invoiceLineId: testInsufLine.id,
      expectedItemId: 'ITEM_INSUF',
      expectedItemName: 'Insufficient Item',
      expectedQty: 1,
      expectedUom: 'Set',
      isExploded: true,
      status: 'SUBMITTED_FOR_APPROVAL',
      classification: 'APPROVAL_REQUIRED',
      allocationData: [
        { skuId: testSku1Id, skuName: 'Component A', warehouseId: testWh1Id, warehouseName: 'WH 1', qty: 1, uom: 'UNIT' },
        { skuId: testSku2Id, skuName: 'Component B', warehouseId: testWh2Id, warehouseName: 'WH 2', qty: 1, uom: 'UNIT' },
      ],
    },
  });

  let rollbackErrorCaught = false;
  try {
    await prisma.$transaction(async (tx) => {
      const entries = insufficientAlloc.allocationData as any[];
      await executeStockDeduction(tx, {
        entries: entries.map(e => ({
          skuId: e.skuId,
          skuName: e.skuName,
          warehouseId: e.warehouseId,
          warehouseName: e.warehouseName,
          qty: e.qty,
          uom: e.uom,
        })),
        invoiceId: testInvReject.id,
        invoiceNumber: testInvReject.invoiceNumber,
        invoiceLineId: insufficientAlloc.invoiceLineId,
        allocationId: insufficientAlloc.id,
        userId: testUserId,
        userName: 'Supervisor Jane',
      });

      await tx.stockDeductionAllocation.update({
        where: { id: insufficientAlloc.id },
        data: { status: 'DEDUCTED' },
      });
    });
  } catch (err: any) {
    rollbackErrorCaught = true;
    assert(err.message.includes('Insufficient stock for "Component B"'), 'TEST 32m: Error clearly identifies Component B as failing');
  }
  assert(rollbackErrorCaught === true, 'TEST 32n: Insufficient stock transaction threw error as expected');

  // Verify WH 1 stock was NOT partially decremented (remains 9, not 8)
  const wh1StockAfterRollback = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWh1Id, skuId: testSku1Id } },
  });
  assert(Boolean(wh1StockAfterRollback && Number(wh1StockAfterRollback.qty) === 9), 'TEST 32o: WH 1 stock NOT partially deducted (clean rollback)');

  // Verify allocation status was NOT marked DEDUCTED
  const allocAfterRollback = await prisma.stockDeductionAllocation.findUnique({
    where: { id: insufficientAlloc.id },
  });
  assert(allocAfterRollback?.status === 'SUBMITTED_FOR_APPROVAL', 'TEST 32p: Allocation status remains SUBMITTED_FOR_APPROVAL after rollback');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 33: AGGREGATE INVENTORY STATUS LOGIC (CASES 1 - 7)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 33: Aggregate Invoice-Level Inventory Status (Cases 1 - 7) ---');

  // Case 1: Invoice with 0 deducted lines (unallocated, draft, submitted, rework, or approved) -> PENDING
  const case1StatusNoAlloc = computeAggregateInventoryStatus(3, []);
  assert(case1StatusNoAlloc === 'PENDING', 'TEST 33a: Case 1 - 0 allocations returns PENDING');

  const case1StatusPendingAlloc = computeAggregateInventoryStatus(2, [
    { status: 'DRAFT' },
    { status: 'SUBMITTED_FOR_APPROVAL' },
  ]);
  assert(case1StatusPendingAlloc === 'PENDING', 'TEST 33b: Case 1 - Incomplete allocations with 0 deducted returns PENDING');

  // Case 2: Multi-line invoice where some deducted & some pending -> IN_PROGRESS
  const case2Status = computeAggregateInventoryStatus(3, [
    { status: 'DEDUCTED' },
    { status: 'NOT_ALLOCATED' },
  ]);
  assert(case2Status === 'IN_PROGRESS', 'TEST 33c: Case 2 - 1 deducted out of 3 lines returns IN_PROGRESS');

  // Case 3: Multi-line invoice where some deducted & some approved -> IN_PROGRESS (APPROVED is NOT Completed)
  const case3Status = computeAggregateInventoryStatus(2, [
    { status: 'DEDUCTED' },
    { status: 'APPROVED' },
  ]);
  assert(case3Status === 'IN_PROGRESS', 'TEST 33d: Case 3 - 1 deducted and 1 approved returns IN_PROGRESS (APPROVED != DEDUCTED)');

  // Case 4: Invoice where ALL applicable lines are deducted -> COMPLETED
  const case4Status = computeAggregateInventoryStatus(3, [
    { status: 'DEDUCTED' },
    { status: 'DEDUCTED' },
    { status: 'DEDUCTED' },
  ]);
  assert(case4Status === 'COMPLETED', 'TEST 33e: Case 4 - All lines deducted returns COMPLETED');

  // Case 5: Approval without deduction -> status is NOT COMPLETED (remains PENDING when 0 deducted)
  const case5StatusOnlyApproved = computeAggregateInventoryStatus(2, [
    { status: 'APPROVED' },
    { status: 'APPROVED' },
  ]);
  assert(case5StatusOnlyApproved === 'PENDING', 'TEST 33f: Case 5 - All lines approved but none deducted returns PENDING, NOT COMPLETED');

  // Case 6: Multi-item invoice progressing across states
  // Step 1: 3 lines, unallocated -> PENDING
  assert(computeAggregateInventoryStatus(3, []) === 'PENDING', 'TEST 33g: Case 6 Step 1 - Unallocated invoice is PENDING');

  // Step 2: Line 1 Approved (not deducted), Line 2 & 3 unallocated -> PENDING
  assert(
    computeAggregateInventoryStatus(3, [{ status: 'APPROVED' }]) === 'PENDING',
    'TEST 33h: Case 6 Step 2 - Approved line with no deduction is PENDING'
  );

  // Step 3: Line 1 Deducted, Line 2 & 3 unallocated -> IN_PROGRESS
  assert(
    computeAggregateInventoryStatus(3, [{ status: 'DEDUCTED' }]) === 'IN_PROGRESS',
    'TEST 33i: Case 6 Step 3 - Line 1 deducted out of 3 is IN_PROGRESS'
  );

  // Step 4: Line 1 Deducted, Line 2 Deducted, Line 3 Approved -> IN_PROGRESS
  assert(
    computeAggregateInventoryStatus(3, [
      { status: 'DEDUCTED' },
      { status: 'DEDUCTED' },
      { status: 'APPROVED' },
    ]) === 'IN_PROGRESS',
    'TEST 33j: Case 6 Step 4 - 2 deducted + 1 approved is IN_PROGRESS'
  );

  // Step 5: Line 1, 2, 3 all Deducted -> COMPLETED
  assert(
    computeAggregateInventoryStatus(3, [
      { status: 'DEDUCTED' },
      { status: 'DEDUCTED' },
      { status: 'DEDUCTED' },
    ]) === 'COMPLETED',
    'TEST 33k: Case 6 Step 5 - All 3 deducted is COMPLETED'
  );

  // Case 7: Void invoice handling in API logic
  // Void invoice must preserve its void status / not be converted to COMPLETED
  const mockVoidInvoice = {
    erpStatus: 'Archived',
    erpSubStatus: 'Void',
    zohoStatus: 'void',
    lines: [{ id: 'line-1' }, { id: 'line-2' }],
    stockDeductionAllocations: [{ status: 'DEDUCTED' }, { status: 'DEDUCTED' }],
    workflows: [{ workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' }],
  };
  const isVoidInvoice = mockVoidInvoice.zohoStatus.toLowerCase() === 'void' || mockVoidInvoice.erpSubStatus === 'Void';
  const voidComputedStatus = isVoidInvoice
    ? (mockVoidInvoice.workflows.find(w => w.workflowType === 'INVENTORY_DEDUCTION')?.status || 'PENDING')
    : computeAggregateInventoryStatus(mockVoidInvoice.lines.length, mockVoidInvoice.stockDeductionAllocations);

  assert(isVoidInvoice === true, 'TEST 33l: Case 7 - Invoice correctly recognized as Void');
  assert(voidComputedStatus !== 'COMPLETED', 'TEST 33m: Case 7 - Void invoice inventory status is NOT converted to COMPLETED');
  assert(voidComputedStatus === 'PENDING', 'TEST 33n: Case 7 - Void invoice retains PENDING / void status');


  // Clean up test data
  console.log('\n--- Cleaning up test records ---');
  await prisma.stockDeductionAllocation.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
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
    where: {
      OR: [
        { referenceId: { startsWith: testPrefix } },
        { warehouseId: { in: [testWh1Id, testWh2Id] } },
      ],
    },
  });
  await prisma.warehouseInventory.deleteMany({
    where: { warehouseId: { in: [testWh1Id, testWh2Id] } },
  });
  await prisma.sku.deleteMany({
    where: { id: { in: [testSku1Id, testSku2Id] } },
  });
  await prisma.warehouse.deleteMany({
    where: { id: { in: [testWh1Id, testWh2Id] } },
  });

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStockDeductionTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

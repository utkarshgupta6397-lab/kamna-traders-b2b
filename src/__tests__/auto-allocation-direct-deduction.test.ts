import { prisma } from '../lib/db';
import { Prisma } from '@prisma/client';
import {
  classifyAllocation,
  executeStockDeduction,
  validateAllocationsStock,
  checkInvoiceDeductionCompletion,
} from '../lib/stock-deduction-service';

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

async function runAutoAllocationDirectDeductionTests() {
  console.log('\n======================================================');
  console.log('   AUTO-ALLOCATION DIRECT DEDUCTION REGRESSION TESTS ');
  console.log('======================================================\n');

  const testPrefix = 'test_aadd_';
  const testWhId = 'WH_AADD_BUDH_VIHAR';
  const testSkuId = 'X4HPBS';
  const testZohoLocationId = '1759923000003192288';
  const testZohoItemId = '1759923000019165888';

  const existingUser = await prisma.user.findFirst({ select: { id: true, name: true } });
  const testUserId = existingUser?.id || 'admin';
  const testUserName = existingUser?.name || 'Test Admin';

  // 1. Cleanup old test records
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
        { warehouseId: testWhId },
      ],
    },
  });
  await prisma.warehouseInventory.deleteMany({
    where: { warehouseId: testWhId },
  });
  await prisma.sku.deleteMany({
    where: { id: testSkuId },
  });
  await prisma.warehouse.deleteMany({
    where: { id: testWhId },
  });

  // 2. Setup Warehouse, SKU, and Inventory matching the exact user scenario:
  // SKU: X4HPBS (SOLAR MID & END CLAMP SET WITH SPRING NUT & BOLT)
  // Warehouse: Budh Vihar
  // Current Warehouse Inventory: 823 Set
  // Invoice Qty: 20 Set
  await prisma.warehouse.create({
    data: {
      id: testWhId,
      name: 'Budh Vihar',
      active: true,
      isSystemWarehouse: false,
      zohoLocationId: testZohoLocationId,
    },
  });

  await prisma.sku.create({
    data: {
      id: testSkuId,
      name: 'SOLAR MID & END CLAMP SET WITH SPRING NUT & BOLT',
      unit: 'SET',
      zohoBookItemId: testZohoItemId,
    },
  });

  await prisma.warehouseInventory.create({
    data: {
      warehouseId: testWhId,
      skuId: testSkuId,
      qty: 823,
      isOos: false,
    },
  });

  const invoice = await prisma.postDispatchInvoice.create({
    data: {
      zohoInvoiceId: `${testPrefix}inv_3252`,
      invoiceNumber: 'KT/26-27/3252',
      customerName: 'R.S TRADERS',
      erpStatus: 'Active',
      zohoStatus: 'sent',
      zohoCreatedTime: new Date(),
      lines: {
        create: [
          {
            id: `${testPrefix}line_1`,
            itemId: testZohoItemId,
            itemName: 'SOLAR MID & END CLAMP SET WITH SPRING NUT & BOLT',
            quantity: 20,
          },
        ],
      },
    },
  });

  const line = await prisma.postDispatchInvoiceLine.findUniqueOrThrow({
    where: { id: `${testPrefix}line_1` },
  });

  // --- TEST 1: Automatic allocation classification check ---
  console.log('--- TEST 1: Automatic allocation classification check ---');
  const normalAllocations = [
    {
      skuId: testSkuId,
      skuName: 'SOLAR MID & END CLAMP SET WITH SPRING NUT & BOLT',
      warehouseId: testWhId,
      warehouseName: 'Budh Vihar',
      qty: 20,
      uom: 'Set',
    },
  ];

  const classResult = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 20,
    allocations: normalAllocations,
    isExploded: false,
  });

  assert(classResult.classification === 'AUTO_APPROVED', `Normal exact match classifies as AUTO_APPROVED (got ${classResult.classification})`);
  assert(classResult.deviationReasons.length === 0, `No deviation reasons present (got ${classResult.deviationReasons.join(', ')})`);
  assert(classResult.allocatedQty === 20, `Allocated quantity is 20`);
  assert(classResult.remainingQty === 0, `Remaining quantity is 0`);

  // --- TEST 2: Stock validation check ---
  console.log('--- TEST 2: Stock pre-check validation ---');
  const stockValidation = await validateAllocationsStock(prisma, normalAllocations);
  assert(stockValidation.valid === true, `Stock pre-check passes (available 823 >= 20 required)`);

  // --- TEST 3: Direct Deduction execution (Case A) ---
  console.log('--- TEST 3: Direct Deduction execution (Case A atomic deduction) ---');
  const initialStock = await prisma.warehouseInventory.findUniqueOrThrow({
    where: {
      warehouseId_skuId: {
        warehouseId: testWhId,
        skuId: testSkuId,
      },
    },
  });
  assert(Number(initialStock.qty) === 823, `Initial warehouse stock is 823`);

  // Create draft allocation
  const allocRecord = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: invoice.id,
      invoiceLineId: line.id,
      expectedItemId: line.itemId,
      expectedItemName: line.itemName,
      expectedSkuId: testSkuId,
      expectedWarehouseId: testWhId,
      expectedQty: 20,
      expectedUom: 'Set',
      allocationData: normalAllocations as any,
      isExploded: false,
      status: 'DRAFT',
      classification: 'AUTO_APPROVED',
    },
  });

  // Execute direct deduction atomically as in Case A
  const historyIds = await prisma.$transaction(async (tx) => {
    const ids = await executeStockDeduction(tx, {
      entries: normalAllocations,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceLineId: line.id,
      allocationId: allocRecord.id,
      userId: testUserId,
      userName: testUserName,
    });

    await tx.stockDeductionAllocation.update({
      where: { id: allocRecord.id },
      data: {
        status: 'DEDUCTED',
        deductedAt: new Date(),
        deductedById: testUserId,
        deductedByName: testUserName,
        inventoryHistoryIds: ids as any,
      },
    });

    return ids;
  });

  const postDeductStock = await prisma.warehouseInventory.findUniqueOrThrow({
    where: {
      warehouseId_skuId: {
        warehouseId: testWhId,
        skuId: testSkuId,
      },
    },
  });

  assert(Number(postDeductStock.qty) === 803, `Warehouse stock correctly decremented from 823 to 803 (got ${postDeductStock.qty})`);

  const updatedAllocation = await prisma.stockDeductionAllocation.findUniqueOrThrow({
    where: { id: allocRecord.id },
  });
  assert(updatedAllocation.status === 'DEDUCTED', `Allocation status transitioned directly to DEDUCTED (got ${updatedAllocation.status})`);
  assert(historyIds.length === 1, `Exactly 1 InventoryHistory record created`);

  const invHistory = await prisma.inventoryHistory.findUniqueOrThrow({
    where: { id: historyIds[0] },
  });
  assert(Number(invHistory.qtyChange) === -20, `InventoryHistory records -20 change`);
  assert(Number(invHistory.beforeQty) === 823, `InventoryHistory records 823 before`);
  assert(Number(invHistory.afterQty) === 803, `InventoryHistory records 803 after`);

  // --- TEST 4: Deviations correctly classify as APPROVAL_REQUIRED ---
  console.log('--- TEST 4: Deviations correctly classify as APPROVAL_REQUIRED ---');
  // 4a. Exploded line
  const explodedClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 20,
    allocations: normalAllocations,
    isExploded: true,
  });
  assert(explodedClass.classification === 'APPROVAL_REQUIRED', `Exploded line classifies as APPROVAL_REQUIRED`);
  assert(explodedClass.deviationReasons.includes('ITEM_EXPLODED'), `Includes ITEM_EXPLODED deviation`);

  // 4b. Different warehouse
  const whDevClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: 'WH_OTHER',
    expectedQty: 20,
    allocations: normalAllocations,
    isExploded: false,
  });
  assert(whDevClass.classification === 'APPROVAL_REQUIRED', `Warehouse deviation classifies as APPROVAL_REQUIRED`);
  assert(whDevClass.deviationReasons.includes('WAREHOUSE_DEVIATION'), `Includes WAREHOUSE_DEVIATION`);

  // 4c. Quantity exceeds expected
  const qtyDevClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 15,
    allocations: normalAllocations, // qty is 20 > 15
    isExploded: false,
  });
  assert(qtyDevClass.classification === 'APPROVAL_REQUIRED', `Over-quantity classifies as APPROVAL_REQUIRED`);
  assert(qtyDevClass.deviationReasons.includes('QUANTITY_EXCEEDS_EXPECTED'), `Includes QUANTITY_EXCEEDS_EXPECTED`);

  // --- TEST 5: Comprehensive UOM Barrier Removal Scenarios (Items 1 to 9) ---
  console.log('--- TEST 5: UOM Barrier Removal Scenarios ---');

  // Scenario KT/26-27/3256:
  // Product: ACDB DCDB Combo Single Phase Havells SPD MCB Fuse
  // Invoice Qty: 5 Set
  // Local SKU: 2KHJ89 (unit: 'UNIT')
  // Warehouse: Budh Vihar Warehouse (Inventory: 1000)
  // Deduction Qty: 5
  const testWh3256Id = 'WH_KT_3256';
  const testSku3256Id = '2KHJ89';

  await prisma.warehouse.upsert({
    where: { id: testWh3256Id },
    create: {
      id: testWh3256Id,
      name: 'Budh Vihar Warehouse',
      active: true,
      isSystemWarehouse: false,
    },
    update: {
      name: 'Budh Vihar Warehouse',
      active: true,
    },
  });

  await prisma.sku.upsert({
    where: { id: testSku3256Id },
    create: {
      id: testSku3256Id,
      name: 'ACDB DCDB Combo Single Phase Havells SPD MCB Fuse',
      unit: 'UNIT',
    },
    update: {
      unit: 'UNIT',
    },
  });

  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_skuId: {
        warehouseId: testWh3256Id,
        skuId: testSku3256Id,
      },
    },
    create: {
      warehouseId: testWh3256Id,
      skuId: testSku3256Id,
      qty: 1000,
      isOos: false,
    },
    update: {
      qty: 1000,
      isOos: false,
    },
  });

  // 1. SET -> UNIT: Invoice Qty 5 Set, Local SKU UNIT, Deduction Qty 5
  const kt3256Allocations = [{
    skuId: testSku3256Id,
    skuName: 'ACDB DCDB Combo Single Phase Havells SPD MCB Fuse',
    warehouseId: testWh3256Id,
    warehouseName: 'Budh Vihar Warehouse',
    qty: 5,
    uom: 'UNIT',
  }];

  const kt3256Class = classifyAllocation({
    expectedSkuId: testSku3256Id,
    expectedWarehouseId: testWh3256Id,
    expectedQty: 5,
    allocations: kt3256Allocations,
    isExploded: false,
  });
  assert(kt3256Class.classification === 'AUTO_APPROVED', 'TEST 5.1: SET -> UNIT classifies as AUTO_APPROVED (Direct Deduction Eligible)');
  assert(kt3256Class.deviationReasons.length === 0, 'TEST 5.1b: No deviation reasons for SET -> UNIT');

  // Execute deduction for KT/26-27/3256
  const inv3256 = await prisma.postDispatchInvoice.create({
    data: {
      id: `${testPrefix}inv_3256`,
      zohoInvoiceId: `${testPrefix}inv_3256`,
      invoiceNumber: 'KT/26-27/3256',
      customerName: 'Test Customer 3256',
      erpStatus: 'Active',
      zohoStatus: 'sent',
      zohoCreatedTime: new Date(),
      lines: {
        create: [
          {
            id: `${testPrefix}line_3256`,
            itemId: 'zoho_item_3256',
            itemName: 'ACDB DCDB Combo Single Phase Havells SPD MCB Fuse',
            quantity: 5,
          },
        ],
      },
    },
  });

  const alloc3256 = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: inv3256.id,
      invoiceLineId: `${testPrefix}line_3256`,
      expectedItemId: 'zoho_item_3256',
      expectedItemName: 'ACDB DCDB Combo Single Phase Havells SPD MCB Fuse',
      expectedSkuId: testSku3256Id,
      expectedWarehouseId: testWh3256Id,
      expectedQty: 5,
      expectedUom: 'Set',
      allocationData: kt3256Allocations as any,
      isExploded: false,
      status: 'DRAFT',
      classification: 'AUTO_APPROVED',
    },
  });

  await prisma.$transaction(async (tx) => {
    const histIds = await executeStockDeduction(tx, {
      entries: kt3256Allocations,
      invoiceId: inv3256.id,
      invoiceNumber: inv3256.invoiceNumber,
      invoiceLineId: `${testPrefix}line_3256`,
      allocationId: alloc3256.id,
      userId: testUserId,
      userName: testUserName,
    });
    await tx.stockDeductionAllocation.update({
      where: { id: alloc3256.id },
      data: {
        status: 'DEDUCTED',
        deductedAt: new Date(),
        deductedById: testUserId,
        deductedByName: testUserName,
        inventoryHistoryIds: histIds as any,
      },
    });
  });

  const stock3256After = await prisma.warehouseInventory.findUniqueOrThrow({
    where: {
      warehouseId_skuId: {
        warehouseId: testWh3256Id,
        skuId: testSku3256Id,
      },
    },
  });
  assert(Number(stock3256After.qty) === 995, `TEST 5.1c: Exactly 5 units deducted from 1000 -> 995 (got ${stock3256After.qty})`);

  const updatedAlloc3256 = await prisma.stockDeductionAllocation.findUniqueOrThrow({
    where: { id: alloc3256.id },
  });
  assert(updatedAlloc3256.status === 'DEDUCTED', 'TEST 5.1d: Allocation status becomes DEDUCTED');

  // 2. UNIT -> SET: Invoice Qty 5 Unit, Local SKU Set, Deduction Qty 5
  const unitToSetClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 5,
    allocations: [{
      skuId: testSkuId,
      skuName: 'Item',
      warehouseId: testWhId,
      warehouseName: 'Budh Vihar',
      qty: 5,
      uom: 'SET',
    }],
    isExploded: false,
  });
  assert(unitToSetClass.classification === 'AUTO_APPROVED', 'TEST 5.2: UNIT -> SET classifies as AUTO_APPROVED');

  // 3. PCS -> UNIT: Invoice Qty 10 PCS, Local SKU UNIT, Deduction Qty 10
  const pcsToUnitClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 10,
    allocations: [{
      skuId: testSkuId,
      skuName: 'Item',
      warehouseId: testWhId,
      warehouseName: 'Budh Vihar',
      qty: 10,
      uom: 'UNIT',
    }],
    isExploded: false,
  });
  assert(pcsToUnitClass.classification === 'AUTO_APPROVED', 'TEST 5.3: PCS -> UNIT classifies as AUTO_APPROVED');

  // 4. NOS -> SET: Invoice Qty 8 NOS, Local SKU SET, Deduction Qty 8
  const nosToSetClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 8,
    allocations: [{
      skuId: testSkuId,
      skuName: 'Item',
      warehouseId: testWhId,
      warehouseName: 'Budh Vihar',
      qty: 8,
      uom: 'SET',
    }],
    isExploded: false,
  });
  assert(nosToSetClass.classification === 'AUTO_APPROVED', 'TEST 5.4: NOS -> SET classifies as AUTO_APPROVED');

  // 5. UOM mismatch with sufficient inventory -> must NOT require approval
  const mismatchSufficientClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 12,
    allocations: [{
      skuId: testSkuId,
      skuName: 'Item',
      warehouseId: testWhId,
      warehouseName: 'Budh Vihar',
      qty: 12,
      uom: 'BAG', // different UOM
    }],
    isExploded: false,
  });
  assert(mismatchSufficientClass.classification === 'AUTO_APPROVED', 'TEST 5.5: UOM mismatch with sufficient stock does NOT require approval');

  // 6. UOM mismatch with insufficient inventory -> must still be blocked because of insufficient stock, NOT because of UOM
  const insufficientAlloc = [{
    skuId: testSku3256Id,
    skuName: 'Item',
    warehouseId: testWh3256Id,
    warehouseName: 'Budh Vihar Warehouse',
    qty: 9999, // exceeds 995 available
    uom: 'SET', // different from SKU's UNIT
  }];
  const insufficientStockCheck = await validateAllocationsStock(prisma, insufficientAlloc);
  assert(insufficientStockCheck.valid === false, 'TEST 5.6a: Insufficient stock check fails on qty 9999 > 995');
  assert(Boolean(insufficientStockCheck.error?.includes('Insufficient stock')), 'TEST 5.6b: Block reason is strictly insufficient stock, not UOM');

  // 7. SKU deviation -> existing approval behavior remains unchanged
  const skuDevClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 5,
    allocations: [{
      skuId: 'DIFFERENT_SKU',
      skuName: 'Different Item',
      warehouseId: testWhId,
      warehouseName: 'Budh Vihar',
      qty: 5,
      uom: 'UNIT',
    }],
    isExploded: false,
  });
  assert(skuDevClass.classification === 'APPROVAL_REQUIRED', 'TEST 5.7: SKU deviation still requires approval');
  assert(skuDevClass.deviationReasons.includes('SKU_DEVIATION'), 'TEST 5.7b: Includes SKU_DEVIATION');

  // 8. Warehouse deviation -> existing approval behavior remains unchanged
  const whDevClass2 = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 5,
    allocations: [{
      skuId: testSkuId,
      skuName: 'Item',
      warehouseId: 'OTHER_WH',
      warehouseName: 'Other Warehouse',
      qty: 5,
      uom: 'UNIT',
    }],
    isExploded: false,
  });
  assert(whDevClass2.classification === 'APPROVAL_REQUIRED', 'TEST 5.8: Warehouse deviation still requires approval');
  assert(whDevClass2.deviationReasons.includes('WAREHOUSE_DEVIATION'), 'TEST 5.8b: Includes WAREHOUSE_DEVIATION');

  // 9. Manual allocation -> UOM must not block saving/submission
  const manualAlloc = [
    { skuId: testSkuId, skuName: 'Part A', warehouseId: testWhId, warehouseName: 'Budh Vihar', qty: 2, uom: 'MTR' },
    { skuId: testSku3256Id, skuName: 'Part B', warehouseId: testWh3256Id, warehouseName: 'Budh Vihar Warehouse', qty: 3, uom: 'UNIT' },
  ];
  const manualStockCheck = await validateAllocationsStock(prisma, manualAlloc);
  assert(manualStockCheck.valid === true, 'TEST 5.9a: Stock check succeeds for manual allocations across warehouses regardless of UOMs');
  const manualClass = classifyAllocation({
    expectedSkuId: testSkuId,
    expectedWarehouseId: testWhId,
    expectedQty: 1,
    allocations: manualAlloc,
    isExploded: true,
  });
  assert(manualClass.classification === 'APPROVAL_REQUIRED', 'TEST 5.9b: Manual exploded allocation classifies as APPROVAL_REQUIRED because of explosion');
  assert(manualClass.deviationReasons.includes('ITEM_EXPLODED'), 'TEST 5.9c: Reason is ITEM_EXPLODED (not UOM)');

  // --- TEST 6: Excess Quantity Approval & Inventory Protection ---
  console.log('\n--- TEST 6: Excess Quantity Approval & Inventory Protection ---');

  const testWhExcessId = 'WH_EXCESS_TEST';
  const testSkuExcessId = 'SKU_EXCESS_TEST';
  const testInvExcessId = `${testPrefix}inv_excess`;
  const testLineExcessId = `${testPrefix}line_excess`;

  await prisma.warehouse.upsert({
    where: { id: testWhExcessId },
    create: { id: testWhExcessId, name: 'Excess Test Warehouse', active: true, isSystemWarehouse: false, zohoLocationId: 'loc_excess_test' },
    update: { active: true, isSystemWarehouse: false, zohoLocationId: 'loc_excess_test' },
  });

  await prisma.sku.upsert({
    where: { id: testSkuExcessId },
    create: { id: testSkuExcessId, name: 'Excess Test SKU', unit: 'Nos' },
    update: { name: 'Excess Test SKU', unit: 'Nos' },
  });

  // Set warehouse inventory to 12 Nos
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId: testWhExcessId, skuId: testSkuExcessId } },
    create: { warehouseId: testWhExcessId, skuId: testSkuExcessId, qty: 12 },
    update: { qty: 12 },
  });

  // Invoice line quantity is 11 Nos
  await prisma.postDispatchInvoice.create({
    data: {
      id: testInvExcessId,
      zohoInvoiceId: testInvExcessId,
      invoiceNumber: 'INV-EXCESS-11-12',
      customerName: 'Excess Test Customer',
      erpStatus: 'Active',
      zohoStatus: 'sent',
      zohoCreatedTime: new Date(),
      lines: {
        create: [
          {
            id: testLineExcessId,
            itemId: testSkuExcessId,
            itemName: 'Excess Test SKU',
            quantity: 11,
            rate: 100,
            amount: 1100,
          },
        ],
      },
    },
  });

  // 6.1: Requested deduction = 12, invoice qty = 11, inventory = 12
  // Check stock validation succeeds (12 <= 12 available)
  const alloc12 = [
    { skuId: testSkuExcessId, skuName: 'Excess Test SKU', warehouseId: testWhExcessId, warehouseName: 'Excess Test Warehouse', qty: 12, uom: 'Nos' },
  ];
  const stockCheck12 = await validateAllocationsStock(prisma, alloc12);
  assert(stockCheck12.valid === true, 'TEST 6.1a: Stock check succeeds for 12 units when 12 are in warehouse');

  // Check classification is APPROVAL_REQUIRED with QUANTITY_EXCEEDS_EXPECTED
  const class12 = classifyAllocation({
    expectedSkuId: testSkuExcessId,
    expectedWarehouseId: testWhExcessId,
    expectedQty: 11,
    allocations: alloc12,
    isExploded: false,
  });
  assert(class12.classification === 'APPROVAL_REQUIRED', 'TEST 6.1b: 12 units against 11 invoice qty classifies as APPROVAL_REQUIRED');
  assert(class12.deviationReasons.includes('QUANTITY_EXCEEDS_EXPECTED'), 'TEST 6.1c: Deviation reasons includes QUANTITY_EXCEEDS_EXPECTED');
  assert(class12.allocatedQty === 12, 'TEST 6.1d: Allocated quantity is 12');

  // 6.2: Insufficient stock check: Requested deduction = 13, invoice qty = 11, inventory = 12
  const alloc13 = [
    { skuId: testSkuExcessId, skuName: 'Excess Test SKU', warehouseId: testWhExcessId, warehouseName: 'Excess Test Warehouse', qty: 13, uom: 'Nos' },
  ];
  const stockCheck13 = await validateAllocationsStock(prisma, alloc13);
  assert(stockCheck13.valid === false, 'TEST 6.2a: Stock check fails for 13 units when only 12 are available');
  assert(stockCheck13.error?.includes('Insufficient stock') === true, 'TEST 6.2b: Returns clear Insufficient stock error message');

  // 6.3: Another insufficient stock scenario: invoice qty 11, requested 11, inventory 10
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWhExcessId, skuId: testSkuExcessId } },
    data: { qty: 10 },
  });
  const alloc11 = [
    { skuId: testSkuExcessId, skuName: 'Excess Test SKU', warehouseId: testWhExcessId, warehouseName: 'Excess Test Warehouse', qty: 11, uom: 'Nos' },
  ];
  const stockCheck11 = await validateAllocationsStock(prisma, alloc11);
  assert(stockCheck11.valid === false, 'TEST 6.3a: Stock check fails when warehouse inventory (10) < requested (11)');

  // Restore inventory to 12
  await prisma.warehouseInventory.update({
    where: { warehouseId_skuId: { warehouseId: testWhExcessId, skuId: testSkuExcessId } },
    data: { qty: 12 },
  });

  // 6.4: Direct deduction blocked for excess quantity
  assert(class12.classification !== 'AUTO_APPROVED', 'TEST 6.4: Excess quantity allocation cannot be auto-deducted directly');

  // 6.5: End-to-end lifecycle: Submission for approval -> Manager Approval -> Deduction of 12 units
  const snapshot65 = {
    allocations: alloc12,
    isExploded: false,
    expectedSkuId: testSkuExcessId,
    expectedWarehouseId: testWhExcessId,
    expectedQty: 11,
    expectedUom: 'Nos',
    classification: class12.classification,
    deviationReasons: class12.deviationReasons,
    snapshotAt: new Date().toISOString(),
  };

  const allocRecord6 = await prisma.stockDeductionAllocation.create({
    data: {
      invoiceId: testInvExcessId,
      invoiceLineId: testLineExcessId,
      expectedItemId: testSkuExcessId,
      expectedItemName: 'Excess Test SKU',
      expectedSkuId: testSkuExcessId,
      expectedWarehouseId: testWhExcessId,
      expectedQty: 11,
      expectedUom: 'Nos',
      allocationData: alloc12 as any,
      isExploded: false,
      status: 'SUBMITTED_FOR_APPROVAL',
      classification: class12.classification,
      deviationReasons: class12.deviationReasons,
      submittedById: testUserId,
      submittedByName: testUserName,
      submittedAt: new Date(),
      submittedSnapshot: snapshot65 as any,
    },
  });

  assert(allocRecord6.status === 'SUBMITTED_FOR_APPROVAL', 'TEST 6.5a: Allocation successfully submitted for approval');

  // Verify inventory is NOT yet deducted
  const invBeforeApproval = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWhExcessId, skuId: testSkuExcessId } },
  });
  assert(Number(invBeforeApproval?.qty) === 12, 'TEST 6.5b: Inventory remains untouched (12) prior to manager approval');

  // 6.6: Manager executes approval -> Atomic deduction of all 12 units
  const historyIds6 = await prisma.$transaction(async (tx) => {
    return executeStockDeduction(tx, {
      entries: alloc12.map(e => ({
        skuId: e.skuId,
        skuName: e.skuName,
        warehouseId: e.warehouseId,
        warehouseName: e.warehouseName,
        qty: e.qty,
        uom: e.uom,
      })),
      invoiceId: testInvExcessId,
      invoiceNumber: 'INV-EXCESS-11-12',
      invoiceLineId: testLineExcessId,
      allocationId: allocRecord6.id,
      userId: testUserId,
      userName: testUserName,
    });
  });

  await prisma.stockDeductionAllocation.update({
    where: { id: allocRecord6.id },
    data: {
      status: 'DEDUCTED',
      approvedById: testUserId,
      approvedByName: testUserName,
      approvedAt: new Date(),
      deductedAt: new Date(),
      deductedById: testUserId,
      deductedByName: testUserName,
      inventoryHistoryIds: historyIds6 as any,
    },
  });

  assert(historyIds6.length === 1, 'TEST 6.6a: Exactly 1 InventoryHistory record created');

  const invAfterApproval = await prisma.warehouseInventory.findUnique({
    where: { warehouseId_skuId: { warehouseId: testWhExcessId, skuId: testSkuExcessId } },
  });
  assert(Number(invAfterApproval?.qty) === 0, 'TEST 6.6b: Inventory decremented by 12 (12 -> 0)');

  const histRecord = await prisma.inventoryHistory.findUnique({
    where: { id: historyIds6[0] },
  });
  assert(Number(histRecord?.qtyChange) === -12, 'TEST 6.6c: InventoryHistory qtyChange is -12');
  assert(Number(histRecord?.beforeQty) === 12, 'TEST 6.6d: InventoryHistory beforeQty is 12');
  assert(Number(histRecord?.afterQty) === 0, 'TEST 6.6e: InventoryHistory afterQty is 0');

  // Clean up test records
  console.log('\n--- Cleaning up test records ---');
  await prisma.stockDeductionAllocation.deleteMany({
    where: {
      OR: [
        { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
        { invoiceId: { startsWith: testPrefix } },
        { invoiceId: testInvExcessId },
      ],
    },
  });
  await prisma.postDispatchWorkflow.deleteMany({
    where: { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
  });
  await prisma.postDispatchInvoiceLine.deleteMany({
    where: {
      OR: [
        { invoice: { zohoInvoiceId: { startsWith: testPrefix } } },
        { id: { startsWith: testPrefix } },
        { id: testLineExcessId },
      ],
    },
  });
  await prisma.postDispatchInvoice.deleteMany({
    where: {
      OR: [
        { zohoInvoiceId: { startsWith: testPrefix } },
        { id: { startsWith: testPrefix } },
        { id: testInvExcessId },
      ],
    },
  });
  await prisma.inventoryHistory.deleteMany({
    where: { warehouseId: { in: [testWhId, testWh3256Id, testWhExcessId] } },
  });
  await prisma.warehouseInventory.deleteMany({
    where: { warehouseId: { in: [testWhId, testWh3256Id, testWhExcessId] } },
  });
  await prisma.sku.deleteMany({
    where: { id: { in: [testSkuId, testSkuExcessId] } },
  });
  await prisma.warehouse.deleteMany({
    where: { id: { in: [testWhId, testWh3256Id, testWhExcessId] } },
  });

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAutoAllocationDirectDeductionTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const TEST_MARKER = 'ADVANCED_VIEW_TEST_DATA';

async function main() {
  console.log('--- Seeding Advanced Stock View Test Data ---');

  // 1. Cleanup previous run
  console.log('Cleaning up old test data...');
  const oldCarts = await prisma.cart.findMany({
    where: { customerName: TEST_MARKER },
    select: { id: true }
  });
  if (oldCarts.length > 0) {
    const oldCartIds = oldCarts.map(c => c.id);
    await prisma.cartItem.deleteMany({ where: { cartId: { in: oldCartIds } } });
    await prisma.cartHistory.deleteMany({ where: { cartId: { in: oldCartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: oldCartIds } } });
  }

  await prisma.inventoryHistory.deleteMany({
    where: { remarks: TEST_MARKER }
  });

  console.log('Cleanup complete.');

  // 2. Identify Target Warehouse and Staff
  const warehouse = await prisma.warehouse.findFirst({
    where: { isSystemWarehouse: false, active: true },
    orderBy: { name: 'asc' }
  });
  if (!warehouse) throw new Error('No active warehouse found.');

  const staff = await prisma.user.findFirst({
    where: { role: 'STAFF' }
  });
  if (!staff) throw new Error('No staff user found.');

  // 3. Identify Target SKUs
  const skus = await prisma.sku.findMany({
    take: 25,
    orderBy: { createdAt: 'desc' }
  });
  if (skus.length === 0) throw new Error('No SKUs found to modify.');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 15; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(23, 59, 58, 0); // End of day for history
    dates.push(d);
  }

  // 4. Generate Scenarios
  console.log(`Generating data for ${skus.length} SKUs in ${warehouse.name}...`);
  
  let cartCount = 0;
  let historyCount = 0;

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    const scenario = i % 9; 
    // 0: Stable high stock (No consumption, high inventory)
    // 1: Decreasing stock (High consumption, no replenishment)
    // 2: Intermittent replenishment (Drops then spikes)
    // 3: Approaching Max Level (near 100%)
    // 4: Above Max Level (>100%)
    // 5: Below 33% (Danger)
    // 6: Stock Out (0 stock)
    // 7: Zero movement, Current > 0
    // 8: Historical movement, Current 0

    let currentQty = 100;
    let dailyConsumption = 0;
    let maxLevelObj = 100; // Fake target

    const createCartEvent = async (date: Date, qty: number) => {
      if (qty <= 0) return;
      const cartId = randomUUID();
      await prisma.cart.create({
        data: {
          id: cartId,
          warehouseId: warehouse.id,
          customerName: TEST_MARKER,
          staffId: staff.id,
          zohoSyncStatus: 'SUCCESS',
          createdAt: date,
          notes: TEST_MARKER
        }
      });
      await prisma.cartItem.create({
        data: {
          cartId: cartId,
          skuId: sku.id,
          qty: qty
        }
      });
      cartCount++;
    };

    const createHistoryEvent = async (date: Date, beforeQty: number, afterQty: number) => {
      await prisma.inventoryHistory.create({
        data: {
          warehouseId: warehouse.id,
          skuId: sku.id,
          productName: sku.name,
          beforeQty,
          afterQty,
          qtyChange: afterQty - beforeQty,
          remarks: TEST_MARKER,
          createdBy: staff.id,
          createdAt: date
        }
      });
      historyCount++;
    };

    let startStock = 100;
    let simStock = startStock;

    switch(scenario) {
      case 0: // Stable high
        startStock = 500;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        break;
      
      case 1: // Decreasing
        startStock = 150;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        for (let d = 1; d < 15; d++) {
          if (d % 2 === 0) {
            const consume = 10;
            await createCartEvent(dates[d], consume);
            await createHistoryEvent(dates[d], simStock, simStock - consume);
            simStock -= consume;
          }
        }
        break;
      
      case 2: // Intermittent
        startStock = 50;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        for (let d = 1; d < 15; d++) {
          if (d === 7) {
            // Replenish
            await createHistoryEvent(dates[d], simStock, simStock + 100);
            simStock += 100;
          } else if (d % 3 === 0) {
            const consume = 15;
            await createCartEvent(dates[d], consume);
            await createHistoryEvent(dates[d], simStock, simStock - consume);
            simStock -= consume;
          }
        }
        break;

      case 3: // Approaching Max (Need specific consumption to set max level)
        // MaxLevel = cpd * leadTime * safetyFactor = cpd * 3 * 1.5 = cpd * 4.5
        // If cpd = 20, maxLevel = 90
        // We want stock around 80.
        startStock = 200;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        for (let d = 1; d < 15; d++) {
          const consume = 20; // total 280 over 14 days, cpd ~18.6
          await createCartEvent(dates[d], consume);
          await createHistoryEvent(dates[d], simStock, simStock - consume);
          simStock -= consume;
          if (simStock < 80) {
            await createHistoryEvent(dates[d], simStock, simStock + 100); // replenish
            simStock += 100;
          }
        }
        break;

      case 4: // Above max
        // low consumption, high stock
        startStock = 200;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        for (let d = 1; d < 15; d+=5) {
          const consume = 2; 
          await createCartEvent(dates[d], consume);
          await createHistoryEvent(dates[d], simStock, simStock - consume);
          simStock -= consume;
        }
        break;
      
      case 5: // Below 33%
        // High consumption, low stock
        startStock = 150;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        for (let d = 1; d < 15; d++) {
          const consume = 9; 
          await createCartEvent(dates[d], consume);
          await createHistoryEvent(dates[d], simStock, simStock - consume);
          simStock -= consume;
        }
        break;

      case 6: // Stock Out
        startStock = 10;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        await createCartEvent(dates[5], 10);
        await createHistoryEvent(dates[5], simStock, 0);
        simStock = 0;
        break;

      case 7: // Zero movement, Current > 0
        startStock = 45;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        break;

      case 8: // Historical movement, Current 0
        startStock = 50;
        simStock = startStock;
        await createHistoryEvent(dates[0], 0, startStock);
        await createCartEvent(dates[10], 50);
        await createHistoryEvent(dates[10], simStock, 0);
        simStock = 0;
        break;
    }

    // Set actual WarehouseInventory
    await prisma.warehouseInventory.upsert({
      where: { warehouseId_skuId: { warehouseId: warehouse.id, skuId: sku.id } },
      update: { qty: simStock, isOos: simStock <= 0 },
      create: { warehouseId: warehouse.id, skuId: sku.id, qty: simStock, zone: 'A1', isOos: simStock <= 0 }
    });
  }

  console.log(`Generated ${cartCount} Carts/CartItems and ${historyCount} InventoryHistory records.`);
  console.log('Seed completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

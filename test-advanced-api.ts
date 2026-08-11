import { prisma } from './src/lib/db';
import { ProductLookupService } from './src/lib/services/ProductLookupService';

async function testApi() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const historicalDates: string[] = [];
    for (let i = 1; i <= 15; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      historicalDates.push(d.toISOString().split('T')[0]); 
    }
    
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 15);

    console.log("Fetching base data...");
    const [warehouses, activeCategories, products, config] = await Promise.all([
      prisma.warehouse.findMany({
        where: { active: true, isSystemWarehouse: false },
        select: { id: true, name: true, isSystemWarehouse: true }
      }),
      prisma.category.findMany({
        where: { active: true },
        include: {
          productAttributes: {
            include: { attribute: true }
          }
        }
      }),
      ProductLookupService.search('inventory'),
      prisma.inventoryConfig.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { leadTimeDays: 3, safetyFactor: 1.5 }
      })
    ]);

    console.log("Base data fetched. Products count:", products.length);

    const selectedWHIds = warehouses.map(w => w.id);

    const categoryMap = new Map(activeCategories.map(c => [c.id, c]));
    
    const skuIds = products.map((p: any) => p.id); 
    
    console.log("Fetching variants...");
    const variants = await prisma.productVariant.findMany({
      where: { sku: { in: skuIds }, isActive: true },
      select: { sku: true, productId: true }
    });
    const productIds = variants.map(v => v.productId);
    
    console.log("Fetching attrValues...");
    const attrValues = await prisma.productAttributeValue.findMany({
      where: { productId: { in: productIds } },
      include: { attribute: { select: { id: true } } }
    });

    console.log("Fetching historyEvents...");
    const historyEvents = await prisma.inventoryHistory.findMany({
      where: {
        skuId: { in: skuIds },
        warehouseId: { in: selectedWHIds },
        createdAt: { gte: windowStart }
      },
      orderBy: { createdAt: 'asc' },
      select: { skuId: true, warehouseId: true, afterQty: true, createdAt: true }
    });

    console.log("Fetching cartItems...");
    const cartItems = await prisma.cartItem.findMany({
      where: {
        skuId: { in: skuIds },
        cart: {
          createdAt: { gte: windowStart, lt: today }, 
          deletedAt: null,
          zohoSyncStatus: 'SUCCESS',
          warehouseId: { in: selectedWHIds }
        }
      },
      select: { skuId: true, qty: true }
    });

    console.log("Success! No errors.");
  } catch (error) {
    console.error('[TEST_ERROR]', error);
  }
}

testApi();

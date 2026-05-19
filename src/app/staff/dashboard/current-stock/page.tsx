import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { calculateConsumptionDenominator } from '@/lib/inventory/consumption';
import CurrentStockClient from '@/components/CurrentStockClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CurrentStockPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  if (sp.safe === '1') {
    return <div className="p-20 text-center font-bold text-red-600 bg-red-50 rounded-2xl border-2 border-red-200">SAFE MODE ACTIVE: Heavy dashboard components disabled to prevent overheating. <a href="?" className="underline ml-2">Exit Safe Mode</a></div>;
  }
  // --- CPD/DOI PRE-CALCULATION ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [warehouses, categories, brands, skus, inventory, recentSales] = await Promise.all([
    prisma.warehouse.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.brand.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.sku.findMany({ 
      where: { isActive: true, isUnlimited: false }, 
      select: { id: true, name: true, zohoBooksId2: true, categoryId: true, brandId: true, caseSize: true, unit: true },
      orderBy: { name: 'asc' }
    }),
    prisma.warehouseInventory.findMany({
      select: { skuId: true, warehouseId: true, qty: true, isOos: true }
    }),
    // Fetch successful cart items from last 30 days for CPD/Age calculation
    prisma.cartItem.findMany({
      where: {
        cart: {
          createdAt: { gte: thirtyDaysAgo },
          deletedAt: null,
          zohoSyncStatus: 'SUCCESS'
        }
      },
      select: {
        skuId: true,
        qty: true,
        cart: { select: { warehouseId: true, createdAt: true } }
      }
    })
  ]);

  // Aggregate Consumption Data
  // lookup[skuId][warehouseId] = { totalOut, activeDaysCount, firstSale }
  // lookup[skuId]['overall'] = { firstSale, activeDaysCount, totalOut }
  const consumptionData: Record<string, any> = {};

  recentSales.forEach(m => {
    const skuId = m.skuId;
    const whId = m.cart.warehouseId;
    const createdAt = m.cart.createdAt;
    const dayStr = createdAt.toISOString().split('T')[0];
    const isWithin7Days = createdAt >= sevenDaysAgo;
    const activeQty = Math.max(0, m.qty);

    if (!consumptionData[skuId]) {
      consumptionData[skuId] = { 
        overallFirstSale: createdAt,
        overallOut: 0,
        overallActiveDays: new Set<string>(),
        warehouses: {}
      };
    }

    const sku = consumptionData[skuId];
    
    // Update Overall Age (min createdAt)
    if (createdAt < sku.overallFirstSale) {
      sku.overallFirstSale = createdAt;
    }

    // Update Overall Outward (only if within 7 days)
    if (isWithin7Days) {
      sku.overallOut += activeQty;
      sku.overallActiveDays.add(dayStr);
    }

    // Update Warehouse specific data
    if (!sku.warehouses[whId]) {
      sku.warehouses[whId] = {
        firstSale: createdAt,
        out: 0,
        activeDays: new Set<string>()
      };
    }
    const wh = sku.warehouses[whId];
    if (createdAt < wh.firstSale) {
      wh.firstSale = createdAt;
    }
    if (isWithin7Days) {
      wh.out += activeQty;
      wh.activeDays.add(dayStr);
    }
  });

  // 3. Convert Sets to counts for client transmission and calculate base metrics
  Object.values(consumptionData).forEach((sku: any) => {
    sku.overallActiveDaysCount = sku.overallActiveDays.size;
    
    // Overall metrics
    const overallDenom = calculateConsumptionDenominator(
      sku.overallFirstSale,
      sku.overallActiveDaysCount
    );
    sku.overallCPD = sku.overallOut / overallDenom;

    delete sku.overallActiveDays;

    // Warehouse metrics
    Object.entries(sku.warehouses).forEach(([whId, wh]: [string, any]) => {
      wh.activeDaysCount = wh.activeDays.size;
      const whDenom = calculateConsumptionDenominator(
        wh.firstSale,
        wh.activeDaysCount
      );
      wh.cpd = wh.out / whDenom;
      delete wh.activeDays;
    });
  });

  // Transform inventory into a lookup object
  // inventoryLookup[skuId][warehouseId] = { qty, isOos }
  const inventoryLookup: Record<string, Record<string, { qty: number, isOos: boolean }>> = {};
  
  for (const inv of inventory) {
    if (!inventoryLookup[inv.skuId]) {
      inventoryLookup[inv.skuId] = {};
    }
    inventoryLookup[inv.skuId][inv.warehouseId] = {
      qty: inv.qty,
      isOos: inv.isOos
    };
  }

  // Map SKUs to include their inventory
  const items = skus.map(sku => ({
    ...sku,
    inventory: inventoryLookup[sku.id] || {}
  }));

  return (
    <CurrentStockClient 
      warehouses={warehouses} 
      categories={categories} 
      brands={brands}
      items={items}
      consumptionData={consumptionData}
      canSync={!!session.canRunSkuSync}
    />
  );
}

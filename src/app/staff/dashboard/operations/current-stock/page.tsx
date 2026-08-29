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
  
  const isMulti = sp.view === 'multi';
  const isWire = sp.view === 'wire';
  const isInverter = sp.view === 'inverter';
  const isAccessories = sp.view === 'accessories';
  const isSolar = !isMulti && !isWire && !isInverter && !isAccessories;

  // --- CPD/DOI PRE-CALCULATION ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const productSearchOptions = isWire 
    ? { categoryName: 'Wire & Cables' } 
    : isAccessories ? { categoryName: 'Solar Accessories' }
    : isSolar ? { categoryName: 'Solar Panel' } 
    : isInverter ? { categoryName: 'Inverter' } : {};

  const [warehouses, categories, brands, items, recentSales, thresholds] = await Promise.all([
    prisma.warehouse.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true, isSystemWarehouse: true },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({ 
      where: { active: true, status: 'Active' }, 
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' }
    }),
    prisma.brand.findMany({
      where: { active: true, status: 'Active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    import('@/lib/services/ProductLookupService').then(m => m.ProductLookupService.search('inventory', productSearchOptions)),
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
    }),
    prisma.stockAlertThreshold.findMany({
      where: { isEnabled: true },
      select: { warehouseId: true, skuId: true, minimumQty: true }
    })
  ]);

  // Aggregate Consumption Data
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

  // Transform thresholds into a lookup map
  const thresholdMap: Record<string, number> = {};
  for (const t of thresholds) {
    thresholdMap[`${t.warehouseId}_${t.skuId}`] = t.minimumQty;
  }

  if (isSolar) {
    // Dynamic import to avoid SSR issues if any, or just import at top
    const SolarPanelStockClient = (await import('@/components/SolarPanelStockClient')).default;
    return (
      <SolarPanelStockClient 
        warehouses={warehouses} 
        categories={categories} 
        brands={brands}
        items={items}
        canSync={!!session.canRunSkuSync}
      />
    );
  }

  if (isWire) {
    const WireCableStockClient = (await import('@/components/WireCableStockClient')).default;
    return (
      <WireCableStockClient
        warehouses={warehouses}
        categories={categories}
        brands={brands}
        items={items}
        canSync={!!session.canRunSkuSync}
      />
    );
  }

  if (isInverter) {
    const InverterStockClient = (await import('@/components/InverterStockClient')).default;
    return (
      <InverterStockClient
        warehouses={warehouses}
        categories={categories}
        brands={brands}
        items={items}
        canSync={!!session.canRunSkuSync}
      />
    );
  }

  if (isAccessories) {
    const SolarAccessoriesStockClient = (await import('@/components/SolarAccessoriesStockClient')).default;
    return (
      <SolarAccessoriesStockClient
        warehouses={warehouses}
        categories={categories}
        brands={brands}
        items={items}
        canSync={!!session.canRunSkuSync}
      />
    );
  }

  return (
    <CurrentStockClient 
      warehouses={warehouses} 
      categories={categories} 
      brands={brands}
      items={items}
      consumptionData={consumptionData}
      canSync={!!session.canRunSkuSync}
      thresholdMap={thresholdMap}
    />
  );
}

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { ProductLookupService } from '@/lib/services/ProductLookupService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const whParam = searchParams.getAll('warehouseId');

    // 1. Determine Date Range
    // Historical dates: 15 days, newest (yesterday) first
    const today = new Date();
    // Assuming Asia/Kolkata timezone implicitly for server if set, or we do manual offset
    // For MVP, using standard Date methods which use server local time
    today.setHours(0, 0, 0, 0);

    const historicalDates: string[] = [];
    for (let i = 1; i <= 15; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      historicalDates.push(d.toISOString().split('T')[0]); // YYYY-MM-DD local
    }
    
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 15);

    // 2. Fetch base data
    const [warehouses, activeCategories, products, config] = await Promise.all([
      prisma.warehouse.findMany({
        where: { 
          active: true, 
          isSystemWarehouse: false,
          ...(whParam.length > 0 ? { id: { in: whParam } } : {})
        },
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

    const selectedWHIds = warehouses.map(w => w.id);

    // Process Categories (resolve attributes including parent attributes)
    const categoryMap = new Map(activeCategories.map(c => [c.id, c]));
    const categories = activeCategories.map(cat => {
      const attrs = new Map();
      
      // Own attributes
      cat.productAttributes.forEach(pa => {
        if (pa.attribute.status === 'Active') {
          attrs.set(pa.attribute.id, pa.attribute);
        }
      });
      
      // Parent attributes
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.productAttributes.forEach(pa => {
          if (pa.attribute.status === 'Active') {
            attrs.set(pa.attribute.id, pa.attribute);
          }
        });
      }

      return {
        id: cat.id,
        name: cat.name,
        parentId: cat.parentId,
        attributes: Array.from(attrs.values()).map(a => ({
          id: a.id,
          attributeName: a.attributeName,
          attributeCode: a.attributeCode,
          dataType: a.dataType
        }))
      };
    });

    // 3. Resolve Product -> Attribute values
    // We need the productId for each sku to fetch attributes
    // ProductLookupService items represent SKUs. To get attributes we join Sku -> ProductVariant -> Product
    const skuIds = products.map(p => p.id); // ProductLookupService uses Sku.id as id
    const variants = await prisma.productVariant.findMany({
      where: { sku: { in: skuIds }, isActive: true },
      select: { sku: true, productId: true }
    });
    const productIds = variants.map(v => v.productId);
    
    const attrValues = await prisma.productAttributeValue.findMany({
      where: { productId: { in: productIds } },
      include: { attribute: { select: { id: true } } }
    });

    const skuToProductId = new Map(variants.map(v => [v.sku, v.productId]));
    const prodToAttrs = new Map<string, Record<string, string>>();
    attrValues.forEach(av => {
      if (!prodToAttrs.has(av.productId)) prodToAttrs.set(av.productId, {});
      prodToAttrs.get(av.productId)![av.attributeId] = av.value;
    });

    // 4 & 5. Historical closing balances & Current Stock
    const historyEvents = await prisma.inventoryHistory.findMany({
      where: {
        skuId: { in: skuIds },
        warehouseId: { in: selectedWHIds },
        createdAt: { gte: windowStart }
      },
      orderBy: { createdAt: 'asc' },
      select: { skuId: true, warehouseId: true, afterQty: true, createdAt: true }
    });

    // We'll calculate historical balance using carry-forward pattern
    const skuHistMap = new Map<string, Record<string, number | null>>();
    
    // Group events by skuId
    const eventsBySku = new Map<string, any[]>();
    historyEvents.forEach(ev => {
      if (!eventsBySku.has(ev.skuId)) eventsBySku.set(ev.skuId, []);
      eventsBySku.get(ev.skuId)!.push(ev);
    });

    // 6. Avg Daily Consumption (15 days)
    const cartItems = await prisma.cartItem.findMany({
      where: {
        skuId: { in: skuIds },
        cart: {
          createdAt: { gte: windowStart, lt: today }, // exactly 15 completed days
          deletedAt: null,
          zohoSyncStatus: 'SUCCESS',
          warehouseId: { in: selectedWHIds }
        }
      },
      select: { skuId: true, qty: true }
    });

    const consumptionMap = new Map<string, number>();
    cartItems.forEach(ci => {
      const qty = Math.max(0, ci.qty);
      consumptionMap.set(ci.skuId, (consumptionMap.get(ci.skuId) || 0) + qty);
    });

    // 7. Assemble Skus
    const skus = products.map(p => {
      const skuId = p.id;
      const productId = skuToProductId.get(skuId);
      const attrs = productId ? prodToAttrs.get(productId) || {} : {};
      
      const warehouseQty: Record<string, number> = {};
      let currentStock = 0;
      selectedWHIds.forEach(whId => {
        const qty = p.inventory?.[whId]?.qty || 0;
        warehouseQty[whId] = qty;
        currentStock += qty;
      });

      const events = eventsBySku.get(skuId) || [];
      const historicalStock: Record<string, number | null> = {};
      const warehouseHistoricalStock: Record<string, Record<string, number | null>> = {};
      
      selectedWHIds.forEach(whId => {
        warehouseHistoricalStock[whId] = {};
      });

      // Carry forward algorithm
      historicalDates.forEach(dateStr => {
        // Date str is YYYY-MM-DD. End of this day in local time
        const endOfDay = new Date(`${dateStr}T23:59:59.999`);
        
        let lastQty: number | null = null;
        
        // Find latest event at or before endOfDay across selected warehouses
        selectedWHIds.forEach(whId => {
          let whLastQty = p.inventory?.[whId]?.qty || 0; // fallback if no events ever
          let found = false;
          
          for (let i = events.length - 1; i >= 0; i--) {
            const ev = events[i];
            if (ev.warehouseId === whId && ev.createdAt <= endOfDay) {
              whLastQty = ev.afterQty;
              found = true;
              break;
            }
          }
          
          if (found || events.length === 0) {
            lastQty = (lastQty || 0) + whLastQty;
            warehouseHistoricalStock[whId][dateStr] = whLastQty;
          } else {
            warehouseHistoricalStock[whId][dateStr] = whLastQty; 
          }
        });
        
        historicalStock[dateStr] = lastQty;
      });

      const avgDailyConsumption = (consumptionMap.get(skuId) || 0) / 15;

      return {
        skuId,
        brandId: p.brandId,
        brandName: p.brand, // LegacyProductNormalizer maps brand name to `brand`
        categoryId: p.categoryId,
        unitShort: p.unitShort || p.unit,
        attrValues: attrs,
        warehouseQty,
        warehouseHistoricalStock,
        currentStock,
        historicalStock,
        avgDailyConsumption,
        productName: p.name || p.skuId
      };
    }).filter(sku => {
      // Hide if current stock is 0 AND movement is 0
      if (sku.currentStock !== 0) return true;
      if (sku.avgDailyConsumption !== 0) return true;
      
      const hasHistoricalMovement = Object.values(sku.historicalStock).some(qty => qty !== null && qty > 0);
      if (hasHistoricalMovement) return true;

      return false; // Hide completely dead SKU
    });

    return NextResponse.json({
      warehouses,
      categories,
      skus,
      historicalDates,
      config: {
        leadTimeDays: config.leadTimeDays,
        safetyFactor: config.safetyFactor
      }
    });

  } catch (error: any) {
    console.error('[ADV_STOCK_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch advanced stock data', msg: error.message, stack: error.stack }, { status: 500 });
  }
}

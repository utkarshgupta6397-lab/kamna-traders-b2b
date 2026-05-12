import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { calculateConsumptionDenominator } from '@/lib/inventory/consumption';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const skuId = searchParams.get('skuId');

  if (!skuId) {
    return NextResponse.json({ error: 'skuId is required' }, { status: 400 });
  }

  // Calculate the date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  try {
    const sku = await prisma.sku.findUnique({
      where: { id: skuId },
      include: {
        inventory: true
      }
    });

    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }

    // 1. Fetch Outward Movements (Sales only) from CartItems
    const cartItems = await prisma.cartItem.findMany({
      where: {
        skuId,
        cart: {
          createdAt: { gte: sevenDaysAgo },
          deletedAt: null,
          zohoSyncStatus: 'SUCCESS'
        }
      },
      include: {
        cart: {
          select: { warehouseId: true, warehouse: { select: { name: true } }, createdAt: true }
        }
      },
      orderBy: { cart: { createdAt: 'asc' } }
    });

    // 2. Fetch Inward Movements (GRN, Adjustments > 0) from InventoryHistory
    // Exclude 'Dispatch' related records to avoid double counting with cartItems
    const adjustments = await prisma.inventoryHistory.findMany({
      where: {
        skuId,
        createdAt: { gte: sevenDaysAgo },
        qtyChange: { gt: 0 },
        NOT: { remarks: { startsWith: 'Dispatch' } }
      },
      include: {
        warehouse: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // 3. Fetch Earliest Sale for Denominator (last 30 days for performance/consistency)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const firstSales = await prisma.cartItem.findMany({
      where: {
        skuId,
        cart: {
          createdAt: { gte: thirtyDaysAgo },
          deletedAt: null,
          zohoSyncStatus: 'SUCCESS'
        }
      },
      select: {
        cart: { select: { warehouseId: true, createdAt: true } }
      },
      orderBy: { cart: { createdAt: 'asc' } }
    });

    const earliestOverall = firstSales[0]?.cart.createdAt;
    const earliestByWH: Record<string, Date> = {};
    firstSales.forEach(fs => {
      if (!earliestByWH[fs.cart.warehouseId]) {
        earliestByWH[fs.cart.warehouseId] = fs.cart.createdAt;
      }
    });

    // 4. Aggregate by Date + Warehouse
    const aggregated: Record<string, any> = {};
    const totalsByWarehouse: Record<string, { in: number, out: number, avgDailyOut: number }> = {};
    let totalIn = 0;
    let totalOut = 0;
    const outwardDatesOverall = new Set<string>();
    const outwardDatesByWH: Record<string, Set<string>> = {};

    // Process Outward (CartItems)
    cartItems.forEach(item => {
      const dateKey = item.cart.createdAt.toISOString().split('T')[0];
      const whId = item.cart.warehouseId;
      const key = `${dateKey}_${whId}`;
      const qty = Math.max(0, item.qty);

      if (!totalsByWarehouse[whId]) {
        totalsByWarehouse[whId] = { in: 0, out: 0, avgDailyOut: 0 };
        outwardDatesByWH[whId] = new Set();
      }

      totalsByWarehouse[whId].out += qty;
      totalOut += qty;
      outwardDatesOverall.add(dateKey);
      outwardDatesByWH[whId].add(dateKey);

      if (!aggregated[key]) {
        aggregated[key] = {
          id: key,
          date: item.cart.createdAt.toISOString(),
          warehouseId: whId,
          warehouseName: item.cart.warehouse.name,
          inward: 0, outward: 0, net: 0, afterQty: 0 
        };
      }
      aggregated[key].outward += qty;
      aggregated[key].net -= qty;
    });

    // Process Inward (Adjustments)
    adjustments.forEach(adj => {
      const dateKey = adj.createdAt.toISOString().split('T')[0];
      const whId = adj.warehouseId;
      const key = `${dateKey}_${whId}`;
      const qty = adj.qtyChange;

      if (!totalsByWarehouse[whId]) {
        totalsByWarehouse[whId] = { in: 0, out: 0, avgDailyOut: 0 };
        outwardDatesByWH[whId] = new Set();
      }

      totalsByWarehouse[whId].in += qty;
      totalIn += qty;

      if (!aggregated[key]) {
        aggregated[key] = {
          id: key,
          date: adj.createdAt.toISOString(),
          warehouseId: whId,
          warehouseName: adj.warehouse.name,
          inward: 0, outward: 0, net: 0, afterQty: 0 
        };
      }
      aggregated[key].inward += qty;
      aggregated[key].net += qty;
      // We take the latest afterQty for that day/wh
      aggregated[key].afterQty = adj.afterQty;
    });

    // Finalize movements
    const movements = Object.values(aggregated).sort((a: any, b: any) => b.date.localeCompare(a.date));

    Object.keys(totalsByWarehouse).forEach(whId => {
      const denom = calculateConsumptionDenominator(
        earliestByWH[whId],
        outwardDatesByWH[whId].size
      );
      totalsByWarehouse[whId].avgDailyOut = totalsByWarehouse[whId].out / denom;
    });

    const overallDenom = calculateConsumptionDenominator(
      earliestOverall,
      outwardDatesOverall.size
    );
    const overallAvgDailyOut = totalOut / overallDenom;
    const overallTotals = {
        in: totalIn,
        out: totalOut,
        avgDailyOut: overallAvgDailyOut,
        denominator: overallDenom
    };

    return NextResponse.json({
      sku: {
        id: sku.id,
        name: sku.name,
        totalStock: sku.inventory.reduce((sum, inv) => sum + inv.qty, 0),
        inventoryByWarehouse: sku.inventory.reduce((acc, inv) => {
          acc[inv.warehouseId] = { qty: inv.qty };
          return acc;
        }, {} as Record<string, { qty: number }>),
        unit: sku.unit
      },
      movements,
      totalsByWarehouse,
      overallTotals,
      deployment: {
        version: "v1.2.0-inventory-unification",
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    });

  } catch (error) {
    console.error('[SKU_INSIGHTS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

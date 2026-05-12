import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

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
    // Fetch all inventory history for this SKU in the last 7 days
    const history = await prisma.inventoryHistory.findMany({
      where: {
        skuId,
        createdAt: {
          gte: sevenDaysAgo,
        }
      },
      include: {
        warehouse: {
          select: { name: true }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Aggregate movements by Date + Warehouse
    const aggregated: Record<string, any> = {};
    const totalsByWarehouse: Record<string, { in: number, out: number, avgDailyOut: number }> = {};
    let totalIn = 0;
    let totalOut = 0;

    history.forEach(record => {
      const dateKey = record.createdAt.toISOString().split('T')[0];
      const whId = record.warehouseId;
      const key = `${dateKey}_${whId}`;
      const qty = record.qtyChange;

      if (!totalsByWarehouse[whId]) {
        totalsByWarehouse[whId] = { in: 0, out: 0, avgDailyOut: 0 };
      }
      if (qty > 0) {
        totalsByWarehouse[whId].in += qty;
        totalIn += qty;
      } else if (qty < 0) {
        totalsByWarehouse[whId].out += Math.abs(qty);
        totalOut += Math.abs(qty);
      }

      if (!aggregated[key]) {
        aggregated[key] = {
          id: key,
          date: record.createdAt.toISOString(),
          warehouseId: whId,
          warehouseName: record.warehouse.name,
          inward: 0,
          outward: 0,
          net: 0,
          afterQty: record.afterQty
        };
      }

      if (qty > 0) aggregated[key].inward += qty;
      else if (qty < 0) aggregated[key].outward += Math.abs(qty);
      
      aggregated[key].net += qty;
      aggregated[key].afterQty = record.afterQty; 
    });

    const movements = Object.values(aggregated);

    // Calculate Average Daily Outward (over 7 days)
    Object.keys(totalsByWarehouse).forEach(whId => {
      totalsByWarehouse[whId].avgDailyOut = totalsByWarehouse[whId].out / 7;
    });
    const overallAvgDailyOut = totalOut / 7;

    return NextResponse.json({
      skuId,
      movements,
      totalsByWarehouse,
      overallTotals: {
        in: totalIn,
        out: totalOut,
        avgDailyOut: overallAvgDailyOut
      }
    });

  } catch (error) {
    console.error('[SKU_INSIGHTS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

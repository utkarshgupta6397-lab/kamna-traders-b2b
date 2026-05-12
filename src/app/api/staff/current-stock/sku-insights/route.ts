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
    // Determine the first meaningful outward movement date for denominator logic
    // We fetch this to handle new SKUs correctly
    const [firstOverallSale, firstWarehouseSales] = await Promise.all([
      prisma.inventoryHistory.findFirst({
        where: { skuId, qtyChange: { lt: 0 } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      }),
      prisma.inventoryHistory.groupBy({
        by: ['warehouseId'],
        where: { skuId, qtyChange: { lt: 0 } },
        _min: { createdAt: true }
      })
    ]);

    const firstSaleWHMap: Record<string, Date> = {};
    firstWarehouseSales.forEach(ws => {
      if (ws._min.createdAt) {
        firstSaleWHMap[ws.warehouseId] = ws._min.createdAt;
      }
    });

    const now = new Date();

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
    
    // Track unique dates with outward movement
    const outwardDatesOverall = new Set<string>();
    const outwardDatesByWarehouse: Record<string, Set<string>> = {};

    history.forEach(record => {
      const dateKey = record.createdAt.toISOString().split('T')[0];
      const whId = record.warehouseId;
      const key = `${dateKey}_${whId}`;
      const qty = record.qtyChange;

      if (!totalsByWarehouse[whId]) {
        totalsByWarehouse[whId] = { in: 0, out: 0, avgDailyOut: 0 };
        outwardDatesByWarehouse[whId] = new Set();
      }

      if (qty > 0) {
        totalsByWarehouse[whId].in += qty;
        totalIn += qty;
      } else if (qty < 0) {
        totalsByWarehouse[whId].out += Math.abs(qty);
        totalOut += Math.abs(qty);
        outwardDatesOverall.add(dateKey);
        outwardDatesByWarehouse[whId].add(dateKey);
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

    // Helper to determine denominator
    const calculateDenominator = (firstDate: Date | null | undefined, activeDatesCount: number) => {
      if (!firstDate) return 7;
      const msDiff = now.getTime() - firstDate.getTime();
      const ageInDays = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      
      if (ageInDays >= 7) return 7;
      return Math.max(1, activeDatesCount); // Use distinct active days for new SKUs
    };

    // Calculate Average Daily Outward using refined denominator logic
    Object.keys(totalsByWarehouse).forEach(whId => {
      const whDenominator = calculateDenominator(
        firstSaleWHMap[whId], 
        outwardDatesByWarehouse[whId].size
      );
      totalsByWarehouse[whId].avgDailyOut = totalsByWarehouse[whId].out / whDenominator;
    });
    
    const overallDenominator = calculateDenominator(
      firstOverallSale?.createdAt,
      outwardDatesOverall.size
    );
    const overallAvgDailyOut = totalOut / overallDenominator;

    return NextResponse.json({
      skuId,
      movements,
      totalsByWarehouse,
      overallTotals: {
        in: totalIn,
        out: totalOut,
        avgDailyOut: overallAvgDailyOut,
        denominator: overallDenominator
      }
    });

  } catch (error) {
    console.error('[SKU_INSIGHTS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

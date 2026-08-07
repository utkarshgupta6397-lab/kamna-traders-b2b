import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    // We get the set of all mapped variant SKUs.
    const mappedSkuSet = new Set(
      (await prisma.productVariant.findMany({ select: { sku: true } })).map((v) => v.sku)
    );

    const getRowCounts = async (model: any) => {
      // Group by skuId to get counts
      const groups = await model.groupBy({
        by: ['skuId'],
        _count: { skuId: true }
      });
      
      let total = 0;
      let mappable = 0;
      for (const group of groups) {
        if (!group.skuId) continue;
        const count = group._count.skuId;
        total += count;
        if (mappedSkuSet.has(group.skuId)) {
          mappable += count;
        }
      }
      return { mappable, total };
    };

    const [
      warehouseInventory,
      cartItems,
      dcrSerials,
      transferItems
    ] = await Promise.all([
      getRowCounts(prisma.warehouseInventory),
      getRowCounts(prisma.cartItem),
      getRowCounts(prisma.dcrSerial),
      getRowCounts(prisma.transferItem),
    ]);

    return NextResponse.json({
      preview: {
        warehouseInventory,
        cartItems,
        dcrSerials,
        transferItems
      },
      message: 'Preview only. No execution.'
    });
  } catch (error: any) {
    console.error('Backfill Preview API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

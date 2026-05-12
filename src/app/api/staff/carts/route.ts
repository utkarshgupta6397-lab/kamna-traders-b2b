import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const skip = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const warehouseId = searchParams.get('warehouseId') || '';
    const staffId = searchParams.get('staffId') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Prisma.CartWhereInput = {};

    // 1. Search
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { dispatchSlipNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 2. Filters
    if (warehouseId) where.warehouseId = warehouseId;
    if (staffId) where.staffId = staffId;

    // 3. Date Range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // 4. Optimized Query
    const [totalCount, carts] = await Promise.all([
      prisma.cart.count({ where }),
      prisma.cart.findMany({
        where,
        select: {
          id: true,
          customerName: true,
          createdAt: true,
          dispatchSlipNumber: true,
          zohoSalesorderNumber: true,
          zohoSalesorderId: true,
          deletedAt: true,
          warehouse: { select: { name: true } },

          staff: { select: { name: true } },
          items: {
            select: {
              qty: true,
              sku: { select: { price: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // 5. Compute totals for the slice (Lightweight since items are selected minimally)
    const enrichedCarts = carts.map(cart => {
      let totalQty = 0;
      let totalValue = 0;
      cart.items.forEach(item => {
        totalQty += item.qty;
        totalValue += item.qty * (item.sku?.price || 0);
      });

      return {
        id: cart.id,
        customerName: cart.customerName,
        createdAt: cart.createdAt,
        slipNumber: cart.dispatchSlipNumber || cart.id,
        zohoSalesorderNumber: cart.zohoSalesorderNumber,
        zohoSalesorderId: cart.zohoSalesorderId,
        warehouseName: cart.warehouse?.name || 'Unknown',
        staffName: cart.staff?.name || 'Unknown',
        deletedAt: cart.deletedAt,
        itemCount: cart.items.length,
        totalQty,
        totalValue,
      };
    });

    return NextResponse.json({
      carts: enrichedCarts,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error('[CARTS_API_ERROR]', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    if (q.length < 2) {
      return NextResponse.json({ orders: [] });
    }

    const orders = await prisma.solarOrder.findMany({
      where: {
        isCancelled: false,
        OR: [
          { customerName: { contains: q, mode: 'insensitive' } },
          { orderNumber: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true
      },
      take: 10, // Limit to top 10 matches for performance
      orderBy: { orderDate: 'desc' }
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error searching orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

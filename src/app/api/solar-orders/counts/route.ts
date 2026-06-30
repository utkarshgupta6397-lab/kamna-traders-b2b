import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const counts = await prisma.solarOrder.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const formattedCounts = counts.reduce((acc: any, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {});

    const total = counts.reduce((sum, curr) => sum + curr._count.id, 0);

    return NextResponse.json({
      all: total,
      draft: formattedCounts['DRAFT'] || 0,
      pendingApproval: formattedCounts['PENDING_APPROVAL'] || 0,
      execution: formattedCounts['EXECUTION'] || 0,
      completed: formattedCounts['COMPLETED'] || 0,
      rejected: formattedCounts['REJECTED'] || 0,
    });
  } catch (error) {
    console.error('[SolarOrders Counts Error]', error);
    return NextResponse.json({ error: 'Failed to fetch solar orders counts' }, { status: 500 });
  }
}

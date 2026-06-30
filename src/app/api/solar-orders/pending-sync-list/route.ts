import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ordersToSync = await prisma.solarOrder.findMany({
      where: {
        zohoBooksCustomerId: { not: null },
        pendingAmount: { gt: 0 }
      },
      select: { id: true },
      orderBy: { orderDate: 'desc' }
    });

    return NextResponse.json({ ids: ordersToSync.map(o => o.id) });
  } catch (error: any) {
    console.error('[Pending Sync List Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

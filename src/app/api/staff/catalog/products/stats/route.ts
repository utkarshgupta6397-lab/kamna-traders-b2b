import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const counts = await prisma.product.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    });

    const stats = {
      total: 0,
      Draft: 0,
      'Approval Pending': 0,
      Active: 0,
      Inactive: 0,
      Archived: 0,
    };

    for (const item of counts) {
      stats[item.status as keyof typeof stats] = item._count._all;
      stats.total += item._count._all;
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products/stats error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'salesmen' || type === 'calling') {
      const users = await prisma.user.findMany({
        where: { role: 'STAFF', active: true },
        select: { id: true, name: true }
      });
      return NextResponse.json(users);
    }
    
    if (type === 'subvendor') {
      const vendors = await prisma.subVendor.findMany({
        where: { active: true },
        select: { id: true, name: true }
      });
      return NextResponse.json(vendors);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('[Assignees API Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch assignees' }, { status: 500 });
  }
}

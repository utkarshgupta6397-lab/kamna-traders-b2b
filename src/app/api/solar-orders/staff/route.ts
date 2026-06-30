import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_create) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const staff = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('[SolarOrders Staff GET Error]', error);
    return NextResponse.json({ error: 'Failed to fetch staff list' }, { status: 500 });
  }
}

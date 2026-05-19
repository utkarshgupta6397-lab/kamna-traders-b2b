import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || (!session.canManageZoneMappings && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { active: true, isSystemWarehouse: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });

    const categories = await prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ warehouses, categories });
  } catch (err) {
    console.error('Failed to fetch zone mapping metadata:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

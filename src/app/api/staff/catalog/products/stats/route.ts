import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [total, goods, services, active, pending, archived, trackInventory, trackSerials] = await Promise.all([
      prisma.product.count({ where: { parentProductId: null } }),
      prisma.product.count({ where: { type: 'Goods', parentProductId: null } }),
      prisma.product.count({ where: { type: 'Service', parentProductId: null } }),
      prisma.product.count({ where: { status: 'Active', parentProductId: null } }),
      prisma.product.count({ where: { status: 'Approval Pending', parentProductId: null } }),
      prisma.product.count({ where: { status: 'Archived', parentProductId: null } }),
      prisma.product.count({ where: { variants: { some: { trackInventory: true } }, parentProductId: null } }),
      prisma.product.count({ where: { variants: { some: { trackSerials: true } }, parentProductId: null } }),
    ]);

    return NextResponse.json({
      total,
      goods,
      services,
      active,
      pending,
      archived,
      trackInventory,
      trackSerials
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products/stats error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

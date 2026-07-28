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
      prisma.product.count(),
      prisma.product.count({ where: { type: 'Goods' } }),
      prisma.product.count({ where: { type: 'Service' } }),
      prisma.product.count({ where: { status: 'Active' } }),
      prisma.product.count({ where: { status: 'Approval Pending' } }),
      prisma.product.count({ where: { status: 'Archived' } }),
      prisma.product.count({ where: { variants: { some: { trackInventory: true } } } }),
      prisma.product.count({ where: { variants: { some: { trackSerials: true } } } }),
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

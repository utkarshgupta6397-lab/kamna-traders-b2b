import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildProductWhereClause } from '@/lib/services/ProductFilterService';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const where = buildProductWhereClause(searchParams);

    const [total, goods, services, active, pending, archived, trackInventory, trackSerials] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.count({ where: { ...where, type: 'Goods' } }),
      prisma.product.count({ where: { ...where, type: 'Service' } }),
      prisma.product.count({ where: { ...where, status: 'Active' } }),
      prisma.product.count({ where: { ...where, status: 'Approval Pending' } }),
      prisma.product.count({ where: { ...where, status: 'Archived' } }),
      prisma.product.count({ where: { ...where, variants: { some: { trackInventory: true } } } }),
      prisma.product.count({ where: { ...where, variants: { some: { trackSerials: true } } } }),
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

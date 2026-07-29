import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const dataType = searchParams.get('dataType') || 'ALL';
    const statusFilter = searchParams.get('status') || 'ALL';

    const where: any = {};
    if (statusFilter !== 'ALL') where.status = statusFilter;
    if (dataType !== 'ALL') where.dataType = dataType;
    if (category) {
      where.categories = {
        some: { categoryId: category }
      };
    }
    if (search) {
      where.OR = [
        { attributeName: { contains: search, mode: 'insensitive' } },
        { attributeCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Parallel counts
    const [total, active, inactive, mandatory] = await Promise.all([
      prisma.productAttribute.count({ where }),
      prisma.productAttribute.count({ where: { ...where, status: 'Active' } }),
      prisma.productAttribute.count({ where: { ...where, status: 'Inactive' } }),
      prisma.productAttribute.count({ where: { ...where, mandatory: true } }),
    ]);

    return NextResponse.json({
      total,
      active,
      inactive,
      mandatory
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/product-attributes/stats error:`, error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

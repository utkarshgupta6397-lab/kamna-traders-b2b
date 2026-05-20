import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.canManageUnlimitedSkus)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() || '';
  const categoryId = searchParams.get('categoryId');
  const brandId = searchParams.get('brandId');
  const unlimitedFilter = searchParams.get('unlimitedFilter'); // 'ALL' | 'UNLIMITED' | 'NORMAL'
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '25');
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (categoryId && categoryId !== 'ALL') {
    const ids = categoryId.split(',').filter(Boolean);
    if (ids.length > 0) {
      where.categoryId = { in: ids };
    }
  }

  if (brandId && brandId !== 'ALL') {
    where.brandId = brandId;
  }

  if (unlimitedFilter && unlimitedFilter !== 'ALL') {
    const filters = unlimitedFilter.split(',').map(f => f.trim()).filter(Boolean);
    if (filters.includes('UNLIMITED') && !filters.includes('NORMAL')) {
      where.isUnlimited = true;
    } else if (filters.includes('NORMAL') && !filters.includes('UNLIMITED')) {
      where.isUnlimited = false;
    }
  }

  try {
    const [total, skus] = await Promise.all([
      prisma.sku.count({ where }),
      prisma.sku.findMany({
        where,
        select: {
          id: true,
          name: true,
          isUnlimited: true,
          updatedAt: true,
          category: { select: { name: true } },
          updatedBy: { select: { name: true } }
        },
        orderBy: [
          { isUnlimited: 'desc' }, // Show unlimited first by default or sort by name? Let's just sort by name
          { name: 'asc' }
        ],
        skip,
        take: limit,
      })
    ]);

    // Also get KPI stats
    const stats = await prisma.$transaction([
      prisma.sku.count({ where: { isActive: true } }),
      prisma.sku.count({ where: { isActive: true, isUnlimited: true } })
    ]);

    return NextResponse.json({
      skus,
      total,
      page,
      limit,
      stats: {
        totalSkus: stats[0],
        unlimitedSkus: stats[1]
      }
    });
  } catch (error) {
    console.error('Failed to fetch unlimited SKUs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

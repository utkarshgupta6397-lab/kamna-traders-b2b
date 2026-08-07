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

    // Since we need to join category names, we group by categoryId,
    // but Prisma's groupBy doesn't allow including relations directly.
    // However, we can query all categories and use a _count where condition.
    
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            products: {
              where: where
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const activeCategories = categories.map(c => ({
      id: c.id,
      name: c.name,
      count: c._count.products
    })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

    return NextResponse.json(activeCategories);
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products/category-stats error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

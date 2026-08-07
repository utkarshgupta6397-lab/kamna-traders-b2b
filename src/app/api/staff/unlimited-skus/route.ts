import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { CatalogResolver } from '@/lib/services/CatalogResolver';

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

  try {
    let items = await CatalogResolver.getAllItems();

    if (search) {
      const lowerSearch = search.toLowerCase();
      items = items.filter(i => 
        (i.id?.toLowerCase().includes(lowerSearch)) || 
        (i.name?.toLowerCase().includes(lowerSearch))
      );
    }

    if (categoryId && categoryId !== 'ALL') {
      const ids = categoryId.split(',').filter(Boolean);
      if (ids.length > 0) {
        items = items.filter(i => i.categoryId && ids.includes(i.categoryId));
      }
    }

    if (brandId && brandId !== 'ALL') {
      items = items.filter(i => i.brandId === brandId);
    }

    if (unlimitedFilter && unlimitedFilter !== 'ALL') {
      const filters = unlimitedFilter.split(',').map(f => f.trim()).filter(Boolean);
      if (filters.includes('UNLIMITED') && !filters.includes('NORMAL')) {
        items = items.filter(i => i.isUnlimited);
      } else if (filters.includes('NORMAL') && !filters.includes('UNLIMITED')) {
        items = items.filter(i => !i.isUnlimited);
      }
    }

    const total = items.length;

    items.sort((a, b) => {
      if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    const paginatedItems = items.slice(skip, skip + limit);

    const categories = await prisma.category.findMany();
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    const skus = paginatedItems.map(i => ({
      id: i.id,
      name: i.name,
      isUnlimited: i.isUnlimited,
      updatedAt: new Date(),
      category: { name: i.categoryId ? catMap.get(i.categoryId) : null },
      updatedBy: { name: 'System' }
    }));

    const allItems = await CatalogResolver.getAllItems();
    const activeItems = allItems.filter(i => i.isActive);

    return NextResponse.json({
      skus,
      total,
      page,
      limit,
      stats: {
        totalSkus: activeItems.length,
        unlimitedSkus: activeItems.filter(i => i.isUnlimited).length
      }
    });
  } catch (error) {
    console.error('Failed to fetch unlimited SKUs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

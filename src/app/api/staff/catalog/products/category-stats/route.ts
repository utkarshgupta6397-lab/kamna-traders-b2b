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
    const status = searchParams.get('status') || 'ALL';
    const type = searchParams.get('type') || '';
    const brandId = searchParams.get('brandId') || '';
    const manufacturerId = searchParams.get('manufacturerId') || '';
    const trackInventory = searchParams.get('trackInventory');
    const trackSerials = searchParams.get('trackSerials');

    const where: any = {
      parentProductId: null
    };

    if (status !== 'ALL') where.status = status;
    if (type && type !== 'ALL') where.type = type;
    if (brandId && brandId !== 'ALL') where.brandId = brandId;
    if (manufacturerId && manufacturerId !== 'ALL') where.manufacturerId = manufacturerId;

    if (trackInventory === 'true') { where.variants = { some: { trackInventory: true } }; }
    if (trackInventory === 'false') { where.variants = { some: { trackInventory: false } }; }
    if (trackSerials === 'true') { where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: true } }; }
    if (trackSerials === 'false') { where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: false } }; }

    if (search) {
      const tokens = search.trim().split(/\\s+/).filter(t => t.length > 0);
      if (tokens.length > 0) {
        where.AND = tokens.map((token: string) => ({
          OR: [
            { name: { contains: token, mode: 'insensitive' } },
            { code: { contains: token, mode: 'insensitive' } },
            { brand: { name: { contains: token, mode: 'insensitive' } } },
            { manufacturer: { name: { contains: token, mode: 'insensitive' } } },
            { category: { name: { contains: token, mode: 'insensitive' } } },
            { variants: { some: { sku: { contains: token, mode: 'insensitive' } } } },
          ]
        }));
      }
    }

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

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: familyId } = await params;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('q') || '';

  try {
    const family = await prisma.product.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        type: true,
        categoryId: true,
        brandId: true,
        manufacturerId: true,
        hsnCodeId: true,
        taxRateId: true,
        unitId: true,
      }
    });

    if (!family) {
      return NextResponse.json({ error: 'Product Family not found' }, { status: 404 });
    }

    // Build the query to find eligible orphan products
    const orphans = await prisma.product.findMany({
      where: {
        status: 'Active',
        isVariantProduct: false,
        parentProductId: null,
        catalogType: 'PRODUCT',
        OR: search ? [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } }
        ] : undefined
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        manufacturer: { select: { name: true } },
        variants: {
          select: {
            sku: true,
            purchasePrice: true,
            sellingPrice: true,
            trackInventory: true,
            trackSerials: true
          },
          take: 1
        },
        _count: {
          select: { variants: true }
        }
      }
    });

    // Map to a friendlier format for the frontend and exclude products with > 1 variant
    const mappedOrphans = orphans
      .filter(o => o._count.variants <= 1)
      .map(o => ({
      id: o.id,
      code: o.code,
      name: o.name,
      category: o.category?.name || '-',
      brand: o.brand?.name || '-',
      manufacturer: o.manufacturer?.name || '-',
      sku: o.variants[0]?.sku || '',
      purchasePrice: o.variants[0]?.purchasePrice || 0,
      sellingPrice: o.variants[0]?.sellingPrice || 0,
    }));

    return NextResponse.json(mappedOrphans);
  } catch (error) {
    console.error('[EligibleOrphans] Error fetching orphans:', error);
    return NextResponse.json({ error: 'Failed to fetch eligible products' }, { status: 500 });
  }
}

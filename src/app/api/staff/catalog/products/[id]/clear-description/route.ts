import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  
  if (!session || (session.role !== 'ADMIN' && !session.catalog_products_modify)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const family = await prisma.product.findUnique({
      where: { id },
      include: {
        variantProducts: {
          select: { id: true, description: true }
        }
      }
    });

    if (!family || family.catalogType !== 'PRODUCT_FAMILY') {
      return NextResponse.json({ error: 'Product family not found' }, { status: 404 });
    }

    const affectedProductIds = family.variantProducts.map(p => p.id);

    if (affectedProductIds.length === 0) {
      return NextResponse.json({ variants: [] });
    }

    // 1. Update ERP descriptions
    await prisma.product.updateMany({
      where: { id: { in: affectedProductIds } },
      data: { description: null }
    });

    // 2. Log Audit
    await prisma.masterDataHistory.create({
      data: {
        entityType: 'Product',
        entityId: id,
        action: 'UPDATED',
        fieldName: 'description',
        remarks: 'Bulk cleared descriptions & initiated Zoho sync',
        performedById: session.userId,
        productId: id
      }
    });

    // 3. Fetch variants for sync
    const variants = await prisma.productVariant.findMany({
      where: { productId: { in: affectedProductIds } },
      select: { 
        id: true, 
        sku: true, 
        zohoBookItemId: true, 
        productId: true 
      }
    });

    return NextResponse.json({ variants });
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products/${id}/clear-description error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

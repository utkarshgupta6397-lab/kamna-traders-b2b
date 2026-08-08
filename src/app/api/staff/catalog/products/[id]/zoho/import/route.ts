import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ZohoProductService } from '@/lib/services/zoho-books';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.catalog_products_sync)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    let { zohoBooksItemId, variantId } = body;

    if (!zohoBooksItemId) {
      return NextResponse.json({ error: 'zohoBooksItemId is required' }, { status: 400 });
    }

    if (!variantId) {
      const defaultVariant = await prisma.productVariant.findFirst({ where: { productId: id, isDefault: true } });
      if (!defaultVariant) {
        return NextResponse.json({ error: 'No default variant found for product' }, { status: 404 });
      }
      variantId = defaultVariant.id;
    }

    const result = await ZohoProductService.importItem(variantId, zohoBooksItemId, session.userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products/${id}/zoho/import error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

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

    // 1. Validate itemId exists in Zoho
    const item = await ZohoProductService.fetchItem(zohoBooksItemId);
    if (!item) {
      return NextResponse.json({ error: 'Item not found in Zoho Books' }, { status: 404 });
    }

    // 2. Check uniqueness
    const existing = await prisma.productVariant.findUnique({ where: { zohoBookItemId: zohoBooksItemId } });
    if (existing && existing.id !== variantId) {
      return NextResponse.json({ error: 'This Zoho Item ID is already linked to another variant' }, { status: 400 });
    }

    // 3. Update ProductVariant
    const updatedVariant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        zohoBookItemId: zohoBooksItemId,
        zohoSyncStatus: 'NEVER_SYNCED',
        zohoSyncHash: null, // Force full sync on next save
      }
    });

    return NextResponse.json(updatedVariant);
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products/${id}/zoho/link error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

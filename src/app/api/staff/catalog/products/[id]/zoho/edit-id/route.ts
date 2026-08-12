import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasModify = session.role === 'ADMIN' || session['catalog_products_modify'];
  if (!hasModify) {
    return NextResponse.json({ error: 'Permission Denied: Requires catalog_products_modify access' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    let { zohoBooksItemId, variantId } = body;

    if (!zohoBooksItemId) {
      return NextResponse.json({ error: 'zohoBooksItemId is required' }, { status: 400 });
    }

    if (!/^\d+$/.test(zohoBooksItemId)) {
      return NextResponse.json({ error: 'zohoBooksItemId must contain only digits' }, { status: 400 });
    }

    if (!variantId) {
      const defaultVariant = await prisma.productVariant.findFirst({ where: { productId: id, isDefault: true } });
      if (!defaultVariant) {
        return NextResponse.json({ error: 'No default variant found for product' }, { status: 404 });
      }
      variantId = defaultVariant.id;
    }

    // Check if another variant is using this ID
    const existing = await prisma.productVariant.findUnique({ where: { zohoBookItemId: zohoBooksItemId } });
    if (existing && existing.id !== variantId) {
      return NextResponse.json({ error: 'This Zoho Item ID is already linked to another variant' }, { status: 400 });
    }

    const updatedVariant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        zohoBookItemId: zohoBooksItemId,
        zohoSyncStatus: 'NEVER_SYNCED', // Reset sync error
        zohoLastSyncError: null,
        zohoSyncHash: null, // Force full sync on next save
      }
    });

    return NextResponse.json(updatedVariant);
  } catch (error: any) {
    console.error(`[API] PATCH /api/staff/catalog/products/${id}/zoho/edit-id error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

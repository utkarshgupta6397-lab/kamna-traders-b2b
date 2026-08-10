import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMasterAuditLog } from '@/lib/master-data-service';
import { CatalogResolver } from '@/lib/services/CatalogResolver';
import { AuditPayloadBuilder } from '@/lib/services/audit-payload-builder';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: true }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Permission check
    const modifyPerm = 'catalog_products_modify';
    const createPerm = 'catalog_products_create';
    const hasModify = session.role === 'ADMIN' || session[modifyPerm];
    const hasCreate = session.role === 'ADMIN' || session[createPerm];

    if (!hasModify) {
      if (!(hasCreate && product.status === 'Draft' && product.createdById === session.userId)) {
        return NextResponse.json({ error: `Permission Denied: Requires ${modifyPerm} or owner Create access for Drafts` }, { status: 403 });
      }
    }

    if (product.status === 'Archived') {
      return NextResponse.json({ error: 'Archived products cannot be modified' }, { status: 400 });
    }

    const defaultVariant = product.variants.find(v => v.isDefault);
    if (!defaultVariant) {
      return NextResponse.json({ error: 'Default variant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { purchasePrice, sellingPrice, trackInventory, trackSerials } = body;

    const updateData: any = {};
    if (purchasePrice !== undefined) updateData.purchasePrice = parseFloat(purchasePrice) || 0;
    if (sellingPrice !== undefined) updateData.sellingPrice = parseFloat(sellingPrice) || 0;
    if (trackInventory !== undefined) updateData.trackInventory = trackInventory === true;
    if (trackSerials !== undefined) updateData.trackSerials = trackSerials === true;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(defaultVariant);
    }

    const updatedVariant = await prisma.productVariant.update({
      where: { id: defaultVariant.id },
      data: updateData,
    });

    // Write audit log
    await createMasterAuditLog({
      entityType: 'Product',
      entityId: id,
      action: 'UPDATED',
      fieldName: 'Default Variant',
      previousValue: JSON.stringify(AuditPayloadBuilder.buildVariantSummary(defaultVariant)),
      newValue: JSON.stringify(AuditPayloadBuilder.buildVariantSummary(updatedVariant)),
      remarks: 'Updated pricing/inventory settings',
      userId: session.userId,
      productId: id,
    } as any);

    CatalogResolver.invalidateCache();

    return NextResponse.json(updatedVariant);
  } catch (error: any) {
    console.error(`[API] PATCH /api/staff/catalog/products/${id}/variant error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to update variant' }, { status: 500 });
  }
}

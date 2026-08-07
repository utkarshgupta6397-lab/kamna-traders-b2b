import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMasterAuditLog } from '@/lib/master-data-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.catalog_product_attributes_modify && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body;

    if (status !== 'Active' && status !== 'Inactive') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existing = await prisma.productAttribute.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.productAttribute.update({
      where: { id },
      data: {
        status,
        updatedById: session.userId
      }
    });

    await createMasterAuditLog({
      entityType: 'ProductAttribute',
      entityId: updated.id,
      action: 'UPDATED',
      newValue: JSON.stringify({ status }),
      remarks: `Attribute marked as ${status}`,
      userId: session.userId,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(`[API] PATCH /api/staff/catalog/product-attributes/${id}/status error:`, error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

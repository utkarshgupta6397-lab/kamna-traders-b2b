import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMasterAuditLog } from '@/lib/master-data-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { action, remarks } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const approvePerm = 'catalog_products_approve';
    const createPerm = 'catalog_products_create';
    const modifyPerm = 'catalog_products_modify';
    
    const hasModify = session.role === 'ADMIN' || session[modifyPerm];
    const hasCreate = session.role === 'ADMIN' || session[createPerm];
    const hasApprove = session.role === 'ADMIN' || session[approvePerm];

    let targetStatus = existing.status;
    let auditAction: 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'ARCHIVED' | 'RESTORED' | 'UPDATED' = 'SUBMITTED';
    const updateData: any = { updatedBy: { connect: { id: session.userId } } };

    if (action === 'submit') {
      if (!hasCreate && !hasModify) {
        return NextResponse.json({ error: `Permission Denied: Requires create or modify permissions` }, { status: 403 });
      }
      if (existing.status !== 'Draft') {
        return NextResponse.json({ error: 'Only Draft products can be submitted for approval' }, { status: 400 });
      }
      targetStatus = 'Approval Pending';
      auditAction = 'SUBMITTED';
    } else if (action === 'approve') {
      if (!hasApprove) {
        return NextResponse.json({ error: `Permission Denied: ${approvePerm} required to approve` }, { status: 403 });
      }
      if (existing.status !== 'Approval Pending') {
        return NextResponse.json({ error: 'Only products in Approval Pending state can be approved' }, { status: 400 });
      }
      targetStatus = 'Active';
      auditAction = 'APPROVED';
      updateData.approvedBy = { connect: { id: session.userId } };
      updateData.approvedAt = new Date();
    } else if (action === 'decline') {
      if (!hasApprove) {
        return NextResponse.json({ error: `Permission Denied: ${approvePerm} required to decline` }, { status: 403 });
      }
      if (existing.status !== 'Approval Pending') {
        return NextResponse.json({ error: 'Only products in Approval Pending state can be declined' }, { status: 400 });
      }
      if (!remarks || !remarks.trim()) {
        return NextResponse.json({ error: 'Remarks are mandatory when declining a product' }, { status: 400 });
      }
      targetStatus = 'Draft';
      auditAction = 'DECLINED';
    } else if (action === 'reactivate') {
      const hasArchive = session.role === 'ADMIN' || session['catalog_products_archive'];
      if (!hasArchive) return NextResponse.json({ error: `Permission Denied: catalog_products_archive required` }, { status: 403 });
      if (existing.status !== 'Inactive' && existing.status !== 'Archived') {
        return NextResponse.json({ error: 'Only Inactive or Archived products can be reactivated' }, { status: 400 });
      }
      targetStatus = 'Active';
      updateData.isActive = true;
      auditAction = 'RESTORED';
    } else if (action === 'archive') {
      const hasArchive = session.role === 'ADMIN' || session['catalog_products_archive'];
      if (!hasArchive) return NextResponse.json({ error: `Permission Denied: catalog_products_archive required` }, { status: 403 });
      if (existing.status !== 'Inactive' && existing.status !== 'Draft') {
        return NextResponse.json({ error: 'Only Draft and Inactive products can be archived.' }, { status: 400 });
      }
      
      targetStatus = 'Archived';
      updateData.isActive = false;
      auditAction = 'ARCHIVED';
    } else if (action === 'deactivate') {
      if (!hasModify) return NextResponse.json({ error: `Permission Denied: ${modifyPerm} required` }, { status: 403 });
      if (existing.status !== 'Active') {
        return NextResponse.json({ error: 'Only Active products can be deactivated' }, { status: 400 });
      }

      targetStatus = 'Inactive';
      updateData.isActive = false;
      auditAction = 'UPDATED';
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    updateData.status = targetStatus;
    if (remarks) updateData.remarks = remarks.trim();

    const updatedRecord = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        updatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await createMasterAuditLog({
      entityType: 'Product',
      entityId: id,
      action: auditAction,
      previousValue: existing.status,
      newValue: targetStatus,
      remarks: remarks || `Action: ${action}`,
      userId: session.userId,
      productId: id,
    } as any);

    return NextResponse.json(updatedRecord);
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products/${id}/action error:`, error);
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ENTITY_REGISTRY, MasterEntityKey, createMasterAuditLog } from '@/lib/master-data-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entity, id } = await params;
  const meta = ENTITY_REGISTRY[entity as MasterEntityKey];
  if (!meta) {
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action, remarks } = body;

    const delegate = meta.prismaDelegate;
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const approvePerm = `${meta.permissionPrefix}_approve`;
    const createPerm = `${meta.permissionPrefix}_create`;

    let targetStatus = existing.status;
    let auditAction: 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'ARCHIVED' | 'RESTORED' = 'SUBMITTED';
    const updateData: any = { updatedById: session.userId };

    if (action === 'submit') {
      if (existing.status !== 'Draft') {
        return NextResponse.json({ error: 'Only Draft records can be submitted for approval' }, { status: 400 });
      }
      targetStatus = 'Approval Pending';
      auditAction = 'SUBMITTED';
    } else if (action === 'approve') {
      if (session.role !== 'ADMIN' && !session[approvePerm]) {
        return NextResponse.json({ error: `Permission Denied: ${approvePerm} required to approve` }, { status: 403 });
      }
      if (existing.status !== 'Approval Pending') {
        return NextResponse.json({ error: 'Only records in Approval Pending state can be approved' }, { status: 400 });
      }
      targetStatus = 'Approved';
      auditAction = 'APPROVED';
      updateData.approvedById = session.userId;
      updateData.approvedAt = new Date();
    } else if (action === 'decline') {
      if (session.role !== 'ADMIN' && !session[approvePerm]) {
        return NextResponse.json({ error: `Permission Denied: ${approvePerm} required to decline` }, { status: 403 });
      }
      if (existing.status !== 'Approval Pending') {
        return NextResponse.json({ error: 'Only records in Approval Pending state can be declined' }, { status: 400 });
      }
      if (!remarks || !remarks.trim()) {
        return NextResponse.json({ error: 'Remarks are mandatory when declining a record' }, { status: 400 });
      }
      targetStatus = 'Draft';
      auditAction = 'DECLINED';
    } else if (action === 'deactivate') {
      targetStatus = 'Inactive';
      updateData.isActive = false;
      auditAction = 'UPDATED';
    } else if (action === 'reactivate') {
      targetStatus = 'Approved';
      updateData.isActive = true;
      auditAction = 'RESTORED';
    } else if (action === 'archive') {
      targetStatus = 'Archived';
      updateData.isActive = false;
      auditAction = 'ARCHIVED';
    } else if (action === 'restore') {
      targetStatus = 'Draft';
      auditAction = 'RESTORED';
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    updateData.status = targetStatus;
    if (remarks) updateData.remarks = remarks.trim();

    const updatedRecord = await delegate.update({
      where: { id },
      data: updateData,
      include: {
        updatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await createMasterAuditLog({
      entityType: meta.modelName,
      entityId: id,
      action: auditAction,
      previousValue: existing.status,
      newValue: targetStatus,
      remarks: remarks || `Action: ${action}`,
      userId: session.userId,
    });

    return NextResponse.json(updatedRecord);
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/${entity}/${id}/action error:`, error);
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ENTITY_REGISTRY, MasterEntityKey, createMasterAuditLog, getPrismaDelegate } from '@/lib/master-data-service';

export async function GET(
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
    const delegate = getPrismaDelegate(entity as MasterEntityKey);
    let record: any = null;
    try {
      record = await delegate.findUnique({
        where: { id },
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          history: {
            orderBy: { performedAt: 'desc' },
            include: { performedBy: { select: { id: true, name: true } } },
          },
        },
      });
    } catch {
      record = await delegate.findUnique({ where: { id } }).catch(() => null);
    }

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/${entity}/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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

  // Modify Permission check
  const modifyPerm = `${meta.permissionPrefix}_modify`;
  if (session.role !== 'ADMIN' && !session[modifyPerm]) {
    return NextResponse.json({ error: `Permission Denied: ${modifyPerm}` }, { status: 403 });
  }

  try {
    const delegate = getPrismaDelegate(entity as MasterEntityKey);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    if (existing.status === 'Archived') {
      return NextResponse.json({ error: 'Archived records cannot be modified' }, { status: 400 });
    }

    const body = await request.json();
    const { name, code, description, remarks, ...customProps } = body;

    const updateData: any = {
      updatedById: session.userId,
    };

    if (name && name.trim() !== existing.name) {
      // Check unique name
      const duplicate = await delegate.findFirst({
        where: { name: { equals: name.trim(), mode: 'insensitive' }, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: `${meta.singularName} with name "${name}" already exists` }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (code !== undefined) updateData.code = code ? code.trim().toUpperCase() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (remarks !== undefined) updateData.remarks = remarks ? remarks.trim() : null;

    if (entity === 'tax-rates') {
      if (customProps.percentage !== undefined) updateData.percentage = parseFloat(customProps.percentage);
      if (customProps.taxType !== undefined) updateData.taxType = customProps.taxType;
    } else if (entity === 'units') {
      if (customProps.abbreviation !== undefined) updateData.abbreviation = customProps.abbreviation ? customProps.abbreviation.trim() : null;
    } else if (entity === 'hsn-codes') {
      if (customProps.gstRate !== undefined) updateData.gstRate = customProps.gstRate ? parseFloat(customProps.gstRate) : null;
      if (customProps.chapterCode !== undefined) updateData.chapterCode = customProps.chapterCode ? customProps.chapterCode.trim() : null;
    }

    const updatedRecord = await delegate.update({
      where: { id },
      data: updateData,
      include: {
        updatedBy: { select: { id: true, name: true } },
      },
    });

    // Write audit log
    await createMasterAuditLog({
      entityType: meta.modelName,
      entityId: id,
      action: 'UPDATED',
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updatedRecord),
      remarks: remarks || 'Record updated',
      userId: session.userId,
    });

    return NextResponse.json(updatedRecord);
  } catch (error: any) {
    console.error(`[API] PATCH /api/staff/catalog/${entity}/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to update record' }, { status: 500 });
  }
}

export async function DELETE(
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

  const modifyPerm = `${meta.permissionPrefix}_modify`;
  if (session.role !== 'ADMIN' && !session[modifyPerm]) {
    return NextResponse.json({ error: `Permission Denied: ${modifyPerm}` }, { status: 403 });
  }

  try {
    const delegate = getPrismaDelegate(entity as MasterEntityKey);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const archivedRecord = await delegate.update({
      where: { id },
      data: {
        status: 'Archived',
        isActive: false,
        updatedById: session.userId,
      },
    });

    await createMasterAuditLog({
      entityType: meta.modelName,
      entityId: id,
      action: 'ARCHIVED',
      previousValue: existing.status,
      newValue: 'Archived',
      remarks: 'Record archived',
      userId: session.userId,
    });

    return NextResponse.json(archivedRecord);
  } catch (error: any) {
    console.error(`[API] DELETE /api/staff/catalog/${entity}/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to archive record' }, { status: 500 });
  }
}

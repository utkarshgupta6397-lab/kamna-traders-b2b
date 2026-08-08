import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ENTITY_REGISTRY, MasterEntityKey, createMasterAuditLog, getPrismaDelegate } from '@/lib/master-data-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const session = await getSession();
  
  const { entity, id } = await params;
  console.log('[DEBUG] [entity]/[id] API hit:', { entity, id, session: session ? 'exists' : 'null' });

  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // No need to serialize BigInt for tax rates anymore

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

  try {
    const delegate = getPrismaDelegate(entity as MasterEntityKey);
    const existing = await delegate.findUnique({ 
      where: { id },
      include: {
        ...(entity === 'categories' ? { parent: { select: { id: true, name: true } } } : {}),
      }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Permission check
    const modifyPerm = `${meta.permissionPrefix}_modify`;
    const createPerm = `${meta.permissionPrefix}_create`;
    const hasModify = session.role === 'ADMIN' || session[modifyPerm];
    const hasCreate = session.role === 'ADMIN' || session[createPerm];

    if (!hasModify) {
      if (!(hasCreate && existing.status === 'Draft' && existing.createdById === session.userId)) {
        return NextResponse.json({ error: `Permission Denied: Requires ${modifyPerm} or owner Create access for Drafts` }, { status: 403 });
      }
    }

    if (existing.status === 'Archived') {
      return NextResponse.json({ error: 'Archived records cannot be modified' }, { status: 400 });
    }

    const body = await request.json();
    const { name, code, description, remarks, ...customProps } = body;

    const updateData: any = {
      updatedBy: { connect: { id: session.userId } },
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

    if (code !== undefined) {
      const parsedCode = code ? code.trim().toUpperCase() : null;
      if (parsedCode && parsedCode !== existing.code) {
        const existingCode = await delegate.findFirst({
          where: { code: { equals: parsedCode, mode: 'insensitive' }, id: { not: id } },
        });
        if (existingCode) {
          return NextResponse.json({ error: `${meta.singularName} with code "${parsedCode}" already exists` }, { status: 400 });
        }
      }
      updateData.code = parsedCode;
    }
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (remarks !== undefined) updateData.remarks = remarks ? remarks.trim() : null;

    if (entity === 'tax-rates') {
      if (customProps.percentage !== undefined) updateData.percentage = parseFloat(customProps.percentage) || 0.0;
      if (customProps.taxType !== undefined) updateData.taxType = customProps.taxType;
      if (customProps.zohoBooksIntraTaxId !== undefined) updateData.zohoBooksIntraTaxId = customProps.zohoBooksIntraTaxId ? customProps.zohoBooksIntraTaxId.trim() : null;
      if (customProps.zohoBooksInterTaxId !== undefined) updateData.zohoBooksInterTaxId = customProps.zohoBooksInterTaxId ? customProps.zohoBooksInterTaxId.trim() : null;
    } else if (entity === 'units') {
      if (customProps.abbreviation !== undefined) {
        if (!customProps.abbreviation || !customProps.abbreviation.trim()) {
          return NextResponse.json({ error: 'Display Abbreviation is required' }, { status: 400 });
        }
        const parsedAbbrev = customProps.abbreviation.trim().toUpperCase();
        if (parsedAbbrev !== existing.abbreviation) {
          const existingAbbrev = await delegate.findFirst({
            where: { 
              abbreviation: { equals: parsedAbbrev, mode: 'insensitive' },
              id: { not: id },
              status: { not: 'Archived' }
            },
          });
          if (existingAbbrev) {
            return NextResponse.json({ error: `Unit of Measurement with abbreviation "${parsedAbbrev}" already exists` }, { status: 400 });
          }
        }
        updateData.abbreviation = parsedAbbrev;
      }
      if (customProps.zohoBooksUnitName !== undefined) {
        updateData.zohoBooksUnitName = customProps.zohoBooksUnitName ? customProps.zohoBooksUnitName.trim() : null;
      }
    } else if (entity === 'hsn-codes') {
      if (customProps.defaultGstRateId !== undefined) {
        if (customProps.defaultGstRateId) {
          updateData.defaultGstRate = { connect: { id: customProps.defaultGstRateId } };
        } else {
          updateData.defaultGstRate = { disconnect: true };
        }
      }
    } else if (entity === 'categories') {
      if (customProps.parentId !== undefined) {
        if (!customProps.parentId) {
          updateData.parent = { disconnect: true };
        } else {
          if (customProps.parentId === id) {
            return NextResponse.json({ error: 'A category cannot be its own parent.' }, { status: 400 });
          }
          
          const childCount = await delegate.count({ where: { parentId: id } });
          if (childCount > 0) {
            return NextResponse.json({ error: 'Cannot nest this category because it already has sub-categories.' }, { status: 400 });
          }

          const targetParent = await delegate.findUnique({ where: { id: customProps.parentId } });
          if (!targetParent) {
            return NextResponse.json({ error: 'Selected Parent Category does not exist.' }, { status: 400 });
          }
          if (targetParent.parentId) {
            return NextResponse.json({ error: 'Cannot nest a category under a sub-category. Maximum depth is 2 levels.' }, { status: 400 });
          }

          updateData.parent = { connect: { id: customProps.parentId } };
        }
      }
    }

    const updatedRecord = await delegate.update({
      where: { id },
      data: updateData,
      include: {
        updatedBy: { select: { id: true, name: true } },
        ...(entity === 'categories' ? { parent: { select: { id: true, name: true } } } : {}),
      },
    });

    // Write audit log
    await createMasterAuditLog({
      entityType: meta.modelName,
      entityId: id,
      action: 'UPDATED',
      previousValue: JSON.stringify(existing, (_, v) => typeof v === 'bigint' ? v.toString() : v),
      newValue: JSON.stringify(updatedRecord, (_, v) => typeof v === 'bigint' ? v.toString() : v),
      remarks: remarks || 'Record updated',
      userId: session.userId,
    });

    // No need to serialize BigInt for tax rates anymore

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

  const modifyPerm = meta.archiveKey || `${meta.permissionPrefix}_modify`;
  if (session.role !== 'ADMIN' && !session[modifyPerm]) {
    return NextResponse.json({ error: `Permission Denied: ${modifyPerm}` }, { status: 403 });
  }

  try {
    const delegate = getPrismaDelegate(entity as MasterEntityKey);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    if (existing.status === 'Draft') {
      // If it's a product family, variants will be deleted automatically if CASCADE is setup
      // or we can handle it.
      await delegate.delete({ where: { id } });
      
      await createMasterAuditLog({
        entityType: meta.modelName,
        entityId: id,
        action: 'ARCHIVED',
        previousValue: existing.status,
        newValue: 'Deleted',
        remarks: 'Draft record deleted',
        userId: session.userId,
      });
      
      return NextResponse.json({ success: true, status: 'Deleted' });
    }

    if (existing.status === 'Approval Pending') {
      return NextResponse.json({ error: `Cannot archive a record in ${existing.status} status` }, { status: 400 });
    }

    const archivedRecord = await delegate.update({
      where: { id },
      data: {
        status: 'Archived',
        active: false,
        updatedBy: { connect: { id: session.userId } },
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

    // No need to serialize BigInt for tax rates anymore

    return NextResponse.json(archivedRecord);
  } catch (error: any) {
    console.error(`[API] DELETE /api/staff/catalog/${entity}/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to archive record' }, { status: 500 });
  }
}

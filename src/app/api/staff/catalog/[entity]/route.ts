import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ENTITY_REGISTRY, MasterEntityKey, getNextMasterId, createMasterAuditLog } from '@/lib/master-data-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entity } = await params;
  const meta = ENTITY_REGISTRY[entity as MasterEntityKey];
  if (!meta) {
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'ALL';
    const createdBy = searchParams.get('createdBy') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

    const where: any = {};

    if (status !== 'ALL') {
      where.status = status;
    }

    if (createdBy) {
      where.createdById = createdBy;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const delegate = meta.prismaDelegate;
    const total = await delegate.count({ where });

    const records = await delegate.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/${entity} error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entity } = await params;
  const meta = ENTITY_REGISTRY[entity as MasterEntityKey];
  if (!meta) {
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
  }

  // Permission Check
  const createPerm = `${meta.permissionPrefix}_create`;
  if (session.role !== 'ADMIN' && !session[createPerm]) {
    return NextResponse.json({ error: `Permission Denied: ${createPerm}` }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, code, description, remarks, submitForApproval, ...customProps } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const delegate = meta.prismaDelegate;

    // Check unique name
    const existingName = await delegate.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (existingName) {
      return NextResponse.json({ error: `${meta.singularName} with name "${name}" already exists` }, { status: 400 });
    }

    // Allocate ID & Code
    const numId = await getNextMasterId(meta.modelName);
    const finalCode = code && code.trim() ? code.trim().toUpperCase() : `${meta.codePrefix}-${numId}`;
    const initialStatus = submitForApproval ? 'Approval Pending' : 'Draft';

    const createData: any = {
      name: name.trim(),
      code: finalCode,
      description: description ? description.trim() : null,
      status: initialStatus,
      remarks: remarks ? remarks.trim() : null,
      createdById: session.userId,
      updatedById: session.userId,
    };

    // Brand and Category schema use auto-cuid or cuid for ID, others use numeric ID
    if (entity !== 'brands' && entity !== 'categories') {
      createData.id = numId;
    }

    // Custom entity fields
    if (entity === 'tax-rates') {
      createData.percentage = parseFloat(customProps.percentage) || 0.0;
      createData.taxType = customProps.taxType || 'GST';
    } else if (entity === 'units') {
      createData.abbreviation = customProps.abbreviation ? customProps.abbreviation.trim() : null;
    } else if (entity === 'hsn-codes') {
      createData.gstRate = customProps.gstRate ? parseFloat(customProps.gstRate) : null;
      createData.chapterCode = customProps.chapterCode ? customProps.chapterCode.trim() : null;
    }

    const newRecord = await delegate.create({
      data: createData,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Write audit log
    await createMasterAuditLog({
      entityType: meta.modelName,
      entityId: newRecord.id,
      action: submitForApproval ? 'SUBMITTED' : 'CREATED',
      newValue: JSON.stringify({ name: newRecord.name, code: newRecord.code, status: newRecord.status }),
      remarks: remarks || 'Initial creation',
      userId: session.userId,
    });

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/${entity} error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create record' }, { status: 500 });
  }
}

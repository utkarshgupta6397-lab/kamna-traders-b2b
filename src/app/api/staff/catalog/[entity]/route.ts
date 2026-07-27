import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ENTITY_REGISTRY, MasterEntityKey, getNextMasterId, createMasterAuditLog, getPrismaDelegate } from '@/lib/master-data-service';

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

    const delegate = getPrismaDelegate(entity as MasterEntityKey);
    let total = 0;
    let records: any[] = [];

    if (sortBy === 'default') {
      try {
        const allRecords = await delegate.findMany({
          where,
          select: { id: true, status: true, updatedAt: true },
        });

        const statusWeight: Record<string, number> = {
          'Approval Pending': 1,
          'Draft': 2,
          'Active': 3,
          'Inactive': 4,
          'Archived': 5,
        };

        allRecords.sort((a: any, b: any) => {
          const weightA = statusWeight[a.status] || 99;
          const weightB = statusWeight[b.status] || 99;
          if (weightA !== weightB) return weightA - weightB;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        total = allRecords.length;
        const pagedIds = allRecords.slice((page - 1) * limit, page * limit).map((r: any) => r.id);

        const rawRecords = await delegate.findMany({
          where: { id: { in: pagedIds } },
          include: {
            createdBy: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
          },
        });

        records = pagedIds.map((id: any) => rawRecords.find((r: any) => r.id === id)).filter(Boolean);
      } catch (err) {
        // Fallback for unmigrated DB
        total = await delegate.count({ where }).catch(() => 0);
        records = await delegate.findMany({
          where: {},
          orderBy: { createdAt: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }).catch(() => []);
      }
    } else {
      try {
        total = await delegate.count({ where });
      } catch {
        total = await delegate.count().catch(() => 0);
      }

      try {
        records = await delegate.findMany({
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
      } catch {
        // Fallback for unmigrated DB schemas lacking relation fields
        try {
          records = await delegate.findMany({
            where: {},
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          });
        } catch {
          records = await delegate.findMany({
            take: limit,
          }).catch(() => []);
        }
      }
    }

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

    const delegate = getPrismaDelegate(entity as MasterEntityKey);

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

    // Check unique code
    if (finalCode) {
      const existingCode = await delegate.findFirst({
        where: { code: { equals: finalCode, mode: 'insensitive' } },
      });
      if (existingCode) {
        return NextResponse.json({ error: `${meta.singularName} with code "${finalCode}" already exists` }, { status: 400 });
      }
    }

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

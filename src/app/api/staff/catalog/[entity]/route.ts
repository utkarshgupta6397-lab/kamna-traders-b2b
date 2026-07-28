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
    const ALLOWED_SORT_FIELDS = ['updatedAt', 'createdAt', 'name', 'code', 'status', 'productsMappedCount'];
    const rawSortBy = searchParams.get('sortBy') || 'updatedAt';
    const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limitParam = searchParams.get('limit') || '25';
    const limit = limitParam === 'all' ? 'all' : Math.min(100, Math.max(1, parseInt(limitParam, 10)));
    const isRoot = searchParams.get('isRoot') === 'true';
    const categoryType = searchParams.get('categoryType');

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

    if (entity === 'categories') {
      if (isRoot || categoryType === 'ROOT') {
        where.parentId = null;
      } else if (categoryType === 'SUB') {
        where.parentId = { not: null };
      }
    }

    if (search) {
      const tokens = search.trim().split(/\s+/).filter(t => t.length > 0);
      if (tokens.length > 0) {
        where.AND = tokens.map((token) => {
          const orConditions: any[] = [
            { name: { contains: token, mode: 'insensitive' } },
            { code: { contains: token, mode: 'insensitive' } },
            { description: { contains: token, mode: 'insensitive' } },
            { remarks: { contains: token, mode: 'insensitive' } },
            { status: { contains: token, mode: 'insensitive' } },
          ];

          if (entity === 'categories') {
            orConditions.push({ parent: { name: { contains: token, mode: 'insensitive' } } });
          } else if (entity === 'units') {
            orConditions.push({ abbreviation: { contains: token, mode: 'insensitive' } });
          } else if (entity === 'tax-rates') {
            orConditions.push({ taxType: { contains: token, mode: 'insensitive' } });
          }
          return { OR: orConditions };
        });
      }
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
        const pagedIds = limit === 'all' 
          ? allRecords.map((r: any) => r.id) 
          : allRecords.slice((page - 1) * (limit as number), page * (limit as number)).map((r: any) => r.id);

        const rawRecords = await delegate.findMany({
          where: { id: { in: pagedIds } },
          include: {
            createdBy: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
            ...(entity === 'hsn-codes' ? { defaultGstRate: { select: { percentage: true } } } : {}),
            _count: { select: { products: { where: { status: { in: ['Draft', 'Active', 'Approval Pending'] } } } } },
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
    } else if (entity === 'categories' && sortBy !== 'default' && categoryType !== 'ROOT' && categoryType !== 'SUB' && !isRoot) {
      // Tree sorting for categories: fetch all, build tree, then paginate
      try {
        const allCategories = await delegate.findMany({
          where,
          orderBy: sortBy === 'productsMappedCount' ? { products: { _count: sortOrder } } : { [sortBy]: sortOrder },
          include: {
            createdBy: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
            parent: { select: { id: true, name: true } },
            _count: { select: { children: true, products: { where: { status: { in: ['Draft', 'Active', 'Approval Pending'] } } } } },
          },
        });
        
        total = allCategories.length;
        
        // Build flat tree (Root -> Subs -> Root -> Subs)
        const roots = allCategories.filter((c: any) => !c.parentId);
        const flatTree: any[] = [];
        for (const root of roots) {
          flatTree.push(root);
          const subs = allCategories.filter((c: any) => c.parentId === root.id);
          flatTree.push(...subs);
        }
        
        records = flatTree.slice((page - 1) * limit, page * limit);
      } catch (err) {
        total = 0;
        records = [];
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
          orderBy: sortBy === 'productsMappedCount' ? { products: { _count: sortOrder } } : { [sortBy]: sortOrder },
          skip: limit === 'all' ? undefined : (page - 1) * (limit as number),
          take: limit === 'all' ? undefined : (limit as number),
          include: {
            createdBy: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
            ...(entity === 'hsn-codes' ? { defaultGstRate: { select: { percentage: true } } } : {}),
            ...(entity === 'categories' ? { parent: { select: { id: true, name: true } }, _count: { select: { children: true, products: { where: { status: { in: ['Draft', 'Active', 'Approval Pending'] } } } } } } : { _count: { select: { products: { where: { status: { in: ['Draft', 'Active', 'Approval Pending'] } } } } } }),
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

    records = records.map(r => ({ ...r, productsMappedCount: r._count?.products || 0 }));

    if (entity === 'tax-rates') {
      records = records.map(r => ({
        ...r,
        zohoBooksTaxId: r.zohoBooksTaxId ? r.zohoBooksTaxId.toString() : null
      }));
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

    if (entity === 'units' && (!customProps.abbreviation || !customProps.abbreviation.trim())) {
      return NextResponse.json({ error: 'Display Abbreviation is required' }, { status: 400 });
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
      if (entity === 'hsn-codes' && finalCode.length < 6) {
        return NextResponse.json({ error: 'Company HSN codes must contain a minimum of 6 digits.' }, { status: 400 });
      }
      
      const existingCode = await delegate.findFirst({
        where: { code: { equals: finalCode, mode: 'insensitive' } },
      });
      if (existingCode) {
        return NextResponse.json({ error: `${meta.singularName} with code "${finalCode}" already exists` }, { status: 400 });
      }
    }

    // Check unique abbreviation for units
    if (entity === 'units' && customProps.abbreviation) {
      const parsedAbbrev = customProps.abbreviation.trim().toUpperCase();
      const existingAbbrev = await delegate.findFirst({
        where: { 
          abbreviation: { equals: parsedAbbrev, mode: 'insensitive' },
          status: { not: 'Archived' }
        },
      });
      if (existingAbbrev) {
        return NextResponse.json({ error: `Unit of Measurement with abbreviation "${parsedAbbrev}" already exists` }, { status: 400 });
      }
      customProps.abbreviation = parsedAbbrev;
    }

    const createData: any = {
      name: name.trim(),
      code: finalCode,
      description: description ? description.trim() : null,
      status: initialStatus,
      remarks: remarks ? remarks.trim() : null,
      createdBy: { connect: { id: session.userId } },
      updatedBy: { connect: { id: session.userId } },
    };

    // Brand and Category schema use auto-cuid or cuid for ID, others use numeric ID
    if (entity !== 'brands' && entity !== 'categories') {
      createData.id = numId;
    }

    // Custom entity fields
    if (entity === 'tax-rates') {
      createData.percentage = parseFloat(customProps.percentage) || 0.0;
      createData.taxType = customProps.taxType || 'GST';
      createData.zohoBooksTaxId = customProps.zohoBooksTaxId ? BigInt(customProps.zohoBooksTaxId) : null;
    } else if (entity === 'units') {
      createData.abbreviation = customProps.abbreviation ? customProps.abbreviation.trim() : null;
    } else if (entity === 'hsn-codes') {
      if (customProps.defaultGstRateId) {
        createData.defaultGstRate = { connect: { id: customProps.defaultGstRateId } };
      }
    } else if (entity === 'categories') {
      if (customProps.parentId) {
        const parentCategory = await delegate.findUnique({ where: { id: customProps.parentId } });
        if (!parentCategory) {
          return NextResponse.json({ error: 'Selected Parent Category does not exist' }, { status: 400 });
        }
        if (parentCategory.parentId) {
          return NextResponse.json({ error: 'Cannot nest a category under a sub-category. Maximum depth is 2 levels.' }, { status: 400 });
        }
        createData.parent = { connect: { id: customProps.parentId } };
      }
    }

    const newRecord = await delegate.create({
      data: createData,
      include: {
        createdBy: { select: { id: true, name: true } },
        ...(entity === 'categories' ? { parent: { select: { id: true, name: true } } } : {}),
      },
    });

    // Write audit log
    const auditPayload: any = { name: newRecord.name, code: newRecord.code, status: newRecord.status };
    if (entity === 'categories' && newRecord.parent) {
      auditPayload.parent = newRecord.parent;
    }
    await createMasterAuditLog({
      entityType: meta.modelName,
      entityId: newRecord.id,
      action: submitForApproval ? 'SUBMITTED' : 'CREATED',
      newValue: JSON.stringify(auditPayload),
      remarks: remarks || 'Initial creation',
      userId: session.userId,
    });

    if (entity === 'tax-rates' && newRecord.zohoBooksTaxId) {
      newRecord.zohoBooksTaxId = newRecord.zohoBooksTaxId.toString();
    }

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/${entity} error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create record' }, { status: 500 });
  }
}

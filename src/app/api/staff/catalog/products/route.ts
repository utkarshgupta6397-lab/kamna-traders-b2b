import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createProductWithDefaultVariant } from '@/lib/product-service';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'ALL';
    const createdBy = searchParams.get('createdBy') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const ALLOWED_SORT_FIELDS = ['updatedAt', 'createdAt', 'name', 'code', 'status'];
    const rawSortBy = searchParams.get('sortBy') || 'updatedAt';
    const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limitParam = searchParams.get('limit') || '25';
    const limit = limitParam === 'all' ? 'all' : Math.min(100, Math.max(1, parseInt(limitParam, 10)));

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
      const tokens = search.trim().split(/\s+/).filter(t => t.length > 0);
      if (tokens.length > 0) {
        where.AND = tokens.map((token: string) => {
          return {
            OR: [
              { name: { contains: token, mode: 'insensitive' } },
              { code: { contains: token, mode: 'insensitive' } },
              { description: { contains: token, mode: 'insensitive' } },
              { status: { contains: token, mode: 'insensitive' } },
              { brand: { name: { contains: token, mode: 'insensitive' } } },
              { manufacturer: { name: { contains: token, mode: 'insensitive' } } },
              { category: { name: { contains: token, mode: 'insensitive' } } },
              { hsnCode: { code: { contains: token, mode: 'insensitive' } } },
              { variants: { some: { sku: { contains: token, mode: 'insensitive' } } } },
            ]
          };
        });
      }
    }

    let total = 0;
    let records: any[] = [];

    if (sortBy === 'default') {
      const allRecords = await prisma.product.findMany({
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

      const rawRecords = await prisma.product.findMany({
        where: { id: { in: pagedIds } },
        include: {
          brand: { select: { id: true, name: true } },
          manufacturer: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          hsnCode: { select: { id: true, code: true, name: true } },
          taxRate: { select: { id: true, name: true, percentage: true } },
          unit: { select: { id: true, abbreviation: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          variants: true,
        },
      });

      records = pagedIds.map((id: any) => rawRecords.find((r: any) => r.id === id)).filter(Boolean);
    } else {
      total = await prisma.product.count({ where });

      records = await prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: limit === 'all' ? undefined : (page - 1) * (limit as number),
        take: limit === 'all' ? undefined : (limit as number),
        include: {
          brand: { select: { id: true, name: true } },
          manufacturer: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          hsnCode: { select: { id: true, code: true, name: true } },
          taxRate: { select: { id: true, name: true, percentage: true } },
          unit: { select: { id: true, abbreviation: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          variants: true,
        },
      });
    }

    return NextResponse.json({
      records,
      total,
      page,
      limit,
      totalPages: limit === 'all' ? 1 : Math.ceil(total / (limit as number)),
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission Check
  const createPerm = 'catalog_products_create';
  if (session.role !== 'ADMIN' && !session[createPerm]) {
    return NextResponse.json({ error: `Permission Denied: ${createPerm}` }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      name, code, description, type, remarks, submitForApproval,
      brandId, manufacturerId, categoryId, hsnCodeId, taxRateId, unitId,
      purchasePrice, sellingPrice, trackInventory, trackSerials, incentiveTag
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    if (code && code.trim()) {
      const existing = await prisma.product.findUnique({
        where: { code: code.trim().toUpperCase() }
      });
      if (existing) {
        return NextResponse.json({ error: `Product with code "${code.trim().toUpperCase()}" already exists` }, { status: 400 });
      }
    }

    const newProduct = await createProductWithDefaultVariant({
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : undefined,
      description: description ? description.trim() : undefined,
      type,
      brandId,
      manufacturerId,
      categoryId,
      hsnCodeId,
      taxRateId,
      unitId,
      remarks: remarks ? remarks.trim() : undefined,
      status: submitForApproval ? 'Approval Pending' : 'Draft',
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      trackInventory: trackInventory !== false,
      trackSerials: trackSerials === true,
      incentiveTag,
      userId: session.userId,
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create product' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMasterAuditLog } from '@/lib/master-data-service';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'ALL';
    const dataType = searchParams.get('dataType') || 'ALL';
    const category = searchParams.get('category') || '';
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = 25;
    
    const where: any = {};
    if (status !== 'ALL') where.status = status;
    if (dataType !== 'ALL') where.dataType = dataType;
    if (category) {
      where.categories = {
        some: { categoryId: category }
      };
    }
    if (search) {
      where.OR = [
        { attributeName: { contains: search, mode: 'insensitive' } },
        { attributeCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.productAttribute.count({ where });
    const records = await prisma.productAttribute.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        updatedBy: { select: { id: true, name: true } },
        categories: {
          include: {
            category: { select: { id: true, name: true } }
          }
        }
      }
    });

    return NextResponse.json({
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/product-attributes error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.catalog_product_attributes_create && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      attributeName, description, dataType, mandatory, 
      minValue, maxValue, prefix, suffix, placeholder, 
      status, options, categories 
    } = body;

    if (!attributeName || !attributeName.trim()) {
      return NextResponse.json({ error: 'Attribute Name is required' }, { status: 400 });
    }

    // Check unique name
    const existingName = await prisma.productAttribute.findFirst({
      where: { attributeName: { equals: attributeName.trim(), mode: 'insensitive' } },
    });
    if (existingName) {
      return NextResponse.json({ error: `Attribute with name "${attributeName}" already exists` }, { status: 400 });
    }

    // Generate Code
    const lastAttr = await prisma.productAttribute.findFirst({
      orderBy: { attributeCode: 'desc' }
    });
    let nextNum = 1;
    if (lastAttr && lastAttr.attributeCode.startsWith('ATTR-')) {
      const numPart = parseInt(lastAttr.attributeCode.replace('ATTR-', ''), 10);
      if (!isNaN(numPart)) nextNum = numPart + 1;
    }
    const attributeCode = `ATTR-${nextNum.toString().padStart(5, '0')}`;

    const newRecord = await prisma.productAttribute.create({
      data: {
        attributeName: attributeName.trim(),
        attributeCode,
        description: description?.trim() || null,
        dataType,
        mandatory: !!mandatory,
        minValue: minValue !== undefined && minValue !== null && minValue !== "" ? parseFloat(minValue) : null,
        maxValue: maxValue !== undefined && maxValue !== null && maxValue !== "" ? parseFloat(maxValue) : null,
        prefix: prefix?.trim() || null,
        suffix: suffix?.trim() || null,
        placeholder: placeholder?.trim() || null,
        status: status || 'Active',
        options: options || null,
        createdById: session.userId,
        updatedById: session.userId,
        categories: {
          create: (categories || []).map((catId: string) => ({
            categoryId: catId
          }))
        }
      },
      include: {
        categories: true
      }
    });

    await createMasterAuditLog({
      entityType: 'ProductAttribute',
      entityId: newRecord.id,
      action: 'CREATED',
      newValue: JSON.stringify({ name: newRecord.attributeName, code: newRecord.attributeCode }),
      remarks: 'Initial creation',
      userId: session.userId,
    });

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/product-attributes error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create record' }, { status: 500 });
  }
}

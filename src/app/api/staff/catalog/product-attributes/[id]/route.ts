import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMasterAuditLog } from '@/lib/master-data-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const record = await prisma.productAttribute.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        categories: {
          include: {
            category: { select: { id: true, name: true } }
          }
        },
        _count: {
          select: { productValues: true }
        }
      }
    });

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Also fetch history
    const history = await prisma.masterDataHistory.findMany({
      where: { entityType: 'ProductAttribute', entityId: id },
      orderBy: { performedAt: 'desc' },
      include: {
        performedBy: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json({ ...record, history });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/product-attributes/${id} error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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
    const { 
      attributeName, description, dataType, mandatory, 
      minValue, maxValue, prefix, suffix, placeholder, 
      status, options, categories 
    } = body;

    const existing = await prisma.productAttribute.findUnique({
      where: { id },
      include: { categories: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (attributeName && attributeName.trim() !== existing.attributeName) {
      const nameCheck = await prisma.productAttribute.findFirst({
        where: { 
          attributeName: { equals: attributeName.trim(), mode: 'insensitive' },
          id: { not: id }
        },
      });
      if (nameCheck) {
        return NextResponse.json({ error: `Attribute with name "${attributeName}" already exists` }, { status: 400 });
      }
    }

    const updated = await prisma.productAttribute.update({
      where: { id },
      data: {
        attributeName: attributeName?.trim() || existing.attributeName,
        description: description !== undefined ? description?.trim() || null : existing.description,
        dataType: dataType || existing.dataType,
        mandatory: mandatory !== undefined ? !!mandatory : existing.mandatory,
        minValue: minValue !== undefined ? (minValue !== null && minValue !== "" ? parseFloat(minValue) : null) : existing.minValue,
        maxValue: maxValue !== undefined ? (maxValue !== null && maxValue !== "" ? parseFloat(maxValue) : null) : existing.maxValue,
        prefix: prefix !== undefined ? prefix?.trim() || null : existing.prefix,
        suffix: suffix !== undefined ? suffix?.trim() || null : existing.suffix,
        placeholder: placeholder !== undefined ? placeholder?.trim() || null : existing.placeholder,
        status: status || existing.status,
        options: options !== undefined ? options || null : existing.options,
        updatedById: session.userId,
        // Update categories
        ...(categories ? {
          categories: {
            deleteMany: {},
            create: categories.map((catId: string) => ({
              categoryId: catId
            }))
          }
        } : {})
      }
    });

    await createMasterAuditLog({
      entityType: 'ProductAttribute',
      entityId: updated.id,
      action: 'UPDATED',
      newValue: JSON.stringify({ name: updated.attributeName, status: updated.status }),
      remarks: 'Updated attribute',
      userId: session.userId,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(`[API] PUT /api/staff/catalog/product-attributes/${id} error:`, error);
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.catalog_product_attributes_archive && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.productAttribute.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.productAttribute.update({
      where: { id },
      data: {
        status: 'Archived',
        updatedById: session.userId
      }
    });

    await createMasterAuditLog({
      entityType: 'ProductAttribute',
      entityId: updated.id,
      action: 'ARCHIVED',
      newValue: JSON.stringify({ status: 'Archived' }),
      remarks: 'Archived attribute',
      userId: session.userId,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(`[API] PATCH /api/staff/catalog/product-attributes/${id} error:`, error);
    return NextResponse.json({ error: 'Failed to archive record' }, { status: 500 });
  }
}

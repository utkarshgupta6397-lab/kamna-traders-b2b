import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMasterAuditLog } from '@/lib/master-data-service';
import { CatalogResolver } from '@/lib/services/CatalogResolver';

export async function POST(
  request: NextRequest,
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
        variants: true,
        variantProducts: { include: { variants: true } }
      },
    });

    if (!existing.isVariantProduct && updatedRecord.variantProducts && updatedRecord.variantProducts.length > 0) {
      const updateManyData = { ...updateData };
      if (updateManyData.updatedBy?.connect?.id) {
        updateManyData.updatedById = updateManyData.updatedBy.connect.id;
        delete updateManyData.updatedBy;
      }
      if (updateManyData.approvedBy?.connect?.id) {
        updateManyData.approvedById = updateManyData.approvedBy.connect.id;
        delete updateManyData.approvedBy;
      }
      await prisma.product.updateMany({
        where: { parentProductId: id },
        data: updateManyData
      });
    }

    if (action === 'approve') {
      // Create skeleton Sku records and WarehouseInventory records for tracked products
      let trackedVariants: any[] = [];
      if (!existing.isVariantProduct && updatedRecord.variantProducts && updatedRecord.variantProducts.length > 0) {
        for (const child of updatedRecord.variantProducts) {
          trackedVariants.push(...child.variants.filter((v: any) => v.trackInventory).map((v: any) => ({ ...v, productName: child.name })));
        }
      } else {
        trackedVariants = updatedRecord.variants.filter((v: any) => v.trackInventory).map((v: any) => ({ ...v, productName: updatedRecord.name }));
      }

      if (trackedVariants.length > 0) {
        const activeWarehouses = await prisma.warehouse.findMany({ where: { active: true } });
        
        for (const variant of trackedVariants) {
          // 1. Ensure a Sku record exists to satisfy FK constraint
          const existingSku = await prisma.sku.findUnique({ where: { id: variant.sku } });
          if (!existingSku) {
            await prisma.sku.create({
              data: {
                id: variant.sku,
                name: variant.productName,
                categoryId: updatedRecord.categoryId,
                brandId: updatedRecord.brandId,
                price: variant.sellingPrice,
                unit: 'UNIT',
                moq: 1,
                stepQty: 1,
                caseSize: 1,
                isActive: true
              }
            });
          }

          // 2. Ensure WarehouseInventory records exist for all active warehouses
          for (const warehouse of activeWarehouses) {
            await prisma.warehouseInventory.upsert({
              where: {
                warehouseId_skuId: {
                  warehouseId: warehouse.id,
                  skuId: variant.sku
                }
              },
              create: {
                warehouseId: warehouse.id,
                skuId: variant.sku,
                qty: 0,
                isOos: true
              },
              update: {} // Do nothing if it already exists
            });
          }
        }
      }
    }

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

    CatalogResolver.invalidateCache();

    return NextResponse.json(updatedRecord);
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products/${id}/action error:`, error);
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}

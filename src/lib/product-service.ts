import { prisma } from './db';
import { getNextMasterId, createMasterAuditLog } from './master-data-service';

export async function getNextProductCode(): Promise<string> {
  const numId = await getNextMasterId('Product');
  return `PRD${numId}`;
}

export function generateVariantSku(productCode: string, variantIndex = 1): string {
  return `${productCode}V${variantIndex}`;
}

export interface CreateProductParams {
  name: string;
  code?: string;
  description?: string;
  type?: string;
  brandId?: string;
  manufacturerId?: string;
  categoryId?: string;
  hsnCodeId?: string;
  taxRateId?: string;
  unitId?: string;
  remarks?: string;
  status?: string;
  incentiveTag?: string;
  thumbnailBase64?: string;
  productAttributes?: { attributeId: string; value: string }[];
  
  // Default variant fields
  purchasePrice?: number;
  sellingPrice?: number;
  trackInventory?: boolean;
  trackSerials?: boolean;
  
  userId: string;
}

export async function createProductWithDefaultVariant(params: CreateProductParams) {
  const finalCode = params.code || await getNextProductCode();
  const finalStatus = params.status || 'Draft';

  return await prisma.$transaction(async (tx) => {
    // 1. Create the product
    const product = await tx.product.create({
      data: {
        name: params.name,
        code: finalCode,
        description: params.description,
        type: params.type || 'Goods',
        brandId: params.brandId,
        manufacturerId: params.manufacturerId,
        categoryId: params.categoryId,
        hsnCodeId: params.hsnCodeId,
        taxRateId: params.taxRateId,
        unitId: params.unitId,
        remarks: params.remarks,
        status: finalStatus,
        createdById: params.userId,
        updatedById: params.userId,
        approvedById: params.status === 'Active' ? params.userId : undefined,
        approvedAt: params.status === 'Active' ? new Date() : undefined,
        incentiveTag: params.incentiveTag,
        thumbnailBase64: params.thumbnailBase64,
        variants: {
          create: {
            variantName: 'Default',
            sku: generateVariantSku(finalCode, 1),
            purchasePrice: params.purchasePrice || 0,
            sellingPrice: params.sellingPrice || 0,
            trackInventory: params.trackInventory !== false,
            trackSerials: params.trackSerials === true,
            isDefault: true,
          }
        },
        ...(params.productAttributes && params.productAttributes.length > 0 ? {
          attributeValues: {
            create: params.productAttributes.map(attr => ({
              attributeId: attr.attributeId,
              value: attr.value
            }))
          }
        } : {})
      },
      include: {
        variants: true,
        attributeValues: true
      }
    });

    // 2. Audit Log (using external service call, wait, createMasterAuditLog uses prisma client directly so we can just let it be outside transaction or use the transaction if we passed it. But createMasterAuditLog doesn't take tx. So we'll just insert directly to masterDataHistory here inside tx, or just use the helper after).
    // Let's use the tx for safety
    await tx.masterDataHistory.create({
      data: {
        entityType: 'Product',
        entityId: product.id,
        action: finalStatus === 'Approval Pending' ? 'SUBMITTED' : 'CREATED',
        newValue: JSON.stringify({ name: product.name, code: product.code, status: product.status }),
        remarks: params.remarks || 'Initial creation',
        performedById: params.userId,
        productId: product.id,
      }
    });

    return product;
  });
}

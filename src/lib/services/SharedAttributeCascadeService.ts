import { prisma } from '@/lib/db';
import { ZohoProductService } from './zoho-books/ZohoProductService';
import { after } from 'next/server';
import { createMasterAuditLog } from '@/lib/master-data-service';
import { getZohoTokens } from '@/lib/zoho-auth';

export class SharedAttributeCascadeService {
  private static readonly PARENT_MANAGED_FIELDS = [
    'name',
    'description',
    'thumbnailBase64',
    'brandId',
    'manufacturerId',
    'categoryId',
    'hsnCodeId',
    'taxRateId',
    'unitId',
    'type',
    'status',
    'incentiveTag'
  ];

  /**
   * Cascades parent product changes to all its child variants.
   */
  static async cascadeUpdates(
    parentId: string,
    existingProduct: any,
    updatedProduct: any,
    session: any,
    skipZohoSync: boolean = false
  ) {
    if (existingProduct.catalogType !== 'PRODUCT_FAMILY') {
      return { updatedCount: 0 };
    }

    // Determine which fields actually changed
    const changedFields: Record<string, any> = {};
    for (const field of this.PARENT_MANAGED_FIELDS) {
      if (existingProduct[field] !== updatedProduct[field]) {
        changedFields[field] = updatedProduct[field];
      }
    }

    if (Object.keys(changedFields).length === 0) {
      return { updatedCount: 0 };
    }

    // Fetch child variants
    const childProducts = await prisma.product.findMany({
      where: { parentProductId: parentId },
      include: { variants: true }
    });

    if (childProducts.length === 0) {
      return { updatedCount: 0 };
    }

    // Update child products in DB
    const updateData = { ...changedFields, updatedById: session.userId };
    
    await prisma.product.updateMany({
      where: { parentProductId: parentId },
      data: updateData
    });

    // Handle Zoho Sync asynchronously
    if (!skipZohoSync) {
      const accessToken = await getZohoTokens().catch(() => null);
      
      after(() => {
        (async () => {
          for (const child of childProducts) {
            for (const variant of child.variants) {
              if (variant.zohoBookItemId) {
                try {
                   await ZohoProductService.syncVariant(variant.id, 'AUTO_SAVE');
                   // Handle image sync explicitly if image changed
                   if (changedFields.thumbnailBase64 !== undefined && accessToken) {
                     await ZohoProductService.uploadImage(variant.id, variant.zohoBookItemId, accessToken, true);
                   }
                } catch (err) {
                  console.error(`[CascadeSync] Zoho sync failed for variant ${variant.id}:`, err);
                }
              }
            }
          }
        })();
      });
    }

    // Log the cascade activity
    let zohoItemCount = childProducts.reduce((acc, child) => 
      acc + child.variants.filter(v => v.zohoBookItemId).length, 0
    );

    const remarks = `Parent Shared Attributes Updated: ${Object.keys(changedFields).join(', ')}. Applied to ${childProducts.length} child variants. ${zohoItemCount} Zoho Items synchronized.`;
    
    await createMasterAuditLog({
      entityType: 'Product',
      entityId: parentId,
      action: 'UPDATED',
      remarks,
      userId: session.userId,
      productId: parentId,
    } as any);

    return { updatedCount: childProducts.length, changedFields };
  }
}

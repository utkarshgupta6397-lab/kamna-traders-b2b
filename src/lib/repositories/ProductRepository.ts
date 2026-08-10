import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export class ProductRepository {
  /**
   * Optimized search for products. Includes variants, brand, category, and unit relations.
   */
  static async searchProducts(where: Prisma.ProductWhereInput) {
    return prisma.product.findMany({
      where,
      include: {
        variants: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        unit: { select: { name: true, abbreviation: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Fetch warehouse inventory for a given list of SKU IDs.
   */
  static async getInventoryForSkus(skuIds: string[], warehouseId?: string) {
    const whereClause: any = {
      skuId: { in: skuIds }
    };
    if (warehouseId) {
      whereClause.warehouseId = warehouseId;
    }

    return prisma.warehouseInventory.findMany({
      where: whereClause,
      select: {
        skuId: true,
        warehouseId: true,
        qty: true,
        isOos: true
      }
    });
  }
}

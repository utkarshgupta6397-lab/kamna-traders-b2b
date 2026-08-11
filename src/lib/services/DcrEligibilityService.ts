import { prisma } from '@/lib/db';
import type { Prisma, Product, ProductAttributeValue, ProductAttribute } from '@prisma/client';

export class DcrEligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DcrEligibilityError';
  }
}

type ProductWithAttributes = Product & {
  attributeValues: (ProductAttributeValue & {
    attribute: ProductAttribute;
  })[];
};

export class DcrEligibilityService {
  /**
   * Validates that the "Panel Type" attribute configuration exists in the system.
   * Throws an error if missing to prevent silent failures.
   */
  static async validateConfiguration(): Promise<void> {
    const attr = await prisma.productAttribute.findUnique({
      where: { attributeName: 'Panel Type' }
    });
    
    if (!attr) {
      throw new DcrEligibilityError("Missing DCR Configuration: 'Panel Type' attribute not found in Product Master.");
    }
  }

  /**
   * Evaluates if a given product object is DCR eligible.
   * The product object must include its attributeValues and their associated attributes.
   */
  static evaluateProduct(product: any): boolean {
    if (!product) return false;
    if (product.status !== 'Active') return false;
    
    if (!product.attributeValues) {
      return false;
    }

    return product.attributeValues.some(
      (av: any) => av.attribute?.attributeName === 'Panel Type' && av.value === 'DCR'
    );
  }

  /**
   * Evaluates if a given product ID is DCR eligible.
   * Queries the database to fetch the product and evaluates it.
   */
  static async isDcrEligible(productId: string): Promise<boolean> {
    await this.validateConfiguration();

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        attributeValues: {
          include: {
            attribute: true
          }
        }
      }
    });

    return this.evaluateProduct(product);
  }

  /**
   * Evaluates if a given SKU ID (ProductVariant.sku) is DCR eligible.
   */
  static async isSkuDcrEligible(sku: string): Promise<boolean> {
    await this.validateConfiguration();

    const variant = await prisma.productVariant.findUnique({
      where: { sku },
      include: {
        product: {
          include: {
            attributeValues: {
              include: {
                attribute: true
              }
            }
          }
        }
      }
    });

    return this.evaluateProduct(variant?.product);
  }
}

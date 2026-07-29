import { prisma } from '@/lib/db';

export class ProductAttributeService {
  /**
   * Retrieves all active attributes mapped to a category and optionally a subcategory.
   * If a subcategory is provided, it fetches attributes mapped to either the category OR the subcategory.
   */
  static async getAttributesForCategory(categoryId: string, subcategoryId?: string | null) {
    // Collect all valid IDs to check for mappings
    const targetIds = [categoryId];
    
    if (subcategoryId) {
      targetIds.push(subcategoryId);
    } else {
      // If no subcategory is explicitly passed, let's check if the categoryId itself is a subcategory
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { parentId: true }
      });
      if (category?.parentId) {
        // It's a subcategory, so we must also fetch attributes mapped to its parent
        targetIds.push(category.parentId);
      }
    }

    // Fetch mappings for any of the target IDs
    const mappedAttributes = await prisma.productAttributeCategory.findMany({
      where: {
        categoryId: { in: targetIds }
      },
      include: {
        attribute: true
      }
    });

    // We only want active attributes
    const activeAttributes = mappedAttributes
      .map(m => m.attribute)
      .filter(attr => attr.status === 'Active');

    // Deduplicate in case an attribute is mapped to both parent and subcategory
    const uniqueAttributes = Array.from(new Map(activeAttributes.map(a => [a.id, a])).values());

    return uniqueAttributes;
  }
}

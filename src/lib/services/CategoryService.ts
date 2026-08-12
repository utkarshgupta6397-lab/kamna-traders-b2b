import { prisma } from '@/lib/db';
import { buildProductWhereClause } from './ProductFilterService';

export class CategoryService {
  /**
   * Retrieves all categories as a flat list, but with aggregated product counts.
   */
  static async getFlat(searchParams?: URLSearchParams) {
    const tree = await this.getTree(searchParams);
    const flat: any[] = [];
    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        flat.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(tree);
    return flat;
  }

  /**
   * Retrieves all categories structured as a tree (parent -> children).
   */
  static async getTree(searchParams?: URLSearchParams, categoryWhere?: any) {
    const categories = await prisma.category.findMany({
      where: categoryWhere,
      orderBy: { name: 'asc' },
    });

    const productsWhere = searchParams ? buildProductWhereClause(searchParams) : { status: { in: ['Draft', 'Active', 'Approval Pending'] } };

    // Group categories by parentId to count products at leaf nodes
    const productsGrouped = await prisma.product.groupBy({
      by: ['categoryId'],
      where: productsWhere,
      _count: { _all: true },
    });

    const productCounts = Object.fromEntries(
      productsGrouped.map((g) => [g.categoryId, g._count._all])
    );

    // Build the tree and aggregate counts from children to parents
    const categoryMap = new Map<string, any>();
    categories.forEach(c => categoryMap.set(c.id, { ...c, children: [], productCount: productCounts[c.id] || 0 }));

    const roots: any[] = [];
    categoryMap.forEach(cat => {
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(cat);
      } else {
        roots.push(cat);
      }
    });

    // Helper to calculate total products recursively (a parent category has products = its own + all children)
    const calculateTotals = (node: any): number => {
      let total = node.productCount;
      for (const child of node.children) {
        total += calculateTotals(child);
      }
      node.totalProducts = total;
      return total;
    };

    roots.forEach(calculateTotals);

    return roots;
  }

  /**
   * Retrieves only categories that are valid for product assignment.
   * Business Rule: Products can only belong to leaf categories (categories with no children).
   */
  static async getSelectableTree() {
    const tree = await this.getTree();
    // A tree node is selectable if it has no children.
    // If we want to return a flat list of just selectable ones:
    const selectable: any[] = [];
    const traverse = (nodes: any[], path: string[]) => {
      for (const node of nodes) {
        const currentPath = [...path, node.name];
        if (!node.children || node.children.length === 0) {
          selectable.push({
            ...node,
            pathName: currentPath.join(' > ')
          });
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children, currentPath);
        }
      }
    };
    traverse(tree, []);
    return selectable;
  }

  /**
   * Retrieves a specific category by ID.
   */
  static async getById(id: string) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        parent: true
      }
    });
  }

  /**
   * Checks if a category is a leaf node (has no children).
   */
  static async isLeafCategory(id: string): Promise<boolean> {
    const childCount = await prisma.category.count({
      where: { parentId: id }
    });
    return childCount === 0;
  }
}

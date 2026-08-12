import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CategoryService } from '@/lib/services/CategoryService';
import { buildProductWhereClause } from '@/lib/services/ProductFilterService';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tReqStart = Date.now();
    const { searchParams } = new URL(request.url);
    console.log('[PRODUCTS-TRACE] CATEGORY_COUNTS_START', { searchParams: searchParams.toString() });
    const where = buildProductWhereClause(searchParams);

    // Fetch total products matching the non-category filters directly
    const totalCount = await prisma.product.count({ where });

    // Use the CategoryService to get the tree with aggregated counts, but only for Active categories
    const tree = await CategoryService.getTree(searchParams, { status: 'Active' });

    // We want to return a flat list of categories that have products > 0 for the chips
    const activeCategories: any[] = [];
    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.totalProducts > 0) {
          activeCategories.push({
            id: node.id,
            name: node.name,
            count: node.totalProducts
          });
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };
    traverse(tree);

    activeCategories.sort((a, b) => b.count - a.count);

    const responsePayload = { categories: activeCategories, total: totalCount };
    console.log('[PRODUCTS-TRACE] CATEGORY_COUNTS_END', { 
      durationMs: Date.now() - tReqStart,
      categoryCount: activeCategories.length,
      totalCount,
      responseSizeBytes: JSON.stringify(responsePayload).length
    });

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products/category-stats error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

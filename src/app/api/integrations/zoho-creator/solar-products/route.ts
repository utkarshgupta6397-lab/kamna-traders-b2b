import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const tReqStart = Date.now();
  console.log('[ZOHO-CREATOR-API] API_REQUEST_RECEIVED');

  // 1. Authentication
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[ZOHO-CREATOR-API] AUTH_FAILED: Missing or invalid Authorization header format');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.split(' ')[1];

  const config = await prisma.zohoCreatorConfig.findUnique({
    where: { id: 'singleton' },
  });

  if (!config || config.bearerToken !== token) {
    console.log('[ZOHO-CREATOR-API] AUTH_FAILED: Invalid token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('[ZOHO-CREATOR-API] AUTH_SUCCESS');

  try {
    // 2. Fetch Solar Panels Category
    const rootCategory = await prisma.category.findFirst({
      where: { name: 'Solar Panels' },
      select: { id: true }
    });

    if (!rootCategory) {
      console.log('[ZOHO-CREATOR-API] API_ERROR: Solar Panels category not found');
      return NextResponse.json({ error: 'Configuration Error: Solar Panels category not found' }, { status: 500 });
    }

    // 3. Resolve all descendants (in memory, fast since category tree is small)
    const allCategories = await prisma.category.findMany({
      select: { id: true, parentId: true }
    });

    const categoryIds = new Set<string>();
    const findDescendants = (parentId: string) => {
      categoryIds.add(parentId);
      for (const cat of allCategories) {
        if (cat.parentId === parentId) {
          findDescendants(cat.id);
        }
      }
    };
    findDescendants(rootCategory.id);

    const validCategoryIds = Array.from(categoryIds);

    // 4. Fetch Products and Variants
    const products = await prisma.product.findMany({
      where: {
        categoryId: { in: validCategoryIds },
        catalogType: { not: 'PRODUCT_FAMILY' },
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        variants: {
          select: {
            id: true,
            sku: true,
            variantName: true,
            isActive: true,
            updatedAt: true,
          }
        }
      }
    });

    // 5. Flatten the response
    const flatProducts: any[] = [];
    const seenExternalIds = new Set<string>();

    for (const p of products) {
      const baseProduct = {
        name: p.name,
        brand: p.brand?.name || null,
        category: p.category?.name || 'Solar Panels',
        status: p.status === 'Active' ? 'active' : 'inactive',
      };

      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          if (seenExternalIds.has(v.id)) continue;
          seenExternalIds.add(v.id);

          flatProducts.push({
            external_id: v.id,
            sku: v.sku,
            name: `${p.name}${v.variantName && v.variantName !== 'Default' ? ` - ${v.variantName}` : ''}`,
            brand: baseProduct.brand,
            category: baseProduct.category,
            status: v.isActive ? baseProduct.status : 'inactive',
            updated_at: v.updatedAt.toISOString(),
          });
        }
      } else {
        if (seenExternalIds.has(p.id)) continue;
        seenExternalIds.add(p.id);

        flatProducts.push({
          external_id: p.id,
          sku: '', // Standalone products may not have an explicit SKU in variant structure
          name: p.name,
          brand: baseProduct.brand,
          category: baseProduct.category,
          status: baseProduct.status,
          updated_at: p.updatedAt.toISOString(),
        });
      }
    }

    // Sort by name, then external_id
    flatProducts.sort((a, b) => {
      const nameCmp = a.name.localeCompare(b.name);
      if (nameCmp !== 0) return nameCmp;
      return a.external_id.localeCompare(b.external_id);
    });

    console.log(`[ZOHO-CREATOR-API] PRODUCT_QUERY_COMPLETE`, { count: flatProducts.length });
    
    const responsePayload = {
      data: flatProducts,
      meta: {
        count: flatProducts.length,
        generated_at: new Date().toISOString()
      }
    };

    console.log(`[ZOHO-CREATOR-API] API_RESPONSE_SENT`, { durationMs: Date.now() - tReqStart });
    
    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('[ZOHO-CREATOR-API] API_ERROR:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

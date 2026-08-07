import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getNextProductCode } from '@/lib/product-service';
import { CatalogResolver } from '@/lib/services/CatalogResolver';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.system_productMigration)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const totalSkus = await prisma.sku.count();
    
    // Find how many SKUs are already migrated
    const migratedVariants = await prisma.productVariant.findMany({
      select: { sku: true },
      where: {
        product: {
          code: { startsWith: 'MIG-' }
        }
      }
    });

    // We can just count Sku records that are not in ProductVariant.sku
    // But since Sku ID was e.g. KT2001 and variant sku could be same or PRD-X-V1.
    // If we map ProductVariant.sku to Sku.id during migration:
    
    const migratedSkuIds = await prisma.productVariant.findMany({
      select: { sku: true }
    });
    const migratedIdsSet = new Set(migratedSkuIds.map(v => v.sku));

    const allSkus = await prisma.sku.findMany({ select: { id: true } });
    
    const eligibleCount = allSkus.filter(s => !migratedIdsSet.has(s.id)).length;

    return NextResponse.json({
      totalSkus,
      eligibleCount,
      migratedCount: allSkus.length - eligibleCount,
    });
  } catch (error: any) {
    console.error(`[API] GET /api/admin/catalog/products/import error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.system_productMigration)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = parseInt(body.limit, 10) || 50;
    
    const allSkus = await prisma.sku.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    const migratedSkuIds = await prisma.productVariant.findMany({
      select: { sku: true }
    });
    const migratedIdsSet = new Set(migratedSkuIds.map(v => v.sku));

    const allEligibleSkus = allSkus.filter(s => !migratedIdsSet.has(s.id));
    const eligibleSkus = allEligibleSkus.slice(0, limit);

    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Process in batches
    for (const sku of eligibleSkus) {
      try {
        const productCode = await getNextProductCode();
        
        await prisma.product.create({
          data: {
            code: productCode,
            name: sku.name,
            description: sku.description,
            brandId: sku.brandId,
            categoryId: sku.categoryId,
            status: 'Active',
            isActive: sku.isActive,
            createdById: session.userId,
            updatedById: session.userId,
            approvedById: session.userId,
            createdAt: sku.createdAt,
            updatedAt: sku.updatedAt,
            approvedAt: new Date(),
            variants: {
              create: {
                variantName: 'Default',
                sku: sku.id, // KEEP legacy sku id as the variant sku for mapping
                purchasePrice: 0,
                sellingPrice: sku.price,
                trackInventory: !sku.isUnlimited,
                trackSerials: false,
                isDefault: true,
                isActive: sku.isActive,
                createdAt: sku.createdAt,
                updatedAt: sku.updatedAt,
                zohoBookItemId: sku.zohoBookItemId,
              }
            }
          }
        });
        createdCount++;
      } catch (err) {
        console.error(`Error migrating SKU ${sku.id}:`, err);
        failedCount++;
      }
    }

    skippedCount = allSkus.length - allEligibleSkus.length;
    const remainingCount = allEligibleSkus.length - createdCount;

    CatalogResolver.invalidateCache();

    return NextResponse.json({
      success: true,
      createdCount,
      skippedCount,
      failedCount,
      remainingCount,
    });
  } catch (error: any) {
    console.error(`[API] POST /api/admin/catalog/products/import error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

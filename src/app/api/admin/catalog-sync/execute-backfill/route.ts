import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getNextProductCode } from '@/lib/product-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { confirmed, dryRun } = body;

    if (!confirmed || dryRun !== false) {
      return NextResponse.json({ error: 'Execution requires confirmed=true and dryRun=false' }, { status: 400 });
    }

    // Identify legacy SKUs that don't have a corresponding ProductVariant mapping
    const skus = await prisma.sku.findMany();
    const variants = await prisma.productVariant.findMany({ select: { sku: true } });
    const variantSkuSet = new Set(variants.map(v => v.sku));

    const unmappedSkus = skus.filter(s => !variantSkuSet.has(s.id));

    if (unmappedSkus.length === 0) {
      return NextResponse.json({ message: 'No unmapped SKUs found. System is fully mapped.', processed: 0 });
    }

    let processedCount = 0;
    
    // Execute inside a Prisma transaction
    await prisma.$transaction(async (tx) => {
      for (const sku of unmappedSkus) {
        // Create Product
        const productCode = await getNextProductCode();
        const product = await tx.product.create({
          data: {
            code: productCode,
            name: sku.name,
            description: sku.description || `Auto-migrated from legacy SKU ${sku.id}`,
            type: 'Goods',
            brandId: sku.brandId,
            categoryId: sku.categoryId,
            status: sku.isActive ? 'Active' : 'Draft',
            isActive: sku.isActive,
            catalogType: 'PRODUCT',
            isVariantProduct: false,
            // Fallback for zohoBookItemId mapped to sku.zohoBookItemId if needed elsewhere, 
            // but the mapping is primarily on the Variant
          }
        });

        // Create Default Variant mapping to the SKU
        await tx.productVariant.create({
          data: {
            productId: product.id,
            variantName: 'Default',
            sku: sku.id,
            purchasePrice: sku.price, // Fallback since only one price exists on legacy Sku
            sellingPrice: sku.price,
            trackInventory: true,
            isDefault: true,
            isActive: sku.isActive,
            zohoBookItemId: sku.zohoBookItemId || sku.zohoBooksId2 || null
          }
        });

        processedCount++;
      }
    });

    return NextResponse.json({
      message: 'Backfill executed successfully',
      processed: processedCount
    });

  } catch (error: any) {
    console.error('Backfill Execute API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

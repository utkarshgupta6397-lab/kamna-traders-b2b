const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAudit() {
  const rootCategory = await prisma.category.findFirst({
    where: { name: 'Solar Panels' }
  });

  if (!rootCategory) {
    console.log('Solar Panels category not found');
    process.exit(1);
  }

  const allCategories = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const categoryIds = new Set();
  const findDescendants = (parentId) => {
    categoryIds.add(parentId);
    for (const cat of allCategories) {
      if (cat.parentId === parentId) findDescendants(cat.id);
    }
  };
  findDescendants(rootCategory.id);
  const validCategoryIds = Array.from(categoryIds);

  const products = await prisma.product.findMany({
    where: { categoryId: { in: validCategoryIds } },
    include: { variants: true }
  });

  const stats = {
    totalProductRecords: products.length,
    catalogTypeProduct: 0,
    catalogTypeFamily: 0,
    standardProducts: 0,
    variantProducts: 0,
    skuPending: 0,
    inactiveProducts: 0,
    apiReturnedRecords: 0,
    apiStandardCount: 0,
    apiVariantCount: 0,
    apiFamilyCount: 0,
  };

  const skuSet = new Set();
  const duplicateSkus = new Set();

  for (const p of products) {
    if (p.catalogType === 'PRODUCT') stats.catalogTypeProduct++;
    if (p.catalogType === 'PRODUCT_FAMILY') stats.catalogTypeFamily++;
    if (p.catalogType === 'PRODUCT' && p.isVariantProduct === false) stats.standardProducts++;
    if (p.catalogType === 'PRODUCT' && p.isVariantProduct === true) stats.variantProducts++;
    
    // Inactive check (product inactive or variant inactive)
    let isInactive = p.status !== 'Active';

    // Simulate API returned logic
    if (p.catalogType !== 'PRODUCT_FAMILY') {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          stats.apiReturnedRecords++;
          if (p.isVariantProduct) stats.apiVariantCount++;
          else stats.apiStandardCount++;

          if (v.sku.includes('SKU-PENDING')) stats.skuPending++;
          if (skuSet.has(v.sku)) duplicateSkus.add(v.sku);
          skuSet.add(v.sku);
          
          if (!v.isActive || p.status !== 'Active') stats.inactiveProducts++;
        }
      } else {
        stats.apiReturnedRecords++;
        if (p.isVariantProduct) stats.apiVariantCount++;
        else stats.apiStandardCount++;
        
        if (p.status !== 'Active') stats.inactiveProducts++;
      }
    } else {
      // For PRODUCT_FAMILY not returned by API, we still count its variants for the global duplicate SKU and SKU-PENDING stats
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          if (v.sku.includes('SKU-PENDING')) stats.skuPending++;
          if (skuSet.has(v.sku)) duplicateSkus.add(v.sku);
          skuSet.add(v.sku);
        }
      }
    }
  }

  console.log('--- AUDIT RESULTS ---');
  console.log(`1. Total Product records: ${stats.totalProductRecords}`);
  console.log(`2. PRODUCT records: ${stats.catalogTypeProduct}`);
  console.log(`3. PRODUCT_FAMILY records: ${stats.catalogTypeFamily}`);
  console.log(`4. Standard products (PRODUCT, !isVariant): ${stats.standardProducts}`);
  console.log(`5. Variant products (PRODUCT, isVariant): ${stats.variantProducts}`);
  console.log(`6. Products with SKU-PENDING: ${stats.skuPending}`);
  console.log(`7. Inactive products (in API scope): ${stats.inactiveProducts}`);
  console.log(`8. Duplicate SKUs: ${Array.from(duplicateSkus).join(', ') || 'None'}`);
  console.log(`9. Products returned by API: ${stats.apiReturnedRecords}`);
  console.log(`--- API RECORD CLASSIFICATION ---`);
  console.log(`API records with catalogType PRODUCT + isVariantProduct false: ${stats.apiStandardCount}`);
  console.log(`API records with catalogType PRODUCT + isVariantProduct true: ${stats.apiVariantCount}`);
  console.log(`API records with catalogType PRODUCT_FAMILY: ${stats.apiFamilyCount}`);

  await prisma.$disconnect();
}

runAudit().catch(console.error);

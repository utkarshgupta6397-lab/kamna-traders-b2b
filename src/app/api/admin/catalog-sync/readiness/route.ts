import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CatalogValidator } from '@/lib/services/catalog-validator';

export async function GET() {
  try {
    const report = await CatalogValidator.getRelationshipReport();

    // Health Score calculation
    // Max score = 100
    // Deductions:
    // - variants without SKU: high impact
    // - SKUs without Product/Variant: high impact
    // - duplicate Zoho IDs: high impact
    let score = 100;
    
    const variantsWithoutSku = report.unmappedVariants;
    const skusWithoutProduct = report.unmappedSkus;
    const duplicateZohoIds = report.brokenRelationships.duplicateZohoIds;

    const totalExpectedMappings = report.totalVariants + report.totalSkus;
    const totalIssues = variantsWithoutSku + skusWithoutProduct + duplicateZohoIds;
    
    if (totalExpectedMappings > 0) {
      score = Math.max(0, 100 - Math.round((totalIssues / totalExpectedMappings) * 100));
    }

    let status = 'Healthy';
    if (score < 100) status = 'Needs Sync';
    if (score < 80) status = 'Critical Sync Required';

    const health = {
      totalProducts: report.totalProducts,
      totalVariants: report.totalVariants,
      totalSkus: report.totalSkus,
      productsWithoutSku: report.unmappedVariants, // A variant maps a product to an SKU
      skusWithoutProduct: report.unmappedSkus,
      variantsWithoutSku: report.unmappedVariants,
      duplicateSku: report.brokenRelationships.duplicateVariantMapping,
      duplicateZohoIds: report.brokenRelationships.duplicateZohoIds,
      status,
      score,
    };

    return NextResponse.json({
      health,
      report, // Keeping for backward compatibility if UI still uses it
    });
  } catch (error: any) {
    console.error('Sync Health API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

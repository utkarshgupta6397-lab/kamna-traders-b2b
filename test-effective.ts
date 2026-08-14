import { PrismaClient } from '@prisma/client';
import { ZohoProductService } from './src/lib/services/zoho-books/ZohoProductService';
import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const variantId = 'cmsq64uc7000bua5hb4fs9j57';
  
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { include: { parentProduct: true } } }
  });

  if (!variant || !variant.product) return;

  const localIncentive = variant.product.incentiveTag;
  const localImage = !!variant.product.thumbnailBase64;
  
  const parentIncentive = variant.product.parentProduct?.incentiveTag;
  const parentImage = !!variant.product.parentProduct?.thumbnailBase64;
  
  // Replicate resolveEffectiveZohoProductData logic
  let effectiveIncentive = localIncentive;
  if (!effectiveIncentive && parentIncentive) effectiveIncentive = parentIncentive;
  
  let effectiveImage = variant.product.thumbnailBase64;
  if (!effectiveImage && variant.product.parentProduct?.thumbnailBase64) effectiveImage = variant.product.parentProduct.thumbnailBase64;

  const oldHash = variant.zohoSyncHash;
  
  // Actually load it using the real ZohoProductService method using an any-cast
  const newHash = (ZohoProductService as any).computeSyncHash(variant);
  
  console.log('LOCAL VARIANT:');
  console.log('  incentive =', localIncentive);
  console.log('  image =', localImage);
  console.log('PARENT:');
  console.log('  incentive =', parentIncentive);
  console.log('  image =', parentImage);
  console.log('EFFECTIVE:');
  console.log('  incentive =', effectiveIncentive);
  console.log('  image =', !!effectiveImage);
  console.log('HASH:');
  console.log('  old =', oldHash);
  console.log('  new =', newHash);
  console.log('\n--- PERFORMING MANUAL SYNC ---');

  const runId = 'test-effective-123';
  const result = await ZohoProductService.syncVariant(variantId, 'MANUAL_SYNC', runId);
  console.log('Sync result:', result.success, result.zohoSyncStatus);

  console.log('\n--- FETCHING STATE POST SYNC ---');
  const finalVariant = await prisma.productVariant.findUnique({ where: { id: variantId }});
  
  const token = await getZohoTokens();
  const orgId = getZohoOrgId();
  const zohoRes = await fetch(`https://www.zohoapis.in/books/v3/items/1759923000024030068?organization_id=${orgId}`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
  });
  const data = await zohoRes.json();
  const zohoItem = data.item;
  const zohoIncentive = zohoItem?.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category')?.value;

  console.log('ZOHO:');
  console.log('  incentive =', zohoIncentive);
  console.log('  image_name =', zohoItem?.image_name);
  console.log('DB:');
  console.log('  zohoSyncStatus =', finalVariant?.zohoSyncStatus);
  console.log('  zohoSyncHash =', finalVariant?.zohoSyncHash);

  await prisma.$disconnect();
}
main();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching products...');
  const products = await prisma.product.findMany();
  let count = 0;

  const usedSkus = new Set<string>();

  for (const product of products) {
    let sanitized = product.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Ensure uniqueness
    if (usedSkus.has(sanitized)) {
      let suffixAscii = 65; // 'A'
      let uniqueSku = `${sanitized}${String.fromCharCode(suffixAscii)}`;
      while (usedSkus.has(uniqueSku)) {
        suffixAscii++;
        if (suffixAscii > 90) { // beyond Z
            uniqueSku = `${sanitized}${suffixAscii - 90}`; // 1, 2, 3...
        } else {
            uniqueSku = `${sanitized}${String.fromCharCode(suffixAscii)}`;
        }
      }
      sanitized = uniqueSku;
    }

    usedSkus.add(sanitized);

    if (product.code !== sanitized) {
      console.log(`Updating Product: ${product.code} -> ${sanitized}`);
      await prisma.product.update({
        where: { id: product.id },
        data: { code: sanitized }
      });
      count++;
    } else {
      console.log(`Unchanged Product: ${product.code}`);
    }
  }

  console.log('Fetching variants...');
  const variants = await prisma.productVariant.findMany();
  for (const variant of variants) {
    let sanitized = variant.sku.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (usedSkus.has(sanitized)) {
      let suffixAscii = 65;
      let uniqueSku = `${sanitized}${String.fromCharCode(suffixAscii)}`;
      while (usedSkus.has(uniqueSku)) {
        suffixAscii++;
        if (suffixAscii > 90) {
            uniqueSku = `${sanitized}${suffixAscii - 90}`;
        } else {
            uniqueSku = `${sanitized}${String.fromCharCode(suffixAscii)}`;
        }
      }
      sanitized = uniqueSku;
    }
    
    usedSkus.add(sanitized);

    if (variant.sku !== sanitized) {
      console.log(`Updating Variant: ${variant.sku} -> ${sanitized}`);
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { sku: sanitized }
      });
      count++;
    } else {
      console.log(`Unchanged Variant: ${variant.sku}`);
    }
  }

  console.log(`Done. Migrated ${count} records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

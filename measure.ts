import { PrismaClient } from '@prisma/client';
import { buildProductWhereClause } from './src/lib/services/ProductFilterService';

const prisma = new PrismaClient();

async function run() {
  const q = new URLSearchParams('search=solar&limit=25');
  const where = buildProductWhereClause(q);

  console.log('--- MEASURING GET /products ---');
  
  let t0 = Date.now();
  const total = await prisma.product.count({ where });
  const tCount = Date.now() - t0;
  
  t0 = Date.now();
  const records = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    skip: 0,
    take: 25,
    include: {
      brand: { select: { id: true, name: true } },
      manufacturer: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      hsnCode: { select: { id: true, code: true, name: true } },
      taxRate: { select: { id: true, name: true, percentage: true } },
      unit: { select: { id: true, abbreviation: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      variants: true,
      variantAttribute: true,
      variantProducts: {
        include: {
          variants: true,
        },
        orderBy: { createdAt: 'asc' }
      },
      parentProduct: { select: { id: true, name: true, code: true, thumbnailBase64: true } },
    },
  });
  const tFindMany = Date.now() - t0;

  t0 = Date.now();
  const recordsLight = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    skip: 0,
    take: 25,
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      variants: { select: { sku: true, sellingPrice: true, trackInventory: true, trackSerials: true } },
      variantProducts: {
        select: {
          variants: { select: { sellingPrice: true } }
        }
      }
    },
  });
  const tFindManyLight = Date.now() - t0;

  console.log(`Prisma COUNT duration: ${tCount}ms`);
  console.log(`Prisma findMany (Heavy) duration: ${tFindMany}ms`);
  console.log(`Prisma findMany (Light) duration: ${tFindManyLight}ms`);
  console.log(`Heavy Payload Size: ${JSON.stringify(records).length} bytes`);
  console.log(`Light Payload Size: ${JSON.stringify(recordsLight).length} bytes`);

  console.log('\n--- MEASURING GET /category-stats ---');
  t0 = Date.now();
  const productsGrouped = await prisma.product.groupBy({
    by: ['categoryId'],
    where,
    _count: { _all: true },
  });
  const tGroupBy = Date.now() - t0;
  console.log(`Prisma groupBy duration: ${tGroupBy}ms`);

  process.exit(0);
}

run().catch(console.error);

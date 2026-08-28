import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to LOCAL database to seed Wire & Cable data...");

  // 1. Get Warehouses
  const warehouses = await prisma.warehouse.findMany();
  console.log(`Found ${warehouses.length} warehouses.`);
  const warehouseNames = ['Main Solar Warehouse', 'Delhi Warehouse', 'Meerut Warehouse', 'Lucknow Warehouse', 'Noida Warehouse'];
  for (const wName of warehouseNames) {
      const exists = warehouses.find(w => w.name === wName);
      if (!exists) {
          console.log(`Creating warehouse ${wName}`);
          await prisma.warehouse.create({
              data: { name: wName, active: true, isSystemWarehouse: false }
          });
      }
  }
  const updatedWarehouses = await prisma.warehouse.findMany();
  const whList = updatedWarehouses.filter(w => !w.isSystemWarehouse);
  console.log(`Using ${whList.length} operational warehouses.`);
  
  // 2. Get/Create Categories
  const rootCategory = await prisma.category.findFirst({ where: { name: 'Wire & Cables' } });
  if (!rootCategory) throw new Error("Wire & Cables category not found!");
  
  let acWire = await prisma.category.findFirst({ where: { name: 'AC Wire', parentId: rootCategory.id } });
  if (!acWire) {
      acWire = await prisma.category.create({
          data: { name: 'AC Wire', code: 'CAT-AC-WIRE', parentId: rootCategory.id, active: true, status: 'Active' }
      });
  }
  
  let dcWire = await prisma.category.findFirst({ where: { name: 'DC Wire', parentId: rootCategory.id } });
  if (!dcWire) {
      dcWire = await prisma.category.create({
          data: { name: 'DC Wire', code: 'CAT-DC-WIRE', parentId: rootCategory.id, active: true, status: 'Active' }
      });
  }

  let uncat = await prisma.category.findFirst({ where: { name: 'Uncategorized' } });
  if (!uncat) {
      uncat = await prisma.category.create({
          data: { name: 'Uncategorized', code: 'CAT-UNCAT', active: true, status: 'Active' }
      });
  }

  // 3. Get/Create Brands
  const brandNames = ['Havells', 'Microtek', 'Polycab', 'Finolex', 'RR Kabel', 'KEI'];
  const brandMap = new Map();
  for (const name of brandNames) {
      let b = await prisma.brand.findFirst({ where: { name } });
      if (!b) {
          b = await prisma.brand.create({ data: { name, active: true, code: `BRD-${name.toUpperCase().substring(0, 3)}` } });
      }
      brandMap.set(name, b);
  }

  // 4. Get/Create Attributes
  const attrWidth = await prisma.productAttribute.findFirst({ where: { attributeName: 'Wire Width (sqmm)' } }) || 
                    await prisma.productAttribute.create({ data: { attributeName: 'Wire Width (sqmm)' } });
  const attrColor = await prisma.productAttribute.findFirst({ where: { attributeName: 'Wire Color' } }) ||
                    await prisma.productAttribute.create({ data: { attributeName: 'Wire Color' } });
  const attrLength = await prisma.productAttribute.findFirst({ where: { attributeName: 'Bundle Length' } }) ||
                     await prisma.productAttribute.create({ data: { attributeName: 'Bundle Length' } });

  // 5. Data generation plan
  const colors = ['Black', 'Red', 'Blue', 'Green', 'Yellow'];
  const widths = ['0.50', '0.75', '1', '1.5', '2.5', '4', '6', '10', '16'];
  const lengths = ['90', '100', '180', '200'];
  
  const generateSku = (brand, width, color, idx) => `TEST-WIRE-${brand.substring(0,3).toUpperCase()}-${width.replace('.', '')}-${color.substring(0,3).toUpperCase()}-${idx}`;

  let totalSkusCreated = 0;
  
  // Clean up previous test products to make it idempotent
  const oldTestProducts = await prisma.product.findMany({ where: { code: { startsWith: 'TEST-WIRE-' } } });
  for (const p of oldTestProducts) {
      // Must delete dependencies first (inventory, variants, attribute values)
      const variants = await prisma.productVariant.findMany({ where: { productId: p.id } });
      for (const v of variants) {
          await prisma.warehouseInventory.deleteMany({ where: { skuId: v.sku } });
          await prisma.sku.delete({ where: { id: v.sku } }).catch(() => {});
      }
      await prisma.productVariant.deleteMany({ where: { productId: p.id } });
      await prisma.productAttributeValue.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } });
  }

  const oldUncat = await prisma.product.findMany({ where: { code: { startsWith: 'TEST-UNCAT-' } } });
  for (const p of oldUncat) {
      const variants = await prisma.productVariant.findMany({ where: { productId: p.id } });
      for (const v of variants) { 
          await prisma.warehouseInventory.deleteMany({ where: { skuId: v.sku } }); 
          await prisma.sku.delete({ where: { id: v.sku } }).catch(() => {});
      }
      await prisma.productVariant.deleteMany({ where: { productId: p.id } });
      await prisma.productAttributeValue.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } });
  }

  console.log("Cleaned up old test products. Starting fresh seed...");

  // Generate 40-50 AC Wires, 10-15 DC Wires
  const configs = [
      { type: acWire, brand: 'Havells', widths: ['0.50', '1', '1.5', '2.5', '4', '6'], count: 18 },
      { type: acWire, brand: 'Microtek', widths: ['2.5', '4', '6'], count: 8 },
      { type: acWire, brand: 'Polycab', widths: ['1.5', '2.5', '4', '6'], count: 10 },
      { type: acWire, brand: 'Finolex', widths: ['1', '1.5', '2.5'], count: 6 },
      { type: dcWire, brand: 'Havells', widths: ['4', '6', '10'], count: 6 },
      { type: dcWire, brand: 'Polycab', widths: ['4', '6', '10', '16'], count: 8 },
      { type: dcWire, brand: 'KEI', widths: ['6', '10'], count: 4 },
  ];

  let skuCounter = 1;

  for (const conf of configs) {
      const bObj = brandMap.get(conf.brand);
      
      for (let i = 0; i < conf.count; i++) {
          const width = conf.widths[i % conf.widths.length];
          const color = colors[i % colors.length];
          const length = lengths[i % lengths.length];
          
          let wVal = width;
          // Normalization test cases
          if (skuCounter === 1 && width === '4') wVal = '4.0';
          if (skuCounter === 2 && width === '4') wVal = '4.00';
          if (skuCounter === 3 && width === '2.5') wVal = '2.50';

          let cVal = color;
          // Missing attribute test
          if (skuCounter === 10) cVal = null; // missing color

          const sku = generateSku(conf.brand, width, color, skuCounter);
          const name = `${width} sqmm Single Core ${cVal || 'Unknown'} ${length}m ${conf.brand} Wire`;

          const p = await prisma.product.create({
              data: {
                  name,
                  category: { connect: { id: conf.type.id } },
                  brand: { connect: { id: bObj.id } },
                  isActive: true,
                  status: 'Active',
                  code: sku,
              }
          });

          // Attributes
          await prisma.productAttributeValue.create({
              data: { productId: p.id, attributeId: attrWidth.id, value: wVal }
          });
          
          if (cVal) {
              await prisma.productAttributeValue.create({
                  data: { productId: p.id, attributeId: attrColor.id, value: cVal }
              });
          }

          // Randomly assign bundle length
          if (skuCounter % 3 !== 0) {
              await prisma.productAttributeValue.create({
                  data: { productId: p.id, attributeId: attrLength.id, value: length }
              });
          }

          const variant = await prisma.productVariant.create({
              data: {
                  productId: p.id,
                  sku: sku, // the actual variant sku
                  variantName: p.name,
                  sellingPrice: 1000 + (skuCounter * 10),
                  trackInventory: true,
              }
          });

          // Inventory
          // Create Sku first
          await prisma.sku.upsert({
              where: { id: variant.sku },
              update: {},
              create: { id: variant.sku, name: p.name, brandId: bObj.id, categoryId: conf.type.id }
          }).catch(async (e) => {
              // categoryId might not exist on sku depending on schema, fallback:
              await prisma.sku.upsert({
                  where: { id: variant.sku },
                  update: {},
                  create: { id: variant.sku, name: p.name, brandId: bObj.id }
              });
          });

          // Zero stock test case
          if (skuCounter === 20 || skuCounter === 25) {
              // no inventory records or zero
              await prisma.warehouseInventory.create({
                  data: { skuId: variant.sku, warehouseId: whList[0].id, qty: 0 }
              });
          } else {
              // distribute across 3-5 warehouses
              const numWh = Math.min(3 + (skuCounter % 3), whList.length);
              for (let wIdx = 0; wIdx < numWh; wIdx++) {
                  const wh = whList[(skuCounter + wIdx) % whList.length];
                  const qty = [5, 12, 25, 40, 60, 75, 100, 120, 150, 200, 250, 350, 500][skuCounter % 13];
                  await prisma.warehouseInventory.create({
                      data: { skuId: variant.sku, warehouseId: wh.id, qty }
                  });
              }
          }

          skuCounter++;
          totalSkusCreated++;
      }
  }

  // Uncategorized test cases
  for (let i = 1; i <= 2; i++) {
      const sku = `TEST-UNCAT-WIRE-0${i}`;
      const p = await prisma.product.create({
          data: {
              name: `6 sqmm Single Core Blue Wire Deepcab Test ${i}`,
              category: { connect: { id: uncat.id } },
              isActive: true,
              status: 'Active',
              code: sku,
          }
      });
      const variant = await prisma.productVariant.create({
          data: { productId: p.id, sku: sku, variantName: p.name, sellingPrice: 500, trackInventory: true }
      });
      await prisma.sku.upsert({
          where: { id: variant.sku },
          update: {},
          create: { id: variant.sku, name: p.name, categoryId: uncat.id }
      }).catch(async () => {
          await prisma.sku.upsert({
              where: { id: variant.sku },
              update: {},
              create: { id: variant.sku, name: p.name }
          });
      });
      await prisma.warehouseInventory.create({
          data: { skuId: variant.sku, warehouseId: whList[0].id, qty: 50 }
      });
  }

  console.log(`\nSeed Complete!`);
  console.log(`Total Wire & Cable SKUs created: ${totalSkusCreated}`);
  console.log(`Uncategorized control products created: 2`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Solar Accessories test data...');

  const brand = await prisma.brand.upsert({
    where: { id: 'BR_ACC_1' },
    update: { name: 'Generic Accessories' },
    create: { id: 'BR_ACC_1', name: 'Generic Accessories' },
  });

  const parentCategory = await prisma.category.upsert({
    where: { id: 'CAT_SOLAR_ACCESSORIES' },
    update: { name: 'Solar Accessories' },
    create: { id: 'CAT_SOLAR_ACCESSORIES', name: 'Solar Accessories', active: true, status: 'Active' },
  });

  const childCategoriesData = [
    { name: 'Mounting Accessories', products: ['Aluminium Mounting Rail', 'Mid Clamp', 'End Clamp', 'L Foot', 'Rail Splice'] },
    { name: 'DC Protection', products: ['DC MCB 2 Pole', 'DC SPD Type 2', 'DC Fuse Holder', 'DC Combiner Box'] },
    { name: 'AC Protection', products: ['AC MCB', 'AC SPD Type 2', 'AC Distribution Box', 'Changeover Switch'] },
    { name: 'Connectors', products: ['MC4 Connector Pair', 'MC4 Branch Connector', 'Solar DC Cable Connector'] },
    { name: 'Earthing & Safety', products: ['Earthing Rod', 'Earthing Clamp', 'Lightning Arrestor', 'Copper Earthing Strip'] }
  ];

  const warehouseNames = [
    'Chennai Storage',
    'Delhi Hub',
    'Delhi Warehouse',
    'Hyderabad Hub',
    'Kolkata Facility'
  ];

  const warehouses = await Promise.all(
    warehouseNames.map(async (name, i) => 
      prisma.warehouse.upsert({
        where: { id: `WH_ACC_${i}` },
        update: { name, active: true },
        create: { id: `WH_ACC_${i}`, name, active: true, address: `Test Address ${name}` },
      })
    )
  );

  let pCounter = 0;
  for (const catData of childCategoriesData) {
    const childCatId = `CAT_ACC_${catData.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    const childCat = await prisma.category.upsert({
      where: { id: childCatId },
      update: { name: catData.name, parentId: parentCategory.id },
      create: { id: childCatId, name: catData.name, parentId: parentCategory.id, active: true, status: 'Active' },
    });

    for (const prodName of catData.products) {
      pCounter++;
      const prodCode = `ACC-${1000 + pCounter}`;
      
      const prod = await prisma.product.upsert({
        where: { code: prodCode },
        update: { categoryId: childCat.id, name: prodName, brandId: brand.id },
        create: {
          code: prodCode,
          name: prodName,
          brandId: brand.id,
          categoryId: childCat.id,
          status: 'Active',
          isActive: true
        }
      });

      const variantId = `${prodCode}-V1`;
      await prisma.productVariant.upsert({
        where: { sku: variantId },
        update: { trackInventory: true },
        create: {
          productId: prod.id,
          sku: variantId,
          variantName: 'Default',
          isActive: true,
          trackInventory: true
        }
      });
      
      let uom = 'pcs';
      if (catData.name === 'Connectors') uom = 'pair';
      else if (prodName.includes('Rail') || prodName.includes('Strip')) uom = 'mtr';

      await prisma.sku.upsert({
        where: { id: variantId },
        update: { name: prodName, brandId: brand.id, categoryId: childCat.id, unit: uom },
        create: {
          id: variantId,
          name: prodName,
          brandId: brand.id,
          categoryId: childCat.id,
          isActive: true,
          unit: uom
        }
      });

      // Generate varied inventory
      // We want a mix of high, low, medium, zero.
      // E.g., [150, 0, 50, 25, 0] or [10, 0, 0, 0, 0]
      for (let i = 0; i < warehouses.length; i++) {
        const wh = warehouses[i];
        
        // Pseudo-random generation based on index to ensure determinism but variation
        let qty = 0;
        const rand = (pCounter + i * 3) % 10;
        if (rand === 0 || rand === 1) qty = 0; // 20% chance of 0
        else if (rand < 5) qty = rand * 5; // 5, 10, 15, 20
        else if (rand < 8) qty = rand * 25; // 125, 150, 175
        else qty = rand * 100; // 800, 900

        await prisma.warehouseInventory.upsert({
          where: { warehouseId_skuId: { warehouseId: wh.id, skuId: variantId } },
          update: { qty: qty },
          create: { warehouseId: wh.id, skuId: variantId, qty: qty }
        });
      }
    }
  }

  console.log('✅ Solar Accessories test data seeded successfully');
}

main().catch(console.error).finally(() => prisma.$disconnect());

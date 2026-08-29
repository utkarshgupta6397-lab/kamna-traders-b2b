import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Inverter test data...');

  const brandNames = ['SolarX', 'PowerGen', 'InvertCorp', 'EcoEnergy'];
  const brands = await Promise.all(
    brandNames.map(async (name, i) => 
      prisma.brand.upsert({
        where: { id: `BR_INV_${i}` },
        update: { name },
        create: { id: `BR_INV_${i}`, name },
      })
    )
  );

  const category = await prisma.category.upsert({
    where: { id: 'CAT_INVERTER' },
    update: {},
    create: { id: 'CAT_INVERTER', name: 'Inverter', active: true, status: 'Active' },
  });

  // Create attributes
  const attrs = [
    { name: 'Inverter Type', dataType: 'Dropdown' },
    { name: 'Inverter Capacity', dataType: 'Text' },
    { name: 'Phase Type', dataType: 'Dropdown' },
    { name: 'Core', dataType: 'Dropdown' }
  ];

  const attrMap: Record<string, string> = {};
  for (const a of attrs) {
    const created = await prisma.productAttribute.upsert({
      where: { attributeName: a.name },
      update: {},
      create: { 
        attributeCode: `ATTR_${a.name.replace(/\s+/g, '_').toUpperCase()}`,
        attributeName: a.name,
        dataType: a.dataType,
        status: 'Active'
      }
    });
    attrMap[a.name] = created.id;
  }

  // Create 7 Warehouses to verify the max 5 display limit
  const warehouseNames = ['Main Warehouse', 'Delhi Hub', 'Mumbai Depot', 'Chennai Storage', 'Kolkata Facility', 'Pune Distribution', 'Hyderabad Hub'];
  const warehouses = await Promise.all(
    warehouseNames.map(async (name, i) => 
      prisma.warehouse.upsert({
        where: { id: `WH_TEST_${i}` },
        update: { name, active: true },
        create: { id: `WH_TEST_${i}`, name, active: true, address: 'Test Address' },
      })
    )
  );

  // Products definitions (inventory arrays now have 7 elements)
  const productsDef = [
    // Combo 1: Hybrid, 3.3 kW, Single Phase. Here, SKUs differ ONLY by Core.
    { code: 'INV-100-A', name: 'Hybrid 3.3 kW Model A (2 Core)', brandId: brands[0].id, attrs: { 'Inverter Type': 'Hybrid', 'Inverter Capacity': '3.3 kW', 'Phase Type': 'Single Phase', 'Core': '2 Core' }, stock: [5, 0, 0, 0, 0, 10, 5] },
    { code: 'INV-100-B', name: 'Hybrid 3.3 kW Model B (4 Core)', brandId: brands[0].id, attrs: { 'Inverter Type': 'Hybrid', 'Inverter Capacity': '3.3 kw', 'Phase Type': 'Single Phase', 'Core': '4 Core' }, stock: [10, 5, 0, 0, 0, 0, 0] },
    { code: 'INV-100-C', name: 'Hybrid 3.3 kW Model C (1 Core)', brandId: brands[0].id, attrs: { 'Inverter Type': 'Hybrid', 'Inverter Capacity': ' 3.3 KW ', 'Phase Type': 'Single Phase', 'Core': '1 Core' }, stock: [0, 20, 10, 5, 0, 0, 2] },
    
    // Combo 2: On-Grid, 5 kW, Three Phase
    { code: 'INV-101-A', name: 'On-Grid 5 kW v1', brandId: brands[1].id, attrs: { 'Inverter Type': 'On-Grid', 'Inverter Capacity': '5 kW', 'Phase Type': 'Three Phase', 'Core': '4 Core' }, stock: [15, 0, 0, 0, 0, 1, 0] },
    { code: 'INV-101-B', name: 'On-Grid 5 kW v2', brandId: brands[1].id, attrs: { 'Inverter Type': 'On-Grid', 'Inverter Capacity': '5000 W', 'Phase Type': 'Three Phase', 'Core': '2 Core' }, stock: [0, 10, 0, 0, 0, 0, 8] },

    // Combo 3: Off-Grid, 10 kVA, Single Phase
    { code: 'INV-102-A', name: 'Off-Grid 10 kVA Alpha', brandId: brands[2].id, attrs: { 'Inverter Type': 'Off-Grid', 'Inverter Capacity': '10 kVA', 'Phase Type': 'Single Phase', 'Core': '3 Core' }, stock: [0, 0, 0, 0, 50, 0, 0] },
    { code: 'INV-102-B', name: 'Off-Grid 10 kVA Beta', brandId: brands[2].id, attrs: { 'Inverter Type': 'Off-Grid', 'Inverter Capacity': '10 kva', 'Phase Type': 'Single Phase', 'Core': '4 Core' }, stock: [0, 0, 0, 0, 0, 0, 0] }, // Zero stock test

    // More distinct capacities and brands
    { code: 'INV-103', name: 'Eco Hybrid 1.5 kW', brandId: brands[3].id, attrs: { 'Inverter Type': 'Hybrid', 'Inverter Capacity': '1.5 kW', 'Phase Type': 'Single Phase', 'Core': '1 Core' }, stock: [2, 2, 2, 2, 2, 2, 2] },
    { code: 'INV-104', name: 'Eco On-Grid 50 kW', brandId: brands[3].id, attrs: { 'Inverter Type': 'On-Grid', 'Inverter Capacity': '50 kW', 'Phase Type': 'Three Phase', 'Core': '4 Core' }, stock: [1, 0, 0, 0, 0, 0, 0] },
    { code: 'INV-105', name: 'Eco Off-Grid 800 VA', brandId: brands[3].id, attrs: { 'Inverter Type': 'Off-Grid', 'Inverter Capacity': '800 VA', 'Phase Type': 'Single Phase', 'Core': '2 Core' }, stock: [0, 10, 10, 0, 0, 0, 0] },
    { code: 'INV-106', name: 'SolarX Pro 12 kW', brandId: brands[0].id, attrs: { 'Inverter Type': 'Hybrid', 'Inverter Capacity': '12 kW', 'Phase Type': 'Three Phase', 'Core': '4 Core' }, stock: [0, 0, 0, 0, 0, 0, 0] }, // Zero stock
    { code: 'INV-107', name: 'PowerGen Max 250 kW', brandId: brands[1].id, attrs: { 'Inverter Type': 'On-Grid', 'Inverter Capacity': '250 kW', 'Phase Type': 'Three Phase', 'Core': '4 Core' }, stock: [0, 0, 5, 0, 0, 0, 0] },

    // Unknown fallback cases
    { code: 'INV-108', name: 'Mystery Inverter 1', brandId: brands[2].id, attrs: { 'Inverter Type': 'Hybrid' }, stock: [5, 5, 5, 0, 0, 0, 0] }, // Missing capacity, phase, core
    { code: 'INV-109', name: 'Mystery Inverter 2', brandId: brands[2].id, attrs: { 'Inverter Capacity': '5 kW', 'Phase Type': 'Single Phase' }, stock: [0, 0, 0, 10, 10, 10, 0] }, // Missing type, core
    { code: 'INV-110', name: 'Mystery Inverter 3', brandId: brands[3].id, attrs: {}, stock: [1, 1, 1, 1, 1, 1, 1] }, // Missing everything
  ];

  for (const p of productsDef) {
    const prod = await prisma.product.upsert({
      where: { code: p.code },
      update: { categoryId: category.id, name: p.name, brandId: p.brandId },
      create: {
        code: p.code,
        name: p.name,
        brandId: p.brandId,
        categoryId: category.id,
        status: 'Active',
        isActive: true
      }
    });

    for (const [attrName, attrValue] of Object.entries(p.attrs)) {
      const attrId = attrMap[attrName];
      if (attrId) {
        await prisma.productAttributeValue.upsert({
          where: { productId_attributeId: { productId: prod.id, attributeId: attrId } },
          update: { value: attrValue },
          create: { productId: prod.id, attributeId: attrId, value: attrValue }
        });
      }
    }

    const variantId = `${p.code}-V1`;
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
    
    // Create Legacy SKU to satisfy the inventory map
    await prisma.sku.upsert({
      where: { id: variantId },
      update: { name: p.name, brandId: p.brandId, categoryId: category.id },
      create: {
        id: variantId,
        name: p.name,
        brandId: p.brandId,
        categoryId: category.id,
        isActive: true
      }
    });

    for (let i = 0; i < warehouses.length; i++) {
      const wh = warehouses[i];
      const qty = p.stock[i];
      if (qty >= 0) {
        await prisma.warehouseInventory.upsert({
          where: { warehouseId_skuId: { warehouseId: wh.id, skuId: variantId } },
          update: { qty: qty },
          create: { warehouseId: wh.id, skuId: variantId, qty: qty }
        });
      }
    }
  }

  console.log('✅ Expanded Inverter data seeded successfully with Core testing variations');
}

main().catch(console.error).finally(() => prisma.$disconnect());

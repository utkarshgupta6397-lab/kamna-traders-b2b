import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';


const CATEGORIES = [
  "Solar Panels",
  "Solar Inverters",
  "Lithium Batteries",
  "Tubular Batteries",
  "ACDB/DCDB Boxes",
  "MC4 Connectors",
  "Solar Cables",
  "Street Lights",
  "Mounting Structures",
  "Charge Controllers",
  "Water Heaters",
  "Tools"
];

const BRANDS = ["Microtek", "Luminous", "Loom Solar", "Waaree", "Vikram Solar", "Exide", "Havells", "Schneider"];

const IMAGES = [
  "https://images.unsplash.com/photo-1509391366360-fe5bb58583bb?auto=format&fit=crop&w=400&q=80",
];

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    console.log("HARD RESET: Purging all data...");
    
    // 1. Purge Existing Data (Foreign Key safe order)
    await prisma.warehouseInventory.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.sku.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.brand.deleteMany({});

    // 2. Create Categories
    const catMap: Record<string, string> = {};
    for (const name of CATEGORIES) {
      const id = `CAT_${name.toUpperCase().replace(/\//g, '_').replace(/\s+/g, '_')}`;
      const cat = await prisma.category.create({
        data: { id, name }
      });
      catMap[name] = cat.id;
    }

    // 3. Create Brands
    const brandMap: Record<string, string> = {};
    for (const name of BRANDS) {
      const brand = await prisma.brand.create({
        data: { name }
      });
      brandMap[name] = brand.id;
    }

    // 4. Seed Solar Inventory (150 SKUs)
    const skusToCreate = [];
    for (let i = 1; i <= 150; i++) {
      const catName = CATEGORIES[i % CATEGORIES.length];
      const brandName = BRANDS[i % BRANDS.length];
      const prefix = catName.substring(0, 3).toUpperCase();
      const skuId = `${prefix}${String(i).padStart(4, '0')}`;
      
      const skuData = {
        id: skuId,
        name: `${brandName} ${catName} Model ${100 + i}X-Industrial`,
        categoryId: catMap[catName],
        brandId: brandMap[brandName],
        price: Math.floor(Math.random() * 45000) + 2500,
        moq: i % 8 === 0 ? 5 : 1,
        stepQty: 1,
        unit: catName.includes("Cable") ? "ROLL" : "PCS",
        isActive: true,
        imageUrl: IMAGES[0],
      };
      
      await prisma.sku.create({ data: skuData });
      skusToCreate.push(skuId);
    }

    // 5. Initialize Main Warehouse Inventory
    const mainWarehouse = await prisma.warehouse.findFirst();
    if (mainWarehouse) {
      for (const skuId of skusToCreate) {
        await prisma.warehouseInventory.create({
          data: {
            warehouseId: mainWarehouse.id,
            skuId: skuId,
            qty: 1000,
            isOos: false
          }
        });
      }
    }

    return NextResponse.json({ success: true, message: "Hard Reset: 150 Industrial Solar SKUs seeded." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

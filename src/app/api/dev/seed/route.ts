import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

const CATEGORIES = [
  "Solar Panels",
  "Solar Inverters",
  "Lithium Batteries",
  "Tubular Batteries",
  "Charge Controllers",
  "MC4 Connectors",
  "DC Solar Cables",
  "ACDB / DCDB Boxes",
  "Mounting Structures",
  "Solar Water Heaters",
  "Solar Street Lights",
  "Electrical Tools"
];

const IMAGES = [
  "https://images.unsplash.com/photo-1509391366360-fe5bb58583bb?auto=format&fit=crop&w=400&q=80", // Panels
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Inverters
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Batteries
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Tubular
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Charge
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // MC4
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Cables
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Boxes
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Mounting
  "https://images.unsplash.com/photo-1509391366360-fe5bb58583bb?auto=format&fit=crop&w=400&q=80", // Water heaters
  "https://images.unsplash.com/photo-1509391366360-fe5bb58583bb?auto=format&fit=crop&w=400&q=80", // Street lights
  "https://images.unsplash.com/photo-1620216524381-8071e626e27b?auto=format&fit=crop&w=400&q=80", // Tools
];

const BRANDS = ["Luminous", "Microtek", "Loom Solar", "Waaree", "Vikram Solar", "Exide", "Amara Raja", "Schneider", "Havells"];

export async function GET() {
  try {
    console.log("Seeding Solar Inventory...");

    // 1. Create categories
    const catMap: Record<string, string> = {};
    for (let i = 0; i < CATEGORIES.length; i++) {
      const name = CATEGORIES[i];
      const id = `CAT_${name.toUpperCase().replace(/\s+/g, '_').replace(/\//g, '_')}`;
      await prisma.category.upsert({
        where: { id },
        update: { name },
        create: { id, name },
      });
      catMap[name] = id;
    }

    // 2. Create brands
    const brandMap: Record<string, string> = {};
    for (const b of BRANDS) {
      const brand = await prisma.brand.upsert({
        where: { name: b },
        update: { name: b },
        create: { name: b },
      });
      brandMap[b] = brand.id;
    }

    // 3. Generate 150 products
    const prefixMap: Record<string, string> = {
      "Solar Panels": "SOL",
      "Solar Inverters": "INV",
      "Lithium Batteries": "BAT",
      "Tubular Batteries": "TUB",
      "Charge Controllers": "CHR",
      "MC4 Connectors": "MC4",
      "DC Solar Cables": "CAB",
      "ACDB / DCDB Boxes": "BOX",
      "Mounting Structures": "MNT",
      "Solar Water Heaters": "WTR",
      "Solar Street Lights": "LIT",
      "Electrical Tools": "TOL"
    };

    const unitsMap: Record<string, string> = {
      "DC Solar Cables": "ROLL",
      "MC4 Connectors": "PAIR",
      "Mounting Structures": "SET",
      "Electrical Tools": "KIT"
    };

    for (let i = 1; i <= 150; i++) {
      const catIndex = i % CATEGORIES.length;
      const catName = CATEGORIES[catIndex];
      const catId = catMap[catName];
      const brandName = BRANDS[i % BRANDS.length];
      const brandId = brandMap[brandName];
      const prefix = prefixMap[catName] || "PRD";
      const unit = unitsMap[catName] || "PCS";
      const skuId = `${prefix}${String(i).padStart(4, '0')}`;
      
      const skuData = {
        name: `${brandName} ${catName} Model ${100 + i}X`,
        categoryId: catId,
        brandId: brandId,
        price: Math.floor(Math.random() * 50000) + 1200,
        moq: i % 10 === 0 ? 10 : (i % 5 === 0 ? 5 : 1),
        stepQty: 1,
        unit: unit,
        isActive: true,
        imageUrl: IMAGES[catIndex],
      };

      await prisma.sku.upsert({
        where: { id: skuId },
        update: skuData,
        create: { id: skuId, ...skuData },
      });

      // 4. Update Main Warehouse Inventory
      const mainWarehouse = await prisma.warehouse.findFirst();
      if (mainWarehouse) {
        await prisma.warehouseInventory.upsert({
          where: {
            warehouseId_skuId: { skuId: skuId, warehouseId: mainWarehouse.id }
          },
          update: { qty: 500, isOos: false },
          create: { skuId: skuId, warehouseId: mainWarehouse.id, qty: 500, isOos: false },
        });
      }
    }

    return NextResponse.json({ success: true, message: "150 Solar B2B SKUs seeded successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

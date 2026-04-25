import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

const CATEGORIES = ["Rice", "Atta", "Besan", "Cooking Oil", "Dry Fruits", "Flour", "Grains", "Pulses", "Sugar", "Tea"];

const IMAGES = [
  "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80", // Rice
  "https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=400&q=80", // Atta
  "https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=400&q=80", // Besan
  "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80", // Cooking Oil
  "https://images.unsplash.com/photo-1599576595568-d06990d0b00c?auto=format&fit=crop&w=400&q=80", // Dry fruits
  "https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=400&q=80", // Flour
  "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80", // Grains
  "https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=400&q=80", // Pulses
  "https://images.unsplash.com/photo-1581428982868-e410dd427a90?auto=format&fit=crop&w=400&q=80", // Sugar
  "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80", // Tea
];

export async function GET() {
  try {
    console.log("Seeding started...");

    // Create categories
    const catMap: Record<string, string> = {};
    for (let i = 0; i < CATEGORIES.length; i++) {
      const name = CATEGORIES[i];
      const id = `CAT_${name.toUpperCase().replace(/\s+/g, '_')}`;
      await prisma.category.upsert({
        where: { id },
        update: { name },
        create: { id, name },
      });
      catMap[name] = id;
    }

    // Generate 200 products
    const skusToCreate = [];
    for (let i = 1; i <= 200; i++) {
      const catIndex = i % CATEGORIES.length;
      const catName = CATEGORIES[catIndex];
      const catId = catMap[catName];
      
      skusToCreate.push({
        id: `TEST_SKU_${String(i).padStart(3, '0')}`,
        name: `Premium ${catName} Variant ${i}`,
        categoryId: catId,
        price: Math.floor(Math.random() * 500) + 50,
        moq: Math.floor(Math.random() * 5) * 5 + 5, // 5, 10, 15, 20, 25
        stepQty: 5,
        unit: 'kg',
        isActive: true,
        imageUrl: IMAGES[catIndex],
      });
    }

    for (const sku of skusToCreate) {
      await prisma.sku.upsert({
        where: { id: sku.id },
        update: sku,
        create: sku,
      });
    }

    // Give them some inventory in main warehouse
    const mainWarehouse = await prisma.warehouse.findFirst();
    if (mainWarehouse) {
      for (const sku of skusToCreate) {
        await prisma.warehouseInventory.upsert({
          where: {
            warehouseId_skuId: { skuId: sku.id, warehouseId: mainWarehouse.id }
          },
          update: { qty: 1000 },
          create: { skuId: sku.id, warehouseId: mainWarehouse.id, qty: 1000 },
        });
      }
    }

    return NextResponse.json({ success: true, message: "150 items seeded" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

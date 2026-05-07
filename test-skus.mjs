import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log("Creating new SKU...");
  const newSku = await prisma.sku.create({
    data: {
      id: "TEST-SKU-1",
      name: "Test SKU",
      unit: "PCS",
      moq: 1,
      stepQty: 1,
      price: 12000,
      caseSize: 12,
      zohoBookItemId: 123456789012345n,
      isActive: true,
      lastSyncedAt: new Date()
    }
  });
  console.log("Created:", { ...newSku, zohoBookItemId: newSku.zohoBookItemId?.toString() });

  console.log("\nEditing SKU ID and case_size...");
  const updatedSku = await prisma.sku.update({
    where: { id: "TEST-SKU-1" },
    data: { id: "TEST-SKU-UPDATED", caseSize: 6 }
  });
  console.log("Updated:", { ...updatedSku, zohoBookItemId: updatedSku.zohoBookItemId?.toString() });

  console.log("\nSimulating POS Display Price Logic...");
  const displayPrice = updatedSku.price / updatedSku.caseSize;
  console.log(`Actual Price: ${updatedSku.price}, Case Size: ${updatedSku.caseSize}, Display Price: ${displayPrice}`);

  console.log("\nCleaning up...");
  await prisma.sku.delete({ where: { id: "TEST-SKU-UPDATED" } });
  console.log("Done.");
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

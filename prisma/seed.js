const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Create an Admin user
  const admin = await prisma.user.upsert({
    where: { mobile: '1234567890' },
    update: {},
    create: {
      name: 'Super Admin',
      mobile: '1234567890',
      role: 'ADMIN',
    },
  })

  // Create a Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'W1' },
    update: {},
    create: {
      id: 'W1',
      name: 'Main Warehouse',
      address: '123 Kamna St',
    },
  })

  // Create a Category
  const category = await prisma.category.upsert({
    where: { id: 'C1' },
    update: {},
    create: {
      id: 'C1',
      name: 'Grains',
    },
  })

  // Create SKUs
  const sku1 = await prisma.sku.upsert({
    where: { id: 'SKU101' },
    update: {},
    create: {
      id: 'SKU101',
      name: 'Premium Basmati Rice',
      brand: 'Kamna',
      unit: 'kg',
      moq: 10,
      price: 150,
      categoryId: 'C1',
    },
  })

  const sku2 = await prisma.sku.upsert({
    where: { id: 'SKU102' },
    update: {},
    create: {
      id: 'SKU102',
      name: 'Wheat Flour',
      brand: 'Kamna',
      unit: 'kg',
      moq: 50,
      price: 45,
      categoryId: 'C1',
    },
  })

  // Map inventory
  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_skuId: {
        warehouseId: 'W1',
        skuId: 'SKU101',
      },
    },
    update: {},
    create: {
      warehouseId: 'W1',
      skuId: 'SKU101',
      qty: 500,
      zone: 'A1',
    },
  })

  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_skuId: {
        warehouseId: 'W1',
        skuId: 'SKU102',
      },
    },
    update: {},
    create: {
      warehouseId: 'W1',
      skuId: 'SKU102',
      qty: 1000,
      zone: 'B2',
    },
  })

  console.log('Seeded database successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

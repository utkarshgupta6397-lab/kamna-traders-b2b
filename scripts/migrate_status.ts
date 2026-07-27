import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: Approved -> Active');

  // Find a system ADMIN user to attribute the migration
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    throw new Error('No ADMIN user found. Cannot proceed with migration.');
  }
  console.log(`Using system actor: ${adminUser.name} (${adminUser.id})`);

  const entities = [
    { name: 'Brand', model: prisma.brand, idField: 'brandId' },
    { name: 'Manufacturer', model: prisma.manufacturer, idField: 'manufacturerId' },
    { name: 'Category', model: prisma.category, idField: 'categoryId' },
    { name: 'TaxRate', model: prisma.taxRate, idField: 'taxRateId' },
    { name: 'UnitOfMeasurement', model: prisma.unitOfMeasurement, idField: 'unitOfMeasurementId' },
    { name: 'HsnCode', model: prisma.hsnCode, idField: 'hsnCodeId' },
  ];

  for (const { name, model, idField } of entities) {
    try {
      const records = await (model as any).findMany({
        where: { status: 'Approved' },
        select: { id: true },
      });

      if (records.length === 0) {
        console.log(`[${name}] No records to migrate.`);
        continue;
      }

      for (const record of records) {
        await (model as any).update({
          where: { id: record.id },
          data: { status: 'Active' },
        });

        await prisma.masterDataHistory.create({
          data: {
            entityType: name,
            entityId: record.id,
            action: 'UPDATED',
            previousValue: 'Approved',
            newValue: 'Active',
            remarks: 'System migration: Status renamed from Approved to Active',
            performedById: adminUser.id,
            [idField]: record.id,
          },
        });
      }

      console.log(`[${name}] Migrated ${records.length} records.`);
    } catch (e: any) {
      console.error(`[${name}] Failed to migrate:`, e.message);
    }
  }

  console.log('Migration completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

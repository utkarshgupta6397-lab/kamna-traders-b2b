import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 30 days
const INACTIVE_THRESHOLD_DAYS = 30;

const MASTER_ENTITIES = [
  'Brand',
  'Manufacturer',
  'Category',
  'TaxRate',
  'UnitOfMeasurement',
  'HsnCode',
] as const;

type EntityType = typeof MASTER_ENTITIES[number];

function getDelegate(entityType: EntityType) {
  switch (entityType) {
    case 'Brand': return prisma.brand;
    case 'Manufacturer': return prisma.manufacturer;
    case 'Category': return prisma.category;
    case 'TaxRate': return prisma.taxRate;
    case 'UnitOfMeasurement': return prisma.unitOfMeasurement;
    case 'HsnCode': return prisma.hsnCode;
  }
}

function getEntityIdField(entityType: EntityType): string {
  switch (entityType) {
    case 'Brand': return 'brandId';
    case 'Manufacturer': return 'manufacturerId';
    case 'Category': return 'categoryId';
    case 'TaxRate': return 'taxRateId';
    case 'UnitOfMeasurement': return 'unitOfMeasurementId';
    case 'HsnCode': return 'hsnCodeId';
  }
}

export async function GET(request: Request) {
  // Validate cron secret to prevent unauthorized invocations
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_THRESHOLD_DAYS);

  // Use the first ADMIN user as the system actor for audit logs
  const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!systemUser) {
    return NextResponse.json({ error: 'No ADMIN user found to act as system actor' }, { status: 500 });
  }

  let totalArchived = 0;
  const results: { entity: string; archived: number; error?: string }[] = [];

  for (const entityType of MASTER_ENTITIES) {
    try {
      const model = getDelegate(entityType) as any;
      const staleRecords = await model.findMany({
        where: {
          status: 'Inactive',
          updatedAt: { lte: cutoffDate },
        },
        select: { id: true },
      });

      if (staleRecords.length === 0) {
        results.push({ entity: entityType, archived: 0 });
        continue;
      }

      const ids = staleRecords.map((r: { id: string }) => r.id);

      // Archive all qualifying records
      await model.updateMany({
        where: { id: { in: ids } },
        data: { status: 'Archived', active: false },
      });

      // Create audit log entries
      const entityIdField = getEntityIdField(entityType);
      for (const record of staleRecords) {
        await prisma.masterDataHistory.create({
          data: {
            entityType,
            entityId: record.id,
            action: 'ARCHIVED',
            previousValue: 'Inactive',
            newValue: 'Archived',
            remarks: `Automatically archived after ${INACTIVE_THRESHOLD_DAYS} days of inactivity.`,
            performedById: systemUser.id,
            [entityIdField]: record.id,
          },
        });
      }

      results.push({ entity: entityType, archived: staleRecords.length });
      totalArchived += staleRecords.length;
    } catch (err: any) {
      console.error(`[Cron] Failed to archive ${entityType}:`, err.message);
      results.push({ entity: entityType, archived: 0, error: err.message });
    }
  }

  console.log(`[Cron] Auto-archive complete. Total archived: ${totalArchived}`);
  return NextResponse.json({ success: true, totalArchived, results });
}

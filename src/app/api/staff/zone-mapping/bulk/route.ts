import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';


export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.canManageZoneMappings && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { warehouseId, updates } = await request.json();

    if (!warehouseId || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let updated = 0;
    let created = 0;
    let removed = 0;

    // We use a transaction or loop through updates
    // For simplicity in this local dev task, we loop.
    for (const update of updates) {
      const { skuId, zoneName } = update;
      if (!skuId) continue;

      const existing = await prisma.warehouseInventory.findUnique({
        where: { warehouseId_skuId: { warehouseId, skuId } }
      });

      if (existing) {
        if (zoneName === null && existing.zone !== null) {
          removed++;
        } else if (zoneName !== existing.zone) {
          updated++;
        }
        await prisma.warehouseInventory.update({
          where: { warehouseId_skuId: { warehouseId, skuId } },
          data: { 
            zone: zoneName,
            updatedById: session.userId
          }
        });
      } else {
        created++;
        await prisma.warehouseInventory.create({
          data: {
            warehouseId,
            skuId,
            zone: zoneName,
            qty: 0,
            updatedById: session.userId
          }
        });
      }
    }

    return NextResponse.json({ success: true, updated, created, removed });
  } catch (err) {
    console.error('Failed to bulk update zone mappings:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

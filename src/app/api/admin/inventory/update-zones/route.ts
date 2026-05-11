import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { inventoryIds, zone } = await req.json();

    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
      return NextResponse.json({ error: 'No items selected' }, { status: 400 });
    }

    const trimmedZone = zone?.trim().toUpperCase() || null;

    // Bulk update zones
    await prisma.warehouseInventory.updateMany({
      where: {
        id: { in: inventoryIds }
      },
      data: {
        zone: trimmedZone
      }
    });

    // Log to history if needed? The user didn't ask for history logging for bulk zone changes, 
    // but usually inventory changes are logged. 
    // However, the request specifically said "SIMPLE" and "minimal".
    // I'll skip history logging for now to keep it lean unless I see a clear pattern.

    return NextResponse.json({ success: true, count: inventoryIds.length });
  } catch (error: any) {
    console.error('[InventoryBulkUpdate] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

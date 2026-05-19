import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';


export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.canManageZoneMappings && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }


  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouseId');
  console.log('[API] GET zone-mapping warehouseId:', warehouseId);


  if (!warehouseId) {
    return NextResponse.json({ error: 'Warehouse ID is required' }, { status: 400 });
  }

  try {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (warehouse?.isSystemWarehouse) {
      return NextResponse.json({ error: 'System warehouses are protected.' }, { status: 403 });
    }
    // Fetch all active SKUs and their inventory record for the selected warehouse
    const skus = await prisma.sku.findMany({
      where: { isActive: true },

      select: {
        id: true,
        name: true,
        categoryId: true,
        inventory: {
          where: { warehouseId: warehouseId },
          select: { 
            zone: true, 
            updatedAt: true,
            updatedBy: { select: { name: true } }
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    const mappings = skus.map(sku => {
      const inv = sku.inventory[0];

      return {
        skuId: sku.id,
        name: sku.name,
        categoryId: sku.categoryId,
        zone: inv?.zone || null,
        updatedAt: inv?.updatedAt || null,
        updatedBy: inv?.updatedBy?.name || null
      };
    });

    console.log(`[API] Returning ${mappings.length} mappings`);
    return NextResponse.json(mappings);
  } catch (err) {
    console.error('Failed to fetch zone mappings:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.canManageZoneMappings && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }


  try {
    const { warehouseId, skuId, zoneName } = await request.json();

    if (!warehouseId || !skuId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (warehouse?.isSystemWarehouse) {
      return NextResponse.json({ error: 'System warehouses are protected.' }, { status: 403 });
    }

    // Upsert the zone in WarehouseInventory
    const result = await prisma.warehouseInventory.upsert({
      where: {
        warehouseId_skuId: { warehouseId, skuId }
      },
      update: {
        zone: zoneName,
        updatedById: session.userId
      },
      create: {
        warehouseId,
        skuId,
        zone: zoneName,
        qty: 0, // Default qty if creating new record
        updatedById: session.userId
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('Failed to update zone mapping:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

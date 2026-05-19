import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = session.canManageTransfers || session.role === 'ADMIN';
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Missing permission to manage transfers' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const warehouseId = searchParams.get('warehouse');
    const search = searchParams.get('search');
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (warehouseId) {
      where.OR = [
        { sourceWarehouseId: warehouseId },
        { destinationWarehouseId: warehouseId }
      ];
    }

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { transferNumber: { contains: search, mode: 'insensitive' } },
        { responsiblePerson: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (dateStart || dateEnd) {
      where.createdAt = {};
      if (dateStart) {
        where.createdAt.gte = new Date(dateStart);
      }
      if (dateEnd) {
        // Set to end of the day
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

        const transfers = await prisma.transfer.findMany({
      where,
      include: {
        sourceWarehouse: { select: { name: true } },
        destinationWarehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
        dispatchedBy: { select: { name: true } },
        parentTransfer: { select: { transferNumber: true } },
        items: {
          select: {
            requestedQty: true,
            dispatchedQty: true,
            balanceQty: true,
            skuId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Enriched list for table
    const formatted = transfers.map(t => {
      const totalSKUs = t.items.length;
      const totalUnits = t.items.reduce((sum, item) => sum + item.requestedQty, 0);
      return {
        id: t.id,
        transferNumber: t.transferNumber,
        sourceWarehouseId: t.sourceWarehouseId,
        sourceWarehouseName: t.sourceWarehouse.name,
        destinationWarehouseId: t.destinationWarehouseId,
        destinationWarehouseName: t.destinationWarehouse.name,
        status: t.status,
        responsiblePerson: t.responsiblePerson,
        remarks: t.remarks,
        createdByName: t.createdBy.name,
        dispatchedByName: t.dispatchedBy?.name || null,
        createdAt: t.createdAt,
        dispatchedAt: t.dispatchedAt,
        parentTransferId: t.parentTransferId,
        parentTransferNumber: t.parentTransfer?.transferNumber || null,
        totalSKUs,
        totalUnits
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('[TRANSFERS_GET_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log("[TRANSFER] 1. Request received");
  try {
    const session = await getSession();
    console.log("[TRANSFER] 2. Session resolved:", session ? { userId: session.userId, role: session.role } : null);
    if (!session) {
      console.warn("[TRANSFER] Unauthorized access attempt");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = session.canManageTransfers || session.role === 'ADMIN';
    if (!hasPermission) {
      console.warn("[TRANSFER] Forbidden: user lacks canManageTransfers/ADMIN privilege");
      return NextResponse.json({ error: 'Forbidden: Missing permission to manage transfers' }, { status: 403 });
    }

    const body = await request.json();
    console.log("[TRANSFER] 3. Payload parsed:", body);
    const { sourceWarehouseId, destinationWarehouseId, responsiblePerson, remarks, items } = body as {
      sourceWarehouseId: string;
      destinationWarehouseId: string;
      responsiblePerson: string;
      remarks?: string;
      items: { skuId: string; requestedQty: number }[];
    };

    if (!sourceWarehouseId || !destinationWarehouseId || !responsiblePerson || !items || items.length === 0) {
      console.warn("[TRANSFER] Validation failed: missing required fields", { sourceWarehouseId, destinationWarehouseId, responsiblePerson, itemsCount: items?.length });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      console.warn("[TRANSFER] Validation failed: source and destination warehouse are the same", { sourceWarehouseId, destinationWarehouseId });
      return NextResponse.json({ error: 'Source and destination warehouse cannot be the same.' }, { status: 400 });
    }

    // Verify warehouses exist
    const [sourceWh, destWh] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: destinationWarehouseId } })
    ]);

    if (!sourceWh || !sourceWh.active) {
      console.warn("[TRANSFER] Validation failed: source warehouse inactive or not found", { sourceWarehouseId });
      return NextResponse.json({ error: 'Source warehouse not found or inactive' }, { status: 400 });
    }
    if (!destWh || !destWh.active) {
      console.warn("[TRANSFER] Validation failed: destination warehouse inactive or not found", { destinationWarehouseId });
      return NextResponse.json({ error: 'Destination warehouse not found or inactive' }, { status: 400 });
    }
    if (sourceWh.isSystemWarehouse || destWh.isSystemWarehouse) {
      console.warn("[TRANSFER] Validation failed: system warehouse cannot be used for user transfers", { sourceWh: sourceWh.isSystemWarehouse, destWh: destWh.isSystemWarehouse });
      return NextResponse.json({ error: 'Transfers cannot involve system warehouses.' }, { status: 400 });
    }

    // Verify SKUs exist
    const skuIds = items.map(i => i.skuId);
    const skuRecords = await prisma.sku.findMany({
      where: { id: { in: skuIds } }
    });

    if (skuRecords.length !== skuIds.length) {
      console.warn("[TRANSFER] Validation failed: one or more SKU records not found in database", { requested: skuIds, found: skuRecords.map(r => r.id) });
      return NextResponse.json({ error: 'One or more SKU IDs are invalid' }, { status: 400 });
    }

    // Validate requested quantities against available stock
    for (const item of items) {
      if (item.requestedQty <= 0) {
        console.warn("[TRANSFER] Validation failed: quantity is <= 0", { skuId: item.skuId, qty: item.requestedQty });
        return NextResponse.json({ error: `Requested quantity for SKU ${item.skuId} must be greater than 0` }, { status: 400 });
      }

      const sku = skuRecords.find(s => s.id === item.skuId);
      if (!sku) continue;

      if (!sku.isUnlimited) {
        const sourceInv = await prisma.warehouseInventory.findUnique({
          where: {
            warehouseId_skuId: {
              warehouseId: sourceWarehouseId,
              skuId: item.skuId
            }
          }
        });
        const currentStock = sourceInv?.qty || 0;
        if (item.requestedQty > currentStock) {
          console.warn("[TRANSFER] Validation failed: requested qty exceeds available stock", { skuId: item.skuId, requested: item.requestedQty, currentStock });
          return NextResponse.json({
            error: `Requested quantity (${item.requestedQty}) exceeds available stock (${currentStock}) for SKU [${item.skuId}] ${sku.name}.`
          }, { status: 400 });
        }
      }
    }

    console.log("[TRANSFER] 4. Validation passed");

    let newTransfer;
    try {
      console.log("[TRANSFER] 5. Prisma transaction starting...");
      newTransfer = await prisma.$transaction(async (tx) => {
        // Concurrency-safe year resolution
        let yearPart: string;
        try {
          const kolkataTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
          const currentYear = new Date(kolkataTime).getFullYear();
          yearPart = String(currentYear).slice(-2); // e.g. "26"
        } catch (e: any) {
          console.error("[TRANSFER] Transaction sub-phase error (year resolution):", e);
          throw new Error(`Failed to resolve year part: ${e.message}`);
        }

        let transferNumber: string;
        try {
          const seqResult = await tx.$queryRawUnsafe<Array<{ sequence: number }>>(
            `INSERT INTO "DispatchSequence" ("date", "sequence")
             VALUES ($1, 1)
             ON CONFLICT ("date")
             DO UPDATE SET "sequence" = "DispatchSequence"."sequence" + 1
             RETURNING "sequence"`,
            `TRANSFER_${yearPart}`
          );
          if (!seqResult || seqResult.length === 0 || typeof seqResult[0].sequence !== 'number') {
            throw new Error(`Returned sequence data is invalid.`);
          }
          const seq = seqResult[0].sequence;
          transferNumber = `KT-TR-${yearPart}-${String(seq).padStart(6, '0')}`;
          console.log("[TRANSFER] 6. Generated Number:", transferNumber);
        } catch (e: any) {
          console.error("[TRANSFER] Transaction sub-phase error (sequence/transferNumber):", e);
          throw new Error(`Transfer number generation failed: ${e.message}`);
        }

        let transfer;
        try {
          transfer = await tx.transfer.create({
            data: {
              transferNumber,
              sourceWarehouseId,
              destinationWarehouseId,
              status: 'INITIATED',
              responsiblePerson,
              remarks,
              createdById: session.userId as string,
            }
          });
          console.log("[TRANSFER] 7. Transfer row created:", transfer.id);
        } catch (e: any) {
          console.error("[TRANSFER] Transaction sub-phase error (transfer insert):", e);
          throw new Error(`Failed to insert Transfer record: ${e.message}`);
        }

        try {
          await tx.transferItem.createMany({
            data: items.map(item => ({
              transferId: transfer.id,
              skuId: item.skuId,
              requestedQty: item.requestedQty,
              dispatchedQty: 0,
              balanceQty: item.requestedQty
            }))
          });
          console.log("[TRANSFER] 8. Transfer items created successfully");
        } catch (e: any) {
          console.error("[TRANSFER] Transaction sub-phase error (transfer items insert):", e);
          throw new Error(`Failed to insert TransferItem records: ${e.message}`);
        }

        return transfer;
      });
      console.log("[TRANSFER] 9. Transaction committed successfully");
    } catch (error: any) {
      console.error('[TRANSFER] Transaction aborted/rolled back:', error);
      console.error('[TRANSFERS_POST_ERROR]', error);
      return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }

    console.log("[TRANSFER] 10. API response returned success");
    return NextResponse.json({ success: true, transfer: newTransfer });
  } catch (error: any) {
    console.error('[TRANSFER] Global POST catch-block error:', error);
    console.error('[TRANSFERS_POST_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

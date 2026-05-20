import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = session.canManageTransfers || session.role === 'ADMIN';
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Missing permission to manage transfers' }, { status: 403 });
    }

    const body = await request.json();
    const { transferIds } = body as { transferIds: string[] };

    if (!transferIds || !Array.isArray(transferIds) || transferIds.length < 2) {
      return NextResponse.json({ error: 'Please select at least two transfers to merge' }, { status: 400 });
    }

    // Load transfers to be merged
    const transfers = await prisma.transfer.findMany({
      where: { id: { in: transferIds } },
      include: { items: true }
    });

    if (transfers.length !== transferIds.length) {
      return NextResponse.json({ error: 'One or more transfer IDs are invalid' }, { status: 400 });
    }

    // Validations:
    // 1. All must be in INITIATED status
    const allInitiated = transfers.every(t => t.status === 'INITIATED');
    if (!allInitiated) {
      return NextResponse.json({ error: 'Only transfers in INITIATED status can be merged' }, { status: 400 });
    }

    // 2. All must share the same source warehouse
    const firstSource = transfers[0].sourceWarehouseId;
    const sameSource = transfers.every(t => t.sourceWarehouseId === firstSource);
    if (!sameSource) {
      return NextResponse.json({ error: 'All merged transfers must share the same source warehouse' }, { status: 400 });
    }

    // 3. All must share the same destination warehouse
    const firstDest = transfers[0].destinationWarehouseId;
    const sameDest = transfers.every(t => t.destinationWarehouseId === firstDest);
    if (!sameDest) {
      return NextResponse.json({ error: 'All merged transfers must share the same destination warehouse' }, { status: 400 });
    }

    // Aggregate SKU quantities
    const skuQtyMap = new Map<string, number>();
    for (const t of transfers) {
      for (const item of t.items) {
        const existing = skuQtyMap.get(item.skuId) || 0;
        skuQtyMap.set(item.skuId, existing + item.requestedQty);
      }
    }

    const mergedTransfer = await prisma.$transaction(async (tx) => {
      const kolkataTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const currentYear = new Date(kolkataTime).getFullYear();
      const yearPart = String(currentYear).slice(-2); // e.g. "26"
      
      const seqResult = await tx.$queryRawUnsafe<Array<{ sequence: number }>>(
        `INSERT INTO "DispatchSequence" ("date", "sequence")
         VALUES ($1, 1)
         ON CONFLICT ("date")
         DO UPDATE SET "sequence" = "DispatchSequence"."sequence" + 1
         RETURNING "sequence"`,
        `TRANSFER_${yearPart}`
      );
      if (!seqResult || seqResult.length === 0 || typeof seqResult[0].sequence !== 'number') {
        throw new Error('Sequence generation failed: invalid sequence result returned.');
      }
      const seq = seqResult[0].sequence;
      const transferNumber = `KT-TR-${yearPart}-${String(seq).padStart(6, '0')}`;

      // Create new combined transfer
      const newTransfer = await tx.transfer.create({
        data: {
          transferNumber,
          sourceWarehouseId: firstSource,
          destinationWarehouseId: firstDest,
          status: 'INITIATED',
          responsiblePerson: transfers.map(t => t.responsiblePerson).filter((v, i, a) => a.indexOf(v) === i).join(', ').substring(0, 100),
          remarks: `Merged from: ${transfers.map(t => t.transferNumber).join(', ')}`,
          createdById: session.userId as string
        }
      });

      // Create aggregated items
      const itemsData = Array.from(skuQtyMap.entries()).map(([skuId, requestedQty]) => ({
        transferId: newTransfer.id,
        skuId,
        requestedQty,
        dispatchedQty: 0,
        balanceQty: requestedQty
      }));

      await tx.transferItem.createMany({
        data: itemsData
      });

      // Log CREATED history for the new merged transfer
      await tx.transferHistory.create({
        data: {
          transferId: newTransfer.id,
          action: 'CREATED',
          performedBy: session.name || 'Staff',
          metadata: JSON.stringify({ remarks: `Merged from: ${transfers.map(t => t.transferNumber).join(', ')}` })
        }
      });

      // Mark old transfers as MERGED and link to new transfer
      await tx.transfer.updateMany({
        where: { id: { in: transferIds } },
        data: {
          status: 'MERGED',
          mergedIntoTransferId: newTransfer.id
        }
      });

      // Log MERGED history for the source transfers
      for (const tId of transferIds) {
        await tx.transferHistory.create({
          data: {
            transferId: tId,
            action: 'MERGED',
            performedBy: session.name || 'Staff',
            metadata: JSON.stringify({ remarks: `Merged into ${transferNumber}` })
          }
        });
      }

      return newTransfer;
    }, {
      maxWait: 15000,
      timeout: 30000
    });

    return NextResponse.json({ success: true, transfer: mergedTransfer });
  } catch (error: any) {
    console.error('[TRANSFERS_MERGE_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

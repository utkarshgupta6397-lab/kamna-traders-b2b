import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = session.canManageTransfers || session.role === 'ADMIN';
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Missing permission to manage transfers' }, { status: 403 });
    }

    const { id } = await params;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: { select: { name: true } },
        destinationWarehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
        dispatchedBy: { select: { name: true } },
        parentTransfer: { select: { transferNumber: true } },
        items: {
          include: {
            sku: {
              select: {
                name: true,
                unit: true,
                isUnlimited: true
              }
            }
          }
        }
      }
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    return NextResponse.json(transfer);
  } catch (error: any) {
    console.error('[TRANSFER_GET_DETAIL_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = session.canDeleteTransfers || session.role === 'ADMIN';
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Missing permission to cancel/delete transfers' }, { status: 403 });
    }

    const { id } = await params;

    const transfer = await prisma.transfer.findUnique({
      where: { id }
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    if (transfer.status !== 'INITIATED') {
      return NextResponse.json({ error: 'Only INITIATED transfers can be cancelled' }, { status: 400 });
    }

    const updated = await prisma.transfer.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    return NextResponse.json({ success: true, transfer: updated });
  } catch (error: any) {
    console.error('[TRANSFER_CANCEL_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = session.canManageTransfers || session.role === 'ADMIN';
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Missing permission to manage transfers' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, items } = body as {
      action: 'dispatch' | 'cancel';
      items?: { skuId: string; dispatchQty: number }[];
    };

    if (action === 'cancel') {
      const deletePerm = session.canDeleteTransfers || session.role === 'ADMIN';
      if (!deletePerm) {
        return NextResponse.json({ error: 'Forbidden: Missing permission to cancel transfers' }, { status: 403 });
      }

      const transfer = await prisma.transfer.findUnique({ where: { id } });
      if (!transfer) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }
      if (transfer.status !== 'INITIATED') {
        return NextResponse.json({ error: 'Only INITIATED transfers can be cancelled' }, { status: 400 });
      }

      const updated = await prisma.transfer.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action !== 'dispatch') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Missing items to dispatch' }, { status: 400 });
    }

    // Load transfer details
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        items: true,
        sourceWarehouse: true,
        destinationWarehouse: true
      }
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    if (transfer.status !== 'INITIATED' && transfer.status !== 'PARTIALLY_DISPATCHED') {
      return NextResponse.json({ error: `Cannot dispatch a transfer in ${transfer.status} status` }, { status: 400 });
    }

    // Validate quantities and stock levels BEFORE performing any writes
    const itemMap = new Map(transfer.items.map(item => [item.skuId, item]));
    const dispatchValidations: {
      skuId: string;
      dispatchQty: number;
      productName: string;
      isUnlimited: boolean;
      currentSourceQty: number;
      currentDestQty: number;
      transferItemId: string;
    }[] = [];

    for (const dItem of items) {
      if (dItem.dispatchQty <= 0) {
        return NextResponse.json({ error: `Dispatch quantity for SKU ${dItem.skuId} must be greater than 0` }, { status: 400 });
      }

      const transferItem = itemMap.get(dItem.skuId);
      if (!transferItem) {
        return NextResponse.json({ error: `SKU ${dItem.skuId} is not requested in this transfer` }, { status: 400 });
      }

      if (dItem.dispatchQty > transferItem.balanceQty) {
        return NextResponse.json({
          error: `Dispatch quantity (${dItem.dispatchQty}) for SKU ${dItem.skuId} exceeds remaining requested balance (${transferItem.balanceQty})`
        }, { status: 400 });
      }

      // Fetch SKU info
      const sku = await prisma.sku.findUnique({
        where: { id: dItem.skuId }
      });
      if (!sku) {
        return NextResponse.json({ error: `SKU ${dItem.skuId} not found` }, { status: 400 });
      }

      // Fetch current source warehouse inventory
      const sourceInv = await prisma.warehouseInventory.findUnique({
        where: {
          warehouseId_skuId: {
            warehouseId: transfer.sourceWarehouseId,
            skuId: dItem.skuId
          }
        }
      });
      const currentSourceQty = sourceInv?.qty || 0;

      // Fetch destination warehouse inventory (IN_TRANSIT)
      const destInv = await prisma.warehouseInventory.findUnique({
        where: {
          warehouseId_skuId: {
            warehouseId: transfer.destinationWarehouseId,
            skuId: dItem.skuId
          }
        }
      });
      const currentDestQty = destInv?.qty || 0;

      // Validate stock for non-unlimited SKUs
      if (!sku.isUnlimited) {
        if (currentSourceQty < dItem.dispatchQty) {
          return NextResponse.json({
            error: `Insufficient stock for SKU [${dItem.skuId}] ${sku.name} in source warehouse ${transfer.sourceWarehouse.name}. Current stock: ${currentSourceQty}, dispatch requested: ${dItem.dispatchQty}`
          }, { status: 400 });
        }
      }

      dispatchValidations.push({
        skuId: dItem.skuId,
        dispatchQty: dItem.dispatchQty,
        productName: sku.name,
        isUnlimited: sku.isUnlimited,
        currentSourceQty,
        currentDestQty,
        transferItemId: transferItem.id
      });
    }

    // Execute transactional database update
    const updatedTransfer = await prisma.$transaction(async (tx) => {
      for (const val of dispatchValidations) {
        // Fetch current source warehouse inventory inside the transaction block
        const sourceInv = await tx.warehouseInventory.findUnique({
          where: {
            warehouseId_skuId: {
              warehouseId: transfer.sourceWarehouseId,
              skuId: val.skuId
            }
          }
        });
        const currentSourceQty = sourceInv?.qty || 0;

        // Fetch destination warehouse inventory inside the transaction block
        const destInvRecord = await tx.warehouseInventory.findUnique({
          where: {
            warehouseId_skuId: {
              warehouseId: transfer.destinationWarehouseId,
              skuId: val.skuId
            }
          }
        });
        const currentDestQty = destInvRecord?.qty || 0;

        // Double check stock levels for non-unlimited SKUs inside transaction block
        if (!val.isUnlimited) {
          if (currentSourceQty < val.dispatchQty) {
            throw new Error(`Insufficient stock for SKU [${val.skuId}] ${val.productName} in source warehouse ${transfer.sourceWarehouse.name}. Current stock: ${currentSourceQty}, dispatch requested: ${val.dispatchQty}`);
          }
        }

        // 1. Deduct stock from source warehouse if not unlimited
        if (!val.isUnlimited) {
          await tx.warehouseInventory.update({
            where: {
              warehouseId_skuId: {
                warehouseId: transfer.sourceWarehouseId,
                skuId: val.skuId
              }
            },
            data: {
              qty: { decrement: val.dispatchQty }
            }
          });

          // Create inventory history entry for source warehouse
          await tx.inventoryHistory.create({
            data: {
              warehouseId: transfer.sourceWarehouseId,
              skuId: val.skuId,
              productName: val.productName,
              beforeQty: currentSourceQty,
              afterQty: currentSourceQty - val.dispatchQty,
              qtyChange: -val.dispatchQty,
              remarks: `TRANSFER_OUT: Dispatched transfer ${transfer.transferNumber} to ${transfer.destinationWarehouse.name}`,
              createdBy: session.userId as string,
              referenceType: 'TRANSFER',
              referenceId: transfer.id
            }
          });
        } else {
          // Create inventory history entry for source warehouse (unlimited)
          await tx.inventoryHistory.create({
            data: {
              warehouseId: transfer.sourceWarehouseId,
              skuId: val.skuId,
              productName: val.productName,
              beforeQty: 0,
              afterQty: 0,
              qtyChange: -val.dispatchQty,
              remarks: `TRANSFER_OUT: Dispatched transfer ${transfer.transferNumber} (UNLIMITED SKU) to ${transfer.destinationWarehouse.name}`,
              createdBy: session.userId as string,
              referenceType: 'TRANSFER',
              referenceId: transfer.id
            }
          });
        }

        // 2. Add stock to destination warehouse (normally IN_TRANSIT)
        await tx.warehouseInventory.upsert({
          where: {
            warehouseId_skuId: {
              warehouseId: transfer.destinationWarehouseId,
              skuId: val.skuId
            }
          },
          update: {
            qty: { increment: val.dispatchQty }
          },
          create: {
            warehouseId: transfer.destinationWarehouseId,
            skuId: val.skuId,
            qty: val.dispatchQty,
            isOos: false
          }
        });

        // Create inventory history entry for destination warehouse
        await tx.inventoryHistory.create({
          data: {
            warehouseId: transfer.destinationWarehouseId,
            skuId: val.skuId,
            productName: val.productName,
            beforeQty: currentDestQty,
            afterQty: currentDestQty + val.dispatchQty,
            qtyChange: val.dispatchQty,
            remarks: `TRANSFER_IN_TRANSIT: Received transfer ${transfer.transferNumber} from ${transfer.sourceWarehouse.name}`,
            createdBy: session.userId as string,
            referenceType: 'TRANSFER',
            referenceId: transfer.id
          }
        });

        // 3. Update the transfer item details
        await tx.transferItem.update({
          where: { id: val.transferItemId },
          data: {
            dispatchedQty: { increment: val.dispatchQty },
            balanceQty: { decrement: val.dispatchQty }
          }
        });
      }

      // Re-load transfer items to determine overall status
      const updatedItems = await tx.transferItem.findMany({
        where: { transferId: transfer.id }
      });

      const totalBalance = updatedItems.reduce((sum, item) => sum + item.balanceQty, 0);
      let newStatus: 'IN_TRANSIT' | 'DISPATCHED_PARTIAL_CLOSED';
      let updatedRemarks = transfer.remarks;

      if (totalBalance === 0) {
        newStatus = 'IN_TRANSIT';
      } else {
        newStatus = 'DISPATCHED_PARTIAL_CLOSED';

        // Atomically generate new sequential transferNumber for child
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
          throw new Error('Child sequence generation failed: invalid sequence result returned.');
        }
        const childSeq = seqResult[0].sequence;
        const childTransferNumber = `KT-TR-${yearPart}-${String(childSeq).padStart(6, '0')}`;

        // Create the child transfer with status INITIATED
        const childTransfer = await tx.transfer.create({
          data: {
            transferNumber: childTransferNumber,
            sourceWarehouseId: transfer.sourceWarehouseId,
            destinationWarehouseId: transfer.destinationWarehouseId,
            status: 'INITIATED',
            responsiblePerson: transfer.responsiblePerson,
            remarks: `Auto-generated remainder from parent transfer ${transfer.transferNumber}`,
            createdById: transfer.createdById,
            parentTransferId: transfer.id,
            isAutoGenerated: true,
          }
        });

        // Copy remaining items into child transfer (balanceQty > 0)
        const childItems = updatedItems
          .filter(item => item.balanceQty > 0)
          .map(item => ({
            transferId: childTransfer.id,
            skuId: item.skuId,
            requestedQty: item.balanceQty,
            dispatchedQty: 0,
            balanceQty: item.balanceQty
          }));

        await tx.transferItem.createMany({
          data: childItems
        });

        // Update parent's remarks to log the auto-generation details
        const prefix = transfer.remarks ? `${transfer.remarks}\n` : '';
        updatedRemarks = `${prefix}Partial dispatch completed. Remaining qty auto-created in: ${childTransferNumber}`;
      }

      const updated = await tx.transfer.update({
        where: { id: transfer.id },
        data: {
          status: newStatus,
          remarks: updatedRemarks,
          dispatchedAt: new Date(),
          dispatchedById: session.userId as string
        }
      });

      return updated;
    });

    return NextResponse.json({ success: true, transfer: updatedTransfer });
  } catch (error: any) {
    console.error('[TRANSFER_DISPATCH_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

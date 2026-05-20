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
        receivedBy: { select: { name: true } },
        parentTransfer: { select: { transferNumber: true } },
        history: { orderBy: { timestamp: 'asc' } },
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

    // Fetch source warehouse stock for all items
    const itemsWithStock = await Promise.all(
      transfer.items.map(async (item) => {
        const inv = await prisma.warehouseInventory.findUnique({
          where: {
            warehouseId_skuId: {
              warehouseId: transfer.sourceWarehouseId,
              skuId: item.skuId
            }
          },
          select: { qty: true }
        });
        return {
          ...item,
          sourceStock: inv?.qty ?? 0
        };
      })
    );

    const totalRequested = transfer.items.reduce((sum, item) => sum + item.requestedQty, 0);
    const totalDispatched = transfer.items.reduce((sum, item) => sum + (item.dispatchedQty || 0), 0);
    const totalReceived = transfer.items.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
    const totalShort = transfer.items.reduce((sum, item) => sum + (item.shortQty || 0), 0);
    const totalPendingDispatch = totalRequested - totalDispatched - totalShort;

    const canReceive = totalDispatched > totalReceived && 
      ['IN_TRANSIT', 'PARTIALLY_DISPATCHED', 'PARTIALLY_RECEIVED'].includes(transfer.status) &&
      totalPendingDispatch === 0;

    const canDispatch = totalPendingDispatch > 0 && 
      !['COMPLETED', 'CANCELLED', 'SHORT_CLOSED', 'MERGED'].includes(transfer.status);

    return NextResponse.json({
      ...transfer,
      items: itemsWithStock,
      canReceive,
      canDispatch
    });
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
    const { action, items, mode } = body as {
      action: 'dispatch' | 'cancel' | 'receive';
      items?: any[];
      mode?: 'partial' | 'complete';
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

      // Log CANCELLED history record
      await prisma.transferHistory.create({
        data: {
          transferId: transfer.id,
          action: 'CANCELLED',
          performedBy: session.name || 'Staff',
          metadata: JSON.stringify({ remarks: 'Manual cancellation' })
        }
      });

      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action === 'receive') {
      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'Missing items to receive' }, { status: 400 });
      }

      // Load transfer details
      const transfer = await prisma.transfer.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              sku: true
            }
          },
          sourceWarehouse: true,
          destinationWarehouse: true
        }
      });

      if (!transfer) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }

      const totalRequested = transfer.items.reduce((sum, item) => sum + item.requestedQty, 0);
      const totalDispatched = transfer.items.reduce((sum, item) => sum + (item.dispatchedQty || 0), 0);
      const totalReceived = transfer.items.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
      const totalShort = transfer.items.reduce((sum, item) => sum + (item.shortQty || 0), 0);
      const totalPendingDispatch = totalRequested - totalDispatched - totalShort;

      const canReceive = totalDispatched > totalReceived && 
        ['IN_TRANSIT', 'PARTIALLY_DISPATCHED', 'PARTIALLY_RECEIVED'].includes(transfer.status) &&
        totalPendingDispatch === 0;

      if (!canReceive) {
        return NextResponse.json({ error: 'Transfer is not eligible for receiving (it has remaining pending dispatch quantities or invalid status).' }, { status: 400 });
      }

      // Validate quantities BEFORE performing any writes
      const itemMap = new Map(transfer.items.map(item => [item.skuId, item]));
      const valResults: {
        transferItemId: string;
        skuId: string;
        productName: string;
        receiveQty: number;
        shortQtyForThisTime: number;
        isUnlimited: boolean;
      }[] = [];

      for (const val of items) {
        const trItem = itemMap.get(val.skuId);
        if (!trItem) {
          return NextResponse.json({ error: `SKU ${val.skuId} is not part of this transfer` }, { status: 400 });
        }

        const receiveQty = Number(val.receiveQty);
        if (isNaN(receiveQty) || receiveQty < 0 || !Number.isInteger(receiveQty)) {
          return NextResponse.json({ error: `Invalid receive quantity for SKU ${val.skuId}: ${val.receiveQty}` }, { status: 400 });
        }

        const pendingQty = trItem.dispatchedQty - trItem.receivedQty - trItem.shortQty;
        if (receiveQty > pendingQty) {
          return NextResponse.json({ error: `Receive quantity ${receiveQty} exceeds pending quantity ${pendingQty} for SKU [${val.skuId}]` }, { status: 400 });
        }

        const shortQtyForThisTime = mode === 'complete' ? (pendingQty - receiveQty) : 0;

        valResults.push({
          transferItemId: trItem.id,
          skuId: val.skuId,
          productName: trItem.sku.name,
          receiveQty,
          shortQtyForThisTime,
          isUnlimited: trItem.sku.isUnlimited
        });
      }

      // Execute atomic transaction
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        const skuIds = valResults.map(item => item.skuId);
        
        // Bulk fetch all relevant inventories inside transaction to minimize database roundtrips
        const transitInvs = await tx.warehouseInventory.findMany({
          where: { warehouseId: 'IN_TRANSIT', skuId: { in: skuIds } }
        });
        const destInvs = await tx.warehouseInventory.findMany({
          where: { warehouseId: transfer.destinationWarehouseId, skuId: { in: skuIds } }
        });
        const sourceInvs = await tx.warehouseInventory.findMany({
          where: { warehouseId: transfer.sourceWarehouseId, skuId: { in: skuIds } }
        });

        const transitInvMap = new Map(transitInvs.map(i => [i.skuId, i.qty]));
        const destInvMap = new Map(destInvs.map(i => [i.skuId, i.qty]));
        const sourceInvMap = new Map(sourceInvs.map(i => [i.skuId, i.qty]));

        for (const item of valResults) {
          const currentTransitQty = transitInvMap.get(item.skuId) || 0;
          const currentDestQty = destInvMap.get(item.skuId) || 0;
          const currentSourceQty = sourceInvMap.get(item.skuId) || 0;

          // 1. Deduct stock from In Transit warehouse (IN_TRANSIT) for all SKUs (since it was added there during dispatch)
          if (item.receiveQty > 0 || item.shortQtyForThisTime > 0) {
            const totalDeduction = item.receiveQty + item.shortQtyForThisTime;
            await tx.warehouseInventory.update({
              where: {
                warehouseId_skuId: {
                  warehouseId: 'IN_TRANSIT',
                  skuId: item.skuId
                }
              },
              data: {
                qty: { decrement: totalDeduction }
              }
            });
            transitInvMap.set(item.skuId, currentTransitQty - totalDeduction);
          }

          // 2. Add received qty to Destination warehouse if not unlimited SKU
          if (item.receiveQty > 0) {
            if (!item.isUnlimited) {
              await tx.warehouseInventory.upsert({
                where: {
                  warehouseId_skuId: {
                    warehouseId: transfer.destinationWarehouseId,
                    skuId: item.skuId
                  }
                },
                update: {
                  qty: { increment: item.receiveQty }
                },
                create: {
                  warehouseId: transfer.destinationWarehouseId,
                  skuId: item.skuId,
                  qty: item.receiveQty,
                  isOos: false
                }
              });
              destInvMap.set(item.skuId, currentDestQty + item.receiveQty);

              // Create inventory history entry for destination warehouse (non-unlimited)
              await tx.inventoryHistory.create({
                data: {
                  warehouseId: transfer.destinationWarehouseId,
                  skuId: item.skuId,
                  productName: item.productName,
                  beforeQty: currentDestQty,
                  afterQty: currentDestQty + item.receiveQty,
                  qtyChange: item.receiveQty,
                  remarks: `TRANSFER_RECEIVE: Received stock from transit for transfer ${transfer.transferNumber}`,
                  createdBy: session.userId as string,
                  referenceType: 'TRANSFER',
                  referenceId: transfer.id
                }
              });
            } else {
              // Create inventory history entry for destination warehouse (unlimited)
              await tx.inventoryHistory.create({
                data: {
                  warehouseId: transfer.destinationWarehouseId,
                  skuId: item.skuId,
                  productName: item.productName,
                  beforeQty: 0,
                  afterQty: 0,
                  qtyChange: item.receiveQty,
                  remarks: `TRANSFER_RECEIVE: Received stock from transit for transfer ${transfer.transferNumber} (UNLIMITED SKU)`,
                  createdBy: session.userId as string,
                  referenceType: 'TRANSFER',
                  referenceId: transfer.id
                }
              });
            }

            // Create inventory history entry for IN_TRANSIT warehouse for the receive part
            await tx.inventoryHistory.create({
              data: {
                warehouseId: 'IN_TRANSIT',
                skuId: item.skuId,
                productName: item.productName,
                beforeQty: currentTransitQty,
                afterQty: currentTransitQty - item.receiveQty,
                qtyChange: -item.receiveQty,
                remarks: `TRANSFER_RECEIVE_OUT: Stock receive out to ${transfer.destinationWarehouse.name} for transfer ${transfer.transferNumber}`,
                createdBy: session.userId as string,
                referenceType: 'TRANSFER',
                referenceId: transfer.id
              }
            });
          }

          // 3. Auto-return short qty to Source warehouse if not unlimited SKU
          if (item.shortQtyForThisTime > 0) {
            if (!item.isUnlimited) {
              await tx.warehouseInventory.upsert({
                where: {
                  warehouseId_skuId: {
                    warehouseId: transfer.sourceWarehouseId,
                    skuId: item.skuId
                  }
                },
                update: {
                  qty: { increment: item.shortQtyForThisTime }
                },
                create: {
                  warehouseId: transfer.sourceWarehouseId,
                  skuId: item.skuId,
                  qty: item.shortQtyForThisTime,
                  isOos: false
                }
              });
              sourceInvMap.set(item.skuId, currentSourceQty + item.shortQtyForThisTime);

              // Create inventory history entry for source warehouse (non-unlimited)
              await tx.inventoryHistory.create({
                data: {
                  warehouseId: transfer.sourceWarehouseId,
                  skuId: item.skuId,
                  productName: item.productName,
                  beforeQty: currentSourceQty,
                  afterQty: currentSourceQty + item.shortQtyForThisTime,
                  qtyChange: item.shortQtyForThisTime,
                  remarks: `TRANSFER_SHORT_RETURN: Stock shortage returned from transit for transfer ${transfer.transferNumber}`,
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
                  skuId: item.skuId,
                  productName: item.productName,
                  beforeQty: 0,
                  afterQty: 0,
                  qtyChange: item.shortQtyForThisTime,
                  remarks: `TRANSFER_SHORT_RETURN: Stock shortage returned from transit for transfer ${transfer.transferNumber} (UNLIMITED SKU)`,
                  createdBy: session.userId as string,
                  referenceType: 'TRANSFER',
                  referenceId: transfer.id
                }
              });
            }

            // Create inventory history entry for IN_TRANSIT warehouse for the short return part
            await tx.inventoryHistory.create({
              data: {
                warehouseId: 'IN_TRANSIT',
                skuId: item.skuId,
                productName: item.productName,
                beforeQty: currentTransitQty - item.receiveQty,
                afterQty: currentTransitQty - item.receiveQty - item.shortQtyForThisTime,
                qtyChange: -item.shortQtyForThisTime,
                remarks: `TRANSFER_SHORT_RETURN_OUT: Stock shortage returned to ${transfer.sourceWarehouse.name} for transfer ${transfer.transferNumber}`,
                createdBy: session.userId as string,
                referenceType: 'TRANSFER',
                referenceId: transfer.id
              }
            });
          }

          // 4. Update the transfer item details
          await tx.transferItem.update({
            where: { id: item.transferItemId },
            data: {
              receivedQty: { increment: item.receiveQty },
              shortQty: { increment: item.shortQtyForThisTime }
            }
          });
        }

        // Re-load transfer items to determine overall status
        const updatedItems = await tx.transferItem.findMany({
          where: { transferId: transfer.id }
        });

        const totalPending = updatedItems.reduce((sum, item) => sum + (item.dispatchedQty - item.receivedQty - item.shortQty), 0);
        const totalShort = updatedItems.reduce((sum, item) => sum + item.shortQty, 0);
        const totalReceived = updatedItems.reduce((sum, item) => sum + item.receivedQty, 0);

        let newStatus: 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'SHORT_CLOSED';

        if (totalPending === 0) {
          if (totalShort > 0) {
            newStatus = 'SHORT_CLOSED';
          } else {
            newStatus = 'COMPLETED';
          }
        } else {
          newStatus = 'PARTIALLY_RECEIVED';
        }

        const isFinalStatus = newStatus === 'COMPLETED' || newStatus === 'SHORT_CLOSED';

        const updated = await tx.transfer.update({
          where: { id: transfer.id },
          data: {
            status: newStatus,
            receivedAt: isFinalStatus ? new Date() : null,
            receivedById: isFinalStatus ? (session.userId as string) : null
          }
        });

        // Log history
        await tx.transferHistory.create({
          data: {
            transferId: transfer.id,
            action: newStatus,
            performedBy: session.name || 'Staff',
            metadata: JSON.stringify({
              mode,
              items: items.map(i => ({ skuId: i.skuId, receiveQty: i.receiveQty })),
              totalReceived,
              totalShort
            })
          }
        });

        return updated;
      }, {
        maxWait: 15000,
        timeout: 30000
      });

      return NextResponse.json({ success: true, transfer: updatedTransfer });
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

    const totalRequested = transfer.items.reduce((sum, item) => sum + item.requestedQty, 0);
    const totalDispatched = transfer.items.reduce((sum, item) => sum + (item.dispatchedQty || 0), 0);
    const totalShort = transfer.items.reduce((sum, item) => sum + (item.shortQty || 0), 0);
    const totalPendingDispatch = totalRequested - totalDispatched - totalShort;

    if (totalPendingDispatch <= 0) {
      return NextResponse.json({ error: 'No pending dispatch quantities remain for this transfer.' }, { status: 400 });
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
            warehouseId: 'IN_TRANSIT',
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
      const skuIds = dispatchValidations.map(v => v.skuId);
      
      // Bulk fetch all relevant inventories inside transaction to minimize database roundtrips
      const sourceInvs = await tx.warehouseInventory.findMany({
        where: { warehouseId: transfer.sourceWarehouseId, skuId: { in: skuIds } }
      });
      const destInvs = await tx.warehouseInventory.findMany({
        where: { warehouseId: 'IN_TRANSIT', skuId: { in: skuIds } }
      });

      const sourceInvMap = new Map(sourceInvs.map(i => [i.skuId, i.qty]));
      const destInvMap = new Map(destInvs.map(i => [i.skuId, i.qty]));

      for (const val of dispatchValidations) {
        const currentSourceQty = sourceInvMap.get(val.skuId) || 0;
        const currentDestQty = destInvMap.get(val.skuId) || 0;

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
          sourceInvMap.set(val.skuId, currentSourceQty - val.dispatchQty);

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

        // 2. Add stock to In Transit warehouse (IN_TRANSIT)
        await tx.warehouseInventory.upsert({
          where: {
            warehouseId_skuId: {
              warehouseId: 'IN_TRANSIT',
              skuId: val.skuId
            }
          },
          update: {
            qty: { increment: val.dispatchQty }
          },
          create: {
            warehouseId: 'IN_TRANSIT',
            skuId: val.skuId,
            qty: val.dispatchQty,
            isOos: false
          }
        });
        destInvMap.set(val.skuId, currentDestQty + val.dispatchQty);

        // Create inventory history entry for destination warehouse (IN_TRANSIT)
        await tx.inventoryHistory.create({
          data: {
            warehouseId: 'IN_TRANSIT',
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
      let newStatus: 'IN_TRANSIT' | 'PARTIALLY_DISPATCHED';
      let updatedRemarks = transfer.remarks;

      if (totalBalance === 0) {
        newStatus = 'IN_TRANSIT';
      } else {
        newStatus = 'PARTIALLY_DISPATCHED';

        // Update parent items to match what was actually dispatched
        for (const item of updatedItems) {
          await tx.transferItem.update({
            where: { id: item.id },
            data: {
              requestedQty: item.dispatchedQty,
              balanceQty: 0
            }
          });
        }

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

        // Log CREATED history for the new child transfer
        await tx.transferHistory.create({
          data: {
            transferId: childTransfer.id,
            action: 'CREATED',
            performedBy: session.name || 'Staff',
            metadata: JSON.stringify({ remarks: `Auto-generated remainder from parent transfer ${transfer.transferNumber}` })
          }
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

      // Log DISPATCHED history for the parent transfer
      await tx.transferHistory.create({
        data: {
          transferId: transfer.id,
          action: 'DISPATCHED',
          performedBy: session.name || 'Staff',
          metadata: JSON.stringify({
            status: newStatus,
            items: items.map(i => ({ skuId: i.skuId, qty: i.dispatchQty }))
          })
        }
      });

      return updated;
    }, {
      maxWait: 15000,
      timeout: 30000
    });

    return NextResponse.json({ success: true, transfer: updatedTransfer });
  } catch (error: any) {
    console.error('[TRANSFER_DISPATCH_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

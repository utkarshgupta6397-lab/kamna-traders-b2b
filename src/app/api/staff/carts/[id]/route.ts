import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const cart = await prisma.cart.findUnique({
      where: { id },
      include: {
        warehouse: true,
        staff: true,
        items: {
          select: {
            id: true,
            skuId: true,
            qty: true,
            originalQty: true,
            sku: {
              select: {
                id: true,
                name: true,
                unit: true,
                price: true,
                moq: true,
                stepQty: true,
                caseSize: true,
              }
            }
          }
        }
      }

    });

    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });

    return NextResponse.json(cart);
  } catch (error) {
    console.error('[CART_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { items: newItems, action } = body as { items?: { skuId: string, qty: number }[], action?: 'hold' | 'resume' };

    if (action) {
      const staffId = session.userId as string;

      const cart = await prisma.cart.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              sku: true
            }
          }
        }
      });

      if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
      if (cart.deletedAt) return NextResponse.json({ error: 'Cannot modify a deleted cart' }, { status: 400 });

      if (action === 'hold') {
        if (cart.status === 'DISPATCH_HOLD') {
          return NextResponse.json({ success: true, message: 'Cart already on hold' });
        }
        if (cart.status !== 'COMPLETED') {
          return NextResponse.json({ error: 'Only completed dispatches can be put on hold' }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
          for (const item of cart.items) {
            if (item.sku.isUnlimited) {
              await tx.inventoryHistory.create({
                data: {
                  warehouseId: cart.warehouseId,
                  skuId: item.skuId,
                  productName: item.sku.name || item.skuId,
                  beforeQty: 999999999,
                  afterQty: 999999999,
                  qtyChange: 0,
                  remarks: `Dispatch Hold ${cart.dispatchSlipNumber || cart.id} | Unlimited SKU ignored`,
                  createdBy: staffId,
                }
              });
              continue;
            }

            const inventory = await tx.warehouseInventory.findUnique({
              where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId: item.skuId } }
            });

            const beforeQty = inventory?.qty || 0;
            const afterQty = beforeQty + item.qty;

            await tx.warehouseInventory.upsert({
              where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId: item.skuId } },
              update: { qty: afterQty, isOos: afterQty <= 0 },
              create: { warehouseId: cart.warehouseId, skuId: item.skuId, qty: afterQty, isOos: afterQty <= 0 }
            });

            await tx.inventoryHistory.create({
              data: {
                warehouseId: cart.warehouseId,
                skuId: item.skuId,
                productName: item.sku.name || item.skuId,
                beforeQty,
                afterQty,
                qtyChange: item.qty,
                remarks: `Dispatch Hold ${cart.dispatchSlipNumber || cart.id} | Inventory Restored`,
                createdBy: staffId,
              }
            });
          }

          await tx.cart.update({
            where: { id },
            data: {
              status: 'DISPATCH_HOLD',
              heldAt: new Date(),
              heldById: staffId
            }
          });
        });

        return NextResponse.json({ success: true });
      }

      if (action === 'resume') {
        if (cart.status === 'COMPLETED') {
          return NextResponse.json({ success: true, message: 'Cart already completed' });
        }
        if (cart.status !== 'DISPATCH_HOLD') {
          return NextResponse.json({ error: 'Only dispatch hold carts can be completed' }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
          // 1. Validate stock first
          for (const item of cart.items) {
            if (item.sku.isUnlimited) continue;

            const inventory = await tx.warehouseInventory.findUnique({
              where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId: item.skuId } }
            });

            const currentQty = inventory?.qty || 0;
            if (currentQty < item.qty) {
              throw new Error(`Insufficient inventory to re-complete this dispatch.`);
            }
          }

          // 2. Perform inventory update & logs
          for (const item of cart.items) {
            if (item.sku.isUnlimited) {
              await tx.inventoryHistory.create({
                data: {
                  warehouseId: cart.warehouseId,
                  skuId: item.skuId,
                  productName: item.sku.name || item.skuId,
                  beforeQty: 999999999,
                  afterQty: 999999999,
                  qtyChange: 0,
                  remarks: `Dispatch Resume ${cart.dispatchSlipNumber || cart.id} | Unlimited SKU ignored`,
                  createdBy: staffId,
                }
              });
              continue;
            }

            const inventory = await tx.warehouseInventory.findUnique({
              where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId: item.skuId } }
            });

            const beforeQty = inventory?.qty || 0;
            const afterQty = beforeQty - item.qty;

            await tx.warehouseInventory.update({
              where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId: item.skuId } },
              data: { qty: afterQty, isOos: afterQty <= 0 }
            });

            await tx.inventoryHistory.create({
              data: {
                warehouseId: cart.warehouseId,
                skuId: item.skuId,
                productName: item.sku.name || item.skuId,
                beforeQty,
                afterQty,
                qtyChange: -item.qty,
                remarks: `Dispatch Resume ${cart.dispatchSlipNumber || cart.id} | Inventory Deducted`,
                createdBy: staffId,
              }
            });
          }

          await tx.cart.update({
            where: { id },
            data: {
              status: 'COMPLETED',
              resumedAt: new Date(),
              resumedById: staffId
            }
          });
        });

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const canManage = session.canManageCarts || session.role === 'ADMIN';
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden: Missing permission to manage carts' }, { status: 403 });
    }

    if (!newItems) {
      return NextResponse.json({ error: 'Missing items' }, { status: 400 });
    }

    const cart = await prisma.cart.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    if (cart.deletedAt) return NextResponse.json({ error: 'Cannot edit a deleted cart' }, { status: 400 });


    const staffId = session.userId as string;

    await prisma.$transaction(async (tx) => {
      const isHold = cart.status === 'ON_HOLD';

      if (!isHold) {
        // 1. Map existing items for comparison
        const existingItemsMap = new Map(cart.items.map(item => [item.skuId, item]));
        const newItemsMap = new Map(newItems.map(item => [item.skuId, item.qty]));

        // 2. Identify changes and validate
        const allSkuIds = Array.from(new Set([...existingItemsMap.keys(), ...newItemsMap.keys()]));

        for (const skuId of allSkuIds) {
          const existingItem = existingItemsMap.get(skuId);
          const oldQty = existingItem?.qty || 0;
          const newQty = newItemsMap.get(skuId) || 0;
          
          // Validation: Cannot exceed original quantity (Only for COMPLETED carts)
          const originalQty = existingItem?.originalQty ?? oldQty; 
          if (newQty > originalQty) {
            throw new Error(`Quantity for ${skuId} cannot exceed original quantity (${originalQty})`);
          }

          const diff = oldQty - newQty; // Positive means we add back to stock


          if (diff === 0) continue;

          // Fetch current inventory
          const inventory = await tx.warehouseInventory.findUnique({
            where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId } },
            include: { sku: true }
          });

          const beforeQty = inventory?.qty || 0;
          const afterQty = beforeQty + diff;

          // Update inventory
          await tx.warehouseInventory.upsert({
            where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId } },
            update: { qty: afterQty, isOos: afterQty <= 0 },
            create: { warehouseId: cart.warehouseId, skuId, qty: afterQty, isOos: afterQty <= 0 }
          });

          // Log history
          await tx.inventoryHistory.create({
            data: {
              warehouseId: cart.warehouseId,
              skuId,
              productName: inventory?.sku.name || skuId,
              beforeQty,
              afterQty,
              qtyChange: diff,
              remarks: `Cart Edit ${cart.dispatchSlipNumber || cart.id} | ${diff > 0 ? 'Restored' : 'Deducted'}`,
              createdBy: staffId,
            }
          });
        }
      }

      // Clear existing and recreate (Common for both flows)
      const existingItemsMap = new Map(cart.items.map(item => [item.skuId, item]));
      await tx.cartItem.deleteMany({ where: { cartId: id } });
      
      const itemsToCreate = newItems.filter(i => i.qty > 0);
      
      if (itemsToCreate.length > 0) {
        await tx.cartItem.createMany({
          data: itemsToCreate.map(item => {
            const existing = existingItemsMap.get(item.skuId);
            return {
              cartId: id,
              skuId: item.skuId,
              qty: item.qty,
              originalQty: existing?.originalQty ?? existing?.qty ?? item.qty
            };
          })
        });
      }



      // Update cart timestamp
      await tx.cart.update({
        where: { id },
        data: { updatedAt: new Date() }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[CART_PATCH_ERROR]', error);
    if (error instanceof Error && error.message.includes('Insufficient inventory')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id: session.userId as string },
      select: { canManageCarts: true, role: true }
    });

    if (!user || (!user.canManageCarts && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Missing permission to manage carts' }, { status: 403 });
    }

    const cart = await prisma.cart.findUnique({
      where: { id },
      include: { items: { include: { sku: true } } }
    });

    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    if (cart.deletedAt) return NextResponse.json({ error: 'Cart already deleted' }, { status: 400 });

    const staffId = session.userId as string;

    await prisma.$transaction(async (tx) => {
      const isHold = cart.status === 'ON_HOLD' || cart.status === 'DISPATCH_HOLD';

      if (!isHold) {
        // 1. Restore all inventory
        for (const item of cart.items) {
          const inventory = await tx.warehouseInventory.findUnique({
            where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId: item.skuId } }
          });

          const beforeQty = inventory?.qty || 0;
          const afterQty = beforeQty + item.qty;

          await tx.warehouseInventory.upsert({
            where: { warehouseId_skuId: { warehouseId: cart.warehouseId, skuId: item.skuId } },
            update: { qty: afterQty, isOos: afterQty <= 0 },
            create: { warehouseId: cart.warehouseId, skuId: item.skuId, qty: afterQty, isOos: afterQty <= 0 }
          });

          // Log history
          await tx.inventoryHistory.create({
            data: {
              warehouseId: cart.warehouseId,
              skuId: item.skuId,
              productName: item.sku.name || item.skuId,
              beforeQty,
              afterQty,
              qtyChange: item.qty,
              remarks: `Cart Deletion ${cart.dispatchSlipNumber || cart.id} | Full Restore`,
              createdBy: staffId,
            }
          });
        }
      }

      // 2. Soft delete cart
      await tx.cart.update({ 
        where: { id },
        data: { deletedAt: new Date() }
      });
    });


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CART_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

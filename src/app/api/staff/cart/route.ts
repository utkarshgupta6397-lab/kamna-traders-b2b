import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

type CartItemInput = {
  skuId: string;
  qty: number;
};

export async function POST(request: Request) {
  try {
    // 1. Verify staff session server-side — never trust client-passed staffId
    const session = await getSession();
    if (!session?.userId || typeof session.userId !== 'string') {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const staffId = session.userId;

    const body = await request.json();
    const { warehouseId, customerName, notes, items } = body as {
      warehouseId?: string;
      customerName?: string;
      notes?: string;
      items?: CartItemInput[];
    };

    if (!warehouseId || !customerName || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate item shape
    for (const item of items) {
      if (!item.skuId || typeof item.qty !== 'number' || item.qty < 1) {
        return NextResponse.json(
          { error: `Invalid item: skuId="${item.skuId}", qty=${item.qty}` },
          { status: 400 }
        );
      }
    }

    // 1.5 Idempotency / Fingerprint check (prevent double clicks within 15 seconds)
    const timeWindow = new Date(Date.now() - 15 * 1000);
    const recentDuplicateCart = await prisma.cart.findFirst({
      where: {
        staffId,
        warehouseId,
        customerName,
        createdAt: { gte: timeWindow },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    if (recentDuplicateCart) {
      // Check if items exactly match
      const isDuplicate =
        recentDuplicateCart.items.length === items.length &&
        items.every((newItem) => {
          const existingItem = recentDuplicateCart.items.find((i) => i.skuId === newItem.skuId);
          return existingItem && existingItem.qty === newItem.qty;
        });

      if (isDuplicate) {
        console.log(`Prevented duplicate cart submission. Returning existing cart ${recentDuplicateCart.id}`);
        return NextResponse.json({ success: true, cartId: recentDuplicateCart.id }, { status: 200 });
      }
    }

    // 2. Prisma interactive transaction — atomic cart + items + inventory deduction
    const cart = await prisma.$transaction(async (tx) => {
      // Generate cart ID
      const count = await tx.cart.count();
      const cartId = `KT${1000 + count + 1}`;

      // Verify warehouse exists
      const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
      if (!warehouse || !warehouse.active) {
        throw new Error('Warehouse not found or inactive');
      }

      // Verify staff exists and is active
      const staff = await tx.user.findUnique({ where: { id: staffId } });
      if (!staff || !staff.active) {
        throw new Error('Staff account not found or deactivated');
      }

      // Deduct inventory for each item — prevent negative stock
      for (const item of items) {
        const inventory = await tx.warehouseInventory.findUnique({
          where: { warehouseId_skuId: { warehouseId, skuId: item.skuId } },
        });

        if (!inventory) {
          throw new Error(`No inventory record for SKU "${item.skuId}" in this warehouse`);
        }
        if (inventory.qty < item.qty) {
          throw new Error(
            `Insufficient stock for SKU "${item.skuId}": available=${inventory.qty}, requested=${item.qty}`
          );
        }

        await tx.warehouseInventory.update({
          where: { warehouseId_skuId: { warehouseId, skuId: item.skuId } },
          data: {
            qty: { decrement: item.qty },
            isOos: inventory.qty - item.qty === 0,
          },
        });
      }

      // Create cart + items
      const newCart = await tx.cart.create({
        data: {
          id: cartId,
          warehouseId,
          customerName,
          notes: notes ?? null,
          staffId,
          items: {
            create: items.map((i) => ({
              skuId: i.skuId,
              qty: i.qty,
            })),
          },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: staffId,
          action: 'CART_CREATED',
          details: `Cart ${cartId} created with ${items.length} item(s) for "${customerName}"`,
        },
      });

      return newCart;
    });

    return NextResponse.json({ success: true, cartId: cart.id }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error creating cart:', error);

    // Return domain errors (stock, validation) as 400; unexpected errors as 500
    const isBusinessError =
      message.includes('Insufficient stock') ||
      message.includes('No inventory record') ||
      message.includes('not found') ||
      message.includes('deactivated');

    return NextResponse.json(
      { error: message },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

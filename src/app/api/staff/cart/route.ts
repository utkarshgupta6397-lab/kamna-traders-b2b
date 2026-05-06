import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';

type CartItemInput = {
  skuId: string;
  qty: number;
};

export async function POST(request: Request) {
  try {
    // Basic CSRF/Origin protection
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
    }

    // Basic rate limit: 10 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!checkRateLimit(`cart_${ip}`, 10, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

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

    // Handle empty notes safely
    const safeNotes = notes && notes.trim() !== '' ? notes.trim() : null;

    // 1.5 Idempotency / Fingerprint check (prevent double clicks within 15 seconds)
    const timeWindow = new Date(Date.now() - 15 * 1000);
    const recentDuplicateCart = await prisma.cart.findFirst({
      where: {
        staffId,
        warehouseId,
        customerName,
        createdAt: { gte: timeWindow },
      },
      select: { 
        id: true,
        items: { select: { skuId: true, qty: true } }
      },
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

    // 1.7 Batch read SKUs and Inventory before transaction
    const skuIds = items.map((i) => i.skuId);
    const [skus, inventories] = await Promise.all([
      prisma.sku.findMany({
        where: { id: { in: skuIds } },
      }),
      prisma.warehouseInventory.findMany({
        where: {
          warehouseId,
          skuId: { in: skuIds },
        },
      }),
    ]);

    const skuMap = new Map(skus.map((s) => [s.id, s]));
    const inventoryMap = new Map(inventories.map((i) => [i.skuId, i]));

    // In-memory validation
    for (const item of items) {
      const sku = skuMap.get(item.skuId);
      if (!sku) {
        throw new Error(`SKU "${item.skuId}" does not exist in the catalog`);
      }
      if (item.qty < sku.moq) {
        throw new Error(`Quantity for SKU "${item.skuId}" (${item.qty}) is below MOQ (${sku.moq})`);
      }

      const inventory = inventoryMap.get(item.skuId);
      // If no inventory record, we assume it's an untracked SKU (created with 999 later if needed)
      // but we should still check if it's available. 
      // If it doesn't exist, it will be created in the transaction.
      if (inventory && inventory.qty < item.qty) {
        throw new Error(
          `Insufficient stock for SKU "${item.skuId}": available=${inventory.qty}, requested=${item.qty}`
        );
      }
    }

    // 2. Prisma interactive transaction — atomic cart + items + inventory deduction
    const cart = await prisma.$transaction(async (tx) => {
      // Generate collision-safe cart ID (KT-[TIMESTAMP]-[RANDOM_4_CHARS])
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomSuffix = crypto.randomUUID().split('-')[0].substring(0, 4).toUpperCase();
      const cartId = `KT-${timestamp}-${randomSuffix}`;

      // Verify warehouse exists (fast check)
      const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, active: true } });
      if (!warehouse || !warehouse.active) {
        throw new Error('Warehouse not found or inactive');
      }

      // Verify staff exists and is active (fast check)
      const staff = await tx.user.findUnique({ where: { id: staffId }, select: { id: true, active: true } });
      if (!staff || !staff.active) {
        throw new Error('Staff account not found or deactivated');
      }

      // Deduct inventory for each item
      for (const item of items) {
        const inventory = inventoryMap.get(item.skuId);

        if (!inventory) {
          // Auto-create inventory record for untracked SKUs
          await tx.warehouseInventory.create({
            data: {
              warehouseId,
              skuId: item.skuId,
              qty: 999 - item.qty,
              isOos: 999 - item.qty === 0,
            },
          });
        } else {
          await tx.warehouseInventory.update({
            where: { warehouseId_skuId: { warehouseId, skuId: item.skuId } },
            data: {
              qty: { decrement: item.qty },
              isOos: inventory.qty - item.qty === 0,
            },
          });
        }
      }

      // Generate structured dispatch number (KS-DP/DD-MMM-YY/NNN)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      const dayCount = await tx.cart.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      const sequence = (dayCount + 1).toString().padStart(3, '0');
      const datePart = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      }).replace(/ /g, '-');
      const dispatchSlipNumber = `KS-DP/${datePart}/${sequence}`;

      // Create cart + items with defensive fallback for missing column
      let cart;
      try {
        cart = await tx.cart.create({
          data: {
            id: cartId,
            dispatchSlipNumber,
            warehouseId,
            customerName,
            notes: safeNotes,
            staffId,
            items: {
              create: items.map((i) => ({
                skuId: i.skuId,
                qty: i.qty,
              })),
            },
          },
        });
      } catch (err: any) {
        // Fallback if production DB hasn't been migrated yet
        if (err.message?.includes('dispatchSlipNumber') || err.code === 'P2025') {
          console.warn('Production DB missing dispatchSlipNumber column. Falling back to basic creation.');
          cart = await tx.cart.create({
            data: {
              id: cartId,
              warehouseId,
              customerName,
              notes: safeNotes,
              staffId,
              items: {
                create: items.map((i) => ({
                  skuId: i.skuId,
                  qty: i.qty,
                })),
              },
            },
          });
        } else {
          throw err;
        }
      }
      return cart;
    }, { maxWait: 5000, timeout: 10000 });

    // 3. Audit log (outside transaction for performance)
    // We don't await this to speed up response, but in a production app 
    // you might want to ensure it finishes or use a queue.
    prisma.auditLog.create({
      data: {
        userId: staffId,
        action: 'CART_CREATED',
        details: `Cart ${cart.id} created with ${items.length} item(s) for "${customerName}"`,
      },
    }).catch(err => console.error('Failed to create audit log:', err));

    return NextResponse.json({ success: true, cartId: cart.id }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error creating cart:', error);

    // Return domain errors (stock, validation) as 400; unexpected errors as 500
    const isBusinessError =
      message.includes('Insufficient stock') ||
      message.includes('No inventory record') ||
      message.includes('not found') ||
      message.includes('deactivated') ||
      message.includes('does not exist') ||
      message.includes('below MOQ');

    return NextResponse.json(
      { error: message },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

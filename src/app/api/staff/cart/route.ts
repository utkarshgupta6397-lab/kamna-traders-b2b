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
    // 1. Basic Safety & Rate Limiting
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!checkRateLimit(`cart_${ip}`, 10, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // 2. Auth Verification
    const session = await getSession();
    const rawStaffId = session?.userId;
    if (typeof rawStaffId !== 'string') {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const staffId = rawStaffId;

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

    // 3. Batch Reads & Validation (ALL READS OUTSIDE TRANSACTION)
    const skuIds = items.map((i) => i.skuId);
    
    // Fetch all necessary data in parallel to minimize latency
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [skus, inventories, warehouse, staff, dayCount] = await Promise.all([
      prisma.sku.findMany({ where: { id: { in: skuIds } } }),
      prisma.warehouseInventory.findMany({ where: { warehouseId, skuId: { in: skuIds } } }),
      prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, active: true } }),
      prisma.user.findUnique({ where: { id: staffId }, select: { id: true, active: true } }),
      prisma.cart.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
    ]);

    // 4. In-Memory Validation & Preparations
    if (!warehouse || !warehouse.active) throw new Error('Warehouse not found or inactive');
    if (!staff || !staff.active) throw new Error('Staff account not found or deactivated');

    const skuMap = new Map(skus.map((s) => [s.id, s]));
    const inventoryMap = new Map(inventories.map((i) => [i.skuId, i]));

    for (const item of items) {
      const sku = skuMap.get(item.skuId);
      if (!sku) throw new Error(`SKU "${item.skuId}" does not exist`);
      if (item.qty < sku.moq) throw new Error(`Qty for ${item.skuId} is below MOQ (${sku.moq})`);

      const inv = inventoryMap.get(item.skuId);
      if (inv && inv.qty < item.qty) {
        throw new Error(`Insufficient stock for ${item.skuId}: ${inv.qty} available, ${item.qty} requested`);
      }
    }

    // 5. Generate Identifiers
    const cartId = `KT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const sequence = (dayCount + 1).toString().padStart(3, '0');
    const datePart = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
    const dispatchSlipNumber = `KS-DP-${Date.now()}`; // TEMPORARY FALLBACK to test uniqueness
    const safeNotes = notes?.trim() || null;

    // Detect if dispatchSlipNumber column exists before transaction
    let hasDispatchSlipNumber = false;
    try {
      const result = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='Cart' AND column_name='dispatchSlipNumber'
      `;
      hasDispatchSlipNumber = Array.isArray(result) && result.length > 0;
    } catch (err) {
      console.warn('Failed to check column existence, assuming false', err);
    }

    const cartData: any = {
      id: cartId,
      warehouseId,
      customerName,
      notes: safeNotes,
      staffId,
      items: { create: items.map((i) => ({ skuId: i.skuId, qty: i.qty })) },
    };

    if (hasDispatchSlipNumber) {
      cartData.dispatchSlipNumber = dispatchSlipNumber;
    }

    // 6. Minimal Transaction (WRITES ONLY)
    console.log(`[TX_START] Starting transaction for cartId: ${cartId}`);
    const cart = await prisma.$transaction(async (tx) => {
      // Inventory updates
      let stepCounter = 1;
      for (const item of items) {
        const inv = inventoryMap.get(item.skuId);
        if (!inv) {
          console.log(`[TX_STEP ${stepCounter++}: warehouseInventory.create] Creating inventory for SKU ${item.skuId} at warehouse ${warehouseId}`);
          try {
            await tx.warehouseInventory.create({
              data: { warehouseId, skuId: item.skuId, qty: 999 - item.qty, isOos: 999 - item.qty <= 0 },
            });
          } catch (e: any) {
            console.error(`[TX_FAIL: warehouseInventory.create] Failed for SKU ${item.skuId}`, e);
            throw new Error(`Transaction aborted during warehouseInventory.create for ${item.skuId}: ${e.message}`);
          }
        } else {
          console.log(`[TX_STEP ${stepCounter++}: warehouseInventory.update] Updating inventory for SKU ${item.skuId} at warehouse ${warehouseId}`);
          try {
            await tx.warehouseInventory.update({
              where: { warehouseId_skuId: { warehouseId, skuId: item.skuId } },
              data: { qty: { decrement: item.qty }, isOos: inv.qty - item.qty <= 0 },
            });
          } catch (e: any) {
            console.error(`[TX_FAIL: warehouseInventory.update] Failed for SKU ${item.skuId}`, e);
            throw new Error(`Transaction aborted during warehouseInventory.update for ${item.skuId}: ${e.message}`);
          }
        }
      }

      console.log(`[TX_STEP ${stepCounter++}: cart.create] Creating cart ${cartId}`);
      try {
        return await tx.cart.create({
          data: cartData,
        });
      } catch (err: any) {
        console.error(`[TX_FAIL: cart.create] Failed to create cart ${cartId}`, err);
        throw new Error(`Transaction aborted during cart.create: ${err.message}`);
      }
    }, { maxWait: 5000, timeout: 10000 });
    console.log(`[TX_END] Transaction successful for cartId: ${cartId}`);
    console.log(`[TX_END] Transaction successful for cartId: ${cartId}`);

    // 7. Success Response
    return NextResponse.json({ success: true, cartId: cart.id }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[CART_ERROR]', error);

    const isBusinessError = 
      message.includes('stock') || 
      message.includes('not found') || 
      message.includes('inactive') || 
      message.includes('MOQ') ||
      message.includes('does not exist');

    return NextResponse.json(
      { error: message },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}

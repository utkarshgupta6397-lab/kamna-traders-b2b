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
    console.log('[DEBUG] POST /api/staff/cart payload:', JSON.stringify(body, null, 2));
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


    const [skus, inventories, warehouse, staff] = await Promise.all([
      prisma.sku.findMany({ where: { id: { in: skuIds } } }),
      prisma.warehouseInventory.findMany({ where: { warehouseId, skuId: { in: skuIds } } }),
      prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, active: true } }),
      prisma.user.findUnique({ where: { id: staffId }, select: { id: true, active: true } }),
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
    }

    // 5. Generate Identifiers
    const cartId = `KT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const datePart = now.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: '2-digit',
      timeZone: 'Asia/Kolkata' 
    }).replace(/ /g, '/');
    const safeNotes = notes?.trim() || null;

    const cartData: any = {
      id: cartId,
      warehouseId,
      customerName,
      notes: safeNotes,
      staffId,
      items: { create: items.map((i) => ({ skuId: i.skuId, qty: i.qty })) },
    };

    // 6. Minimal Transaction (WRITES ONLY)
    console.log(`[TX_START] Starting transaction for cartId: ${cartId}`);
    const cart = await prisma.$transaction(async (tx) => {
      console.log(`[DEBUG] Step: 6.1 (Generate Sequence), datePart: ${datePart}`);
      let seqRecord;
      try {
        seqRecord = await tx.dispatchSequence.upsert({
          where: { date: datePart },
          create: { date: datePart, sequence: 1 },
          update: { sequence: { increment: 1 } },
        });
      } catch (err: any) {
        console.error(`[TX_FAIL: dispatchSequence.upsert] Failed for date ${datePart}`, {
          error: err.message,
          code: err.code,
          meta: err.meta,
        });
        throw new Error(`Transaction aborted during sequence generation: ${err.message}`);
      }
      
      const generatedSlipNumber = `KS-DP-${datePart}-${seqRecord.sequence.toString().padStart(3, '0')}`;
      console.log(`[DEBUG] Generated dispatchNo: ${generatedSlipNumber}`);
      cartData.dispatchSlipNumber = generatedSlipNumber;

      // 6.2 Inventory updates & History logging
      let stepCounter = 1;
      for (const item of items) {
        const sku = skuMap.get(item.skuId);
        const inv = inventoryMap.get(item.skuId);
        
        let beforeQty = inv?.qty ?? 0;
        // In this app's current logic (line 123), if inventory doesn't exist, it assumes a start of 999.
        // We'll reflect that assumption if needed, or stick to 0. 
        // Let's use the actual logic from the create/update calls below.
        if (!inv) beforeQty = 999; 

        const afterQty = beforeQty - item.qty;

        if (!inv) {
          console.log(`[TX_STEP ${stepCounter++}: warehouseInventory.create] Creating inventory for SKU ${item.skuId} at warehouse ${warehouseId}`);
          try {
            await tx.warehouseInventory.create({
              data: { warehouseId, skuId: item.skuId, qty: afterQty, isOos: afterQty <= 0 },
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
              data: { qty: { decrement: item.qty }, isOos: afterQty <= 0 },
            });
          } catch (e: any) {
            console.error(`[TX_FAIL: warehouseInventory.update] Failed for SKU ${item.skuId}`, e);
            throw new Error(`Transaction aborted during warehouseInventory.update for ${item.skuId}: ${e.message}`);
          }
        }

        // Add Inventory History Row
        console.log(`[TX_STEP ${stepCounter++}: inventoryHistory.create] Logging history for SKU ${item.skuId}`);
        await tx.inventoryHistory.create({
          data: {
            warehouseId,
            skuId: item.skuId,
            productName: sku?.name || item.skuId,
            beforeQty,
            afterQty,
            qtyChange: -item.qty,
            remarks: `Dispatch ${generatedSlipNumber} | Customer: ${customerName}`,
            createdBy: staffId,
          }
        });
      }

      console.log(`[DEBUG] Step: 6.3 (Create Cart), cartId: ${cartId}, dispatchNo: ${cartData.dispatchSlipNumber}`);
      try {
        const newCart = await tx.cart.create({
          data: cartData,
          select: { id: true },
        });
        console.log(`[DEBUG] Cart created successfully in DB: ${newCart.id}`);
        return newCart;
      } catch (err: any) {
        console.error(`[TX_FAIL: cart.create] Failed to create cart ${cartId}`, {
          error: err.message,
          code: err.code,
          meta: err.meta,
          dispatchNo: cartData.dispatchSlipNumber
        });
        throw new Error(`Transaction aborted during cart.create: ${err.message}`);
      }
    }, { maxWait: 10000, timeout: 20000 });
    console.log(`[TX_END] Transaction successful for cartId: ${cartId}`);

    // 7. Success Response
    return NextResponse.json({ success: true, cartId: cart.id }, { status: 200 });

  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[CART_ERROR] Full metadata:', {
      message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
    });

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

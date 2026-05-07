import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';
import { Prisma } from '@prisma/client';

type CartItemInput = {
  skuId: string;
  qty: number;
};

export async function POST(request: Request) {
  const t0 = performance.now();
  const perf: Record<string, number> = {};
  let queryCount = 0;
  
  try {
    // 1. Basic Safety & Rate Limiting
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!checkRateLimit(`cart_${ip}`, 10, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // 2. Auth Verification (JWT-only, no DB hit)
    const tAuthStart = performance.now();
    const session = await getSession();
    const rawStaffId = session?.userId;
    if (typeof rawStaffId !== 'string') {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const staffId = rawStaffId;
    perf.auth = performance.now() - tAuthStart;

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

    // ═══════════════════════════════════════════════════════════════
    // 3. BATCH READS — 3 flat parallel queries, no nested includes
    // ═══════════════════════════════════════════════════════════════
    const tReadStart = performance.now();
    const skuIds = items.map((i) => i.skuId);

    const [warehouse, staffUser, inventories] = await Promise.all([
      prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, name: true, active: true },
      }),
      prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, name: true, active: true },
      }),
      prisma.warehouseInventory.findMany({
        where: { warehouseId, skuId: { in: skuIds } },
        select: { skuId: true, qty: true, zone: true, id: true },
      }),
    ]);
    queryCount += 3;

    // Only fetch SKU details if some items lack inventory records
    const inventoryMap = new Map(inventories.map((i) => [i.skuId, i]));
    const skuIdsNeedingLookup = skuIds.filter(id => !inventoryMap.has(id));

    let skuDetails: { id: string; name: string; unit: string | null; moq: number }[] = [];
    if (skuIdsNeedingLookup.length > 0) {
      skuDetails = await prisma.sku.findMany({
        where: { id: { in: skuIds } },
        select: { id: true, name: true, unit: true, moq: true },
      });
      queryCount += 1;
    } else {
      // All items have inventory — fetch SKU metadata in one query
      skuDetails = await prisma.sku.findMany({
        where: { id: { in: skuIds } },
        select: { id: true, name: true, unit: true, moq: true },
      });
      queryCount += 1;
    }

    perf.preReads = performance.now() - tReadStart;

    // 4. In-Memory Validation
    if (!warehouse || !warehouse.active) throw new Error('Warehouse not found or inactive');
    if (!staffUser || !staffUser.active) throw new Error('Staff account not found or deactivated');

    const skuMap = new Map(skuDetails.map((s) => [s.id, s]));

    for (const item of items) {
      const sku = skuMap.get(item.skuId);
      if (!sku) throw new Error(`SKU "${item.skuId}" does not exist`);
      if (item.qty < sku.moq) throw new Error(`Qty for ${item.skuId} is below MOQ (${sku.moq})`);
    }

    // 5. Generate Identifiers
    const cartId = `KT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();
    const datePart = now.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata'
    }).replace(/ /g, '/');

    // 6. Pre-compute all write data in memory
    const inventoryOps = items.map((item) => {
      const inv = inventoryMap.get(item.skuId);
      const beforeQty = inv ? inv.qty : 999;
      const afterQty = beforeQty - item.qty;
      return {
        skuId: item.skuId,
        exists: !!inv,
        beforeQty,
        afterQty,
        deductQty: item.qty,
      };
    });

    // ═══════════════════════════════════════════════════════════════
    // 7. RAW SQL TRANSACTION — 4 queries total instead of 3+N
    //    Prisma interactive transactions serialize ALL queries on one
    //    connection. Promise.all inside tx does NOT parallelize.
    //    Using $executeRawUnsafe for bulk inventory update eliminates
    //    the N per-item query overhead entirely.
    // ═══════════════════════════════════════════════════════════════
    const tTxStart = performance.now();

    const result = await prisma.$transaction(async (tx) => {
      // 7.1 Sequence number generation (1 query)
      const tSeqStart = performance.now();
      const seqRecord = await tx.dispatchSequence.upsert({
        where: { date: datePart },
        create: { date: datePart, sequence: 1 },
        update: { sequence: { increment: 1 } },
      });
      queryCount += 1;
      perf.dispatchNo = performance.now() - tSeqStart;

      const generatedSlipNumber = `KS-DP-${datePart}-${seqRecord.sequence.toString().padStart(3, '0')}`;
      const safeNotes = notes?.trim() || null;
      const tWritesStart = performance.now();

      // 7.2 Build all data arrays
      const historyRows = items.map((item, i) => {
        const op = inventoryOps[i];
        const sku = skuMap.get(item.skuId);
        return {
          warehouseId,
          skuId: item.skuId,
          productName: sku?.name || item.skuId,
          beforeQty: op.beforeQty,
          afterQty: op.afterQty,
          qtyChange: -item.qty,
          remarks: `Dispatch ${generatedSlipNumber} | Customer: ${customerName}`,
          createdBy: staffId,
        };
      });

      const cartItemRows = items.map(i => ({
        cartId,
        skuId: i.skuId,
        qty: i.qty,
      }));

      // 7.3 Cart + CartItems + History — 3 bulk inserts
      await tx.cart.create({
        data: {
          id: cartId,
          warehouseId,
          customerName,
          notes: safeNotes,
          staffId,
          dispatchSlipNumber: generatedSlipNumber,
        },
      });
      queryCount += 1;

      await tx.cartItem.createMany({ data: cartItemRows });
      queryCount += 1;

      await tx.inventoryHistory.createMany({ data: historyRows });
      queryCount += 1;

      // 7.4 Bulk inventory update via raw SQL (1 query for ALL items)
      //     This replaces N individual update/create calls with a single
      //     INSERT ... ON CONFLICT ... UPDATE statement.
      const existingOps = inventoryOps.filter(op => op.exists);
      const newOps = inventoryOps.filter(op => !op.exists);

      if (existingOps.length > 0) {
        // Build a single UPDATE using CASE/WHEN for all existing inventory
        const setClauses = existingOps.map(op =>
          `WHEN "skuId" = '${op.skuId}' THEN "qty" - ${op.deductQty}`
        ).join(' ');

        const oosClauses = existingOps.map(op =>
          `WHEN "skuId" = '${op.skuId}' THEN ${op.afterQty <= 0}`
        ).join(' ');

        const skuIdList = existingOps.map(op => `'${op.skuId}'`).join(',');

        await tx.$executeRawUnsafe(`
          UPDATE "WarehouseInventory"
          SET
            "qty" = CASE ${setClauses} ELSE "qty" END,
            "isOos" = CASE ${oosClauses} ELSE "isOos" END,
            "updatedAt" = NOW()
          WHERE "warehouseId" = '${warehouseId}'
            AND "skuId" IN (${skuIdList})
        `);
        queryCount += 1;
      }

      if (newOps.length > 0) {
        await tx.warehouseInventory.createMany({
          data: newOps.map(op => ({
            warehouseId,
            skuId: op.skuId,
            qty: op.afterQty,
            isOos: op.afterQty <= 0,
          })),
        });
        queryCount += 1;
      }

      perf.transactionWrites = performance.now() - tWritesStart;
      return { cartId, generatedSlipNumber };
    }, { maxWait: 10000, timeout: 20000 });

    perf.transactionTotal = performance.now() - tTxStart;

    // 8. Build print payload from in-memory data (ZERO re-fetches)
    const enrichedItems = items.map((item) => {
      const sku = skuMap.get(item.skuId);
      const inv = inventoryMap.get(item.skuId);
      return {
        skuId: item.skuId,
        name: sku?.name || item.skuId,
        qty: item.qty,
        unit: sku?.unit || 'PCS',
        zone: inv?.zone ?? 'Unassigned',
      };
    });

    const zoneGroups: Record<string, any[]> = {};
    for (const item of enrichedItems) {
      (zoneGroups[item.zone] ??= []).push(item);
    }

    perf.apiTotal = performance.now() - t0;

    const vercelRegion = request.headers.get('x-vercel-id')?.split(':')[0] || 'local';
    const serverTiming = Object.entries(perf)
      .map(([name, dur]) => `${name};dur=${dur.toFixed(0)}`)
      .join(', ');

    return NextResponse.json({
      success: true,
      cartId: result.cartId,
      printPayload: {
        id: result.cartId,
        dispatchSlipNumber: result.generatedSlipNumber,
        customerName,
        notes: notes?.trim() || null,
        createdAt: now,
        warehouseName: warehouse.name,
        staffName: staffUser.name,
        items: enrichedItems,
        zoneGroups,
        qrPayload: JSON.stringify(enrichedItems.map(i => ({ sku: i.skuId, qty: i.qty }))),
      },
      perf: {
        ...perf,
        queryCount,
        skuCount: items.length,
        zoneCount: Object.keys(zoneGroups).length,
        vercelRegion,
        dbType: process.env.DATABASE_URL?.includes('supabase') ? 'Supabase' : 'Postgres',
      }
    }, { 
      status: 200,
      headers: {
        'Server-Timing': serverTiming
      }
    });

  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';
import { Prisma } from '@prisma/client';
import { syncDispatchToZoho, addZohoTrace } from '@/lib/zoho-auth';

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
    const { warehouseId, customerName, notes, items, action, cartId: providedCartId } = body as {
      warehouseId?: string;
      customerName?: string;
      notes?: string;
      items?: CartItemInput[];
      action?: 'hold';
      cartId?: string;
    };

    const isHold = action === 'hold';
    const isUpdate = !!providedCartId;

    if (!warehouseId || !customerName || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const skuIds = items.map((i) => i.skuId);
    const now = new Date();
    const datePart = now.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata'
    }).replace(/ /g, '/');
    const safeNotes = notes?.trim() || null;

    let cartId = `KT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    if (isUpdate) {
      const existing = await prisma.cart.findUnique({
        where: { id: providedCartId },
        select: { status: true }
      });
      if (!existing) {
        return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
      }
      if (existing.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Finalized dispatches cannot be resumed' }, { status: 400 });
      }
      cartId = providedCartId!;
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. ALL READS + SEQUENCE — 3 parallel queries (1 wall-clock roundtrip)
    //    The sequence upsert is atomic and independent of read results,
    //    so it runs in parallel with the reads instead of sequentially.
    //    This saves 1 full Supabase roundtrip (~1100ms).
    // ═══════════════════════════════════════════════════════════════
    const tReadStart = performance.now();
    const skuPlaceholders = skuIds.map((_, i) => `$${i + 2}`).join(',');

    const [metaRows, skuInvRows, seqRows] = await Promise.all([
      // Query 1: Warehouse + User via cross join
      prisma.$queryRawUnsafe<Array<{
        wid: string; wname: string; wactive: boolean;
        uid: string; uname: string; uactive: boolean;
      }>>(
        `SELECT w."id" AS "wid", w."name" AS "wname", w."active" AS "wactive",
                u."id" AS "uid", u."name" AS "uname", u."active" AS "uactive"
         FROM "Warehouse" w, "User" u
         WHERE w."id" = $1 AND u."id" = $2`,
        warehouseId, staffId
      ),
      // Query 2: SKU details + inventory via LEFT JOIN
      prisma.$queryRawUnsafe<Array<{
        id: string; name: string; unit: string | null; moq: number; is_unlimited: boolean;
        inv_qty: number | null; inv_zone: string | null;
      }>>(
        `SELECT s."id", s."name", s."unit", s."moq", s."isUnlimited" AS "is_unlimited",
                wi."qty" AS "inv_qty", wi."zone" AS "inv_zone"
         FROM "Sku" s
         LEFT JOIN "WarehouseInventory" wi
           ON wi."skuId" = s."id" AND wi."warehouseId" = $1
         WHERE s."id" IN (${skuPlaceholders})`,
        warehouseId, ...skuIds
      ),
      // Query 3: Atomic dispatch sequence (parallel with reads)
      prisma.$queryRawUnsafe<Array<{ sequence: number }>>(
        `INSERT INTO "DispatchSequence" ("date", "sequence")
         VALUES ($1, 1)
         ON CONFLICT ("date")
         DO UPDATE SET "sequence" = "DispatchSequence"."sequence" + 1
         RETURNING "sequence"`,
        datePart
      ),
    ]);
    queryCount += 3;
    perf.preReads = performance.now() - tReadStart;
    perf.dispatchNo = 0; // Folded into parallel reads, no additional latency

    // 4. In-Memory Validation
    const meta = metaRows[0];
    if (!meta || !meta.wactive) throw new Error('Warehouse not found or inactive');
    if (!meta.uid || !meta.uactive) throw new Error('Staff account not found or deactivated');

    const skuMap = new Map(skuInvRows.map(r => [r.id, r]));
    for (const item of items) {
      const sku = skuMap.get(item.skuId);
      if (!sku) throw new Error(`SKU "${item.skuId}" does not exist`);
      if (item.qty < sku.moq) throw new Error(`Qty for ${item.skuId} is below MOQ (${sku.moq})`);
    }

    // 5. Generate slip number from sequence (Skip if hold)
    let generatedSlipNumber: string | null = null;
    if (!isHold) {
      const seqNum = Number(seqRows[0].sequence);
      generatedSlipNumber = `KS-DP-${datePart}-${seqNum.toString().padStart(3, '0')}`;
    }

    // 6. Pre-compute all write payloads in memory (Skip history calculation if hold)
    const inventoryOps = items.map((item) => {
      const row = skuMap.get(item.skuId)!;
      const hasInv = row.inv_qty !== null;
      const isUnlimited = !!row.is_unlimited;
      const beforeQty = hasInv ? Number(row.inv_qty) : 999;
      const afterQty = beforeQty - item.qty;
      return { skuId: item.skuId, exists: hasInv, beforeQty, afterQty, deductQty: item.qty, isUnlimited };
    });

    const historyRows = isHold ? [] : items.map((item, i) => {
      const op = inventoryOps[i];
      const sku = skuMap.get(item.skuId)!;
      return {
        warehouseId,
        skuId: item.skuId,
        productName: sku.name || item.skuId,
        beforeQty: op.isUnlimited ? 999999999 : op.beforeQty,
        afterQty: op.isUnlimited ? 999999999 : op.afterQty,
        qtyChange: -item.qty,
        remarks: `Dispatch ${generatedSlipNumber} | Customer: ${customerName}`,
        createdBy: staffId,
      };
    });

    // ═══════════════════════════════════════════════════════════════
    // 7. WRITES — Lean batch tx (cart + items + inventory only)
    // ═══════════════════════════════════════════════════════════════
    const tWritesStart = performance.now();

    const batchOps: Prisma.PrismaPromise<any>[] = [];

    if (isUpdate) {
      batchOps.push(
        prisma.cart.update({
          where: { id: cartId },
          data: {
            status: isHold ? 'ON_HOLD' : 'COMPLETED',
            warehouseId, customerName,
            notes: safeNotes, staffId,
            dispatchSlipNumber: generatedSlipNumber,
          },
        }),
        prisma.cartItem.deleteMany({ where: { cartId } })
      );
    } else {
      batchOps.push(
        prisma.cart.create({
          data: {
            id: cartId, 
            status: isHold ? 'ON_HOLD' : 'COMPLETED',
            warehouseId, customerName,
            notes: safeNotes, staffId,
            dispatchSlipNumber: generatedSlipNumber,
          },
        })
      );
    }

    batchOps.push(
      prisma.cartItem.createMany({
        data: items.map(i => ({ cartId, skuId: i.skuId, qty: i.qty, originalQty: i.qty })),
      })
    );

    // Bulk inventory update (1 raw SQL for all existing) - Skip if hold
    if (!isHold) {
      const existingOps = inventoryOps.filter(op => op.exists && !op.isUnlimited);
      if (existingOps.length > 0) {
        const setClauses = existingOps.map(op =>
          `WHEN "skuId" = '${op.skuId}' THEN "qty" - ${op.deductQty}`
        ).join(' ');
        const oosClauses = existingOps.map(op =>
          `WHEN "skuId" = '${op.skuId}' THEN ${op.afterQty <= 0}`
        ).join(' ');
        const skuIdList = existingOps.map(op => `'${op.skuId}'`).join(',');

        batchOps.push(
          prisma.$executeRawUnsafe(`
            UPDATE "WarehouseInventory"
            SET "qty" = CASE ${setClauses} ELSE "qty" END,
                "isOos" = CASE ${oosClauses} ELSE "isOos" END,
                "updatedAt" = NOW()
            WHERE "warehouseId" = '${warehouseId}'
              AND "skuId" IN (${skuIdList})
          `)
        );
      }

      const newOps = inventoryOps.filter(op => !op.exists && !op.isUnlimited);
      if (newOps.length > 0) {
        batchOps.push(
          prisma.warehouseInventory.createMany({
            data: newOps.map(op => ({
              warehouseId, skuId: op.skuId,
              qty: op.afterQty, isOos: op.afterQty <= 0,
            })),
          })
        );
      }
    }

    queryCount += batchOps.length;
    await prisma.$transaction(batchOps);
    perf.transactionWrites = performance.now() - tWritesStart;

    // Add initial trace
    await addZohoTrace(cartId, 'DISPATCH_CREATED');

    // 7.5. Zoho Sync Trigger (Background)
    // Determining baseUrl from headers ensures it works on LAN, Localhost, and Vercel
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const baseUrl = `${protocol}://${host}`;

    if (baseUrl && !isHold) {
      // Detached trigger - DO NOT AWAIT to keep response fast
      (async () => {
        const syncUrl = `${baseUrl}/api/zoho/sync-dispatch`;
        try {
          console.log(`[ZOHO][${cartId}] Triggering background sync via: ${syncUrl}`);
          await addZohoTrace(cartId, 'SYNC_FETCH_SENT');
          
          const response = await fetch(syncUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartId })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Status ${response.status}: ${errorText}`);
          }
          
          console.log(`[ZOHO][${cartId}] Sync trigger successful (status: ${response.status})`);
          await addZohoTrace(cartId, `SYNC_FETCH_RESPONSE_${response.status}`);
        } catch (err: any) {
          console.error(`[ZOHO][${cartId}] Sync trigger CRITICAL ERROR:`, err.message);
          
          // Persistence: Mark as FAILED so retry UI appears
          try {
            await prisma.cart.update({
              where: { id: cartId },
              data: { 
                zohoSyncStatus: 'FAILED',
                zohoSyncStep: 'TRIGGER_FAILED',
                zohoSyncError: `Trigger failed: ${err.message}`
              }
            });
            await addZohoTrace(cartId, 'SYNC_FETCH_FAILED');
          } catch (dbErr) {
            console.error(`[ZOHO][${cartId}] Failed to persist trigger failure:`, dbErr);
          }
        }
      })();
      console.log(`[DISPATCH][${cartId}] Zoho sync initiated background trigger`);
    } else if (isHold) {
      console.log(`[CART][${cartId}] Hold status - skipping Zoho sync`);
    } else {
      const reason = 'NO_BASE_URL';
      console.error(`[ZOHO] Sync skipped: ${reason}`, {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        appUrl: process.env.NEXT_PUBLIC_APP_URL
      });
      await addZohoTrace(cartId, `SYNC_TRIGGER_SKIPPED:${reason}`);
    }


    // 8. Post-tx audit trail (non-critical, outside transaction) - Skip if hold
    if (!isHold) {
      const tHistStart = performance.now();
      await prisma.inventoryHistory.createMany({ data: historyRows });
      queryCount += 1;
      perf.historyWrite = performance.now() - tHistStart;
    }

    perf.transactionTotal = performance.now() - tWritesStart;

    // 9. Build print payload from in-memory data (ZERO re-fetches)
    const enrichedItems = items.map((item) => {
      const row = skuMap.get(item.skuId)!;
      return {
        skuId: item.skuId,
        name: row.name || item.skuId,
        qty: item.qty,
        unit: row.unit || 'PCS',
        zone: row.inv_zone ?? 'Unassigned',
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
      cartId,
      status: isHold ? 'ON_HOLD' : 'COMPLETED',
      printPayload: isHold ? null : {
        id: cartId,
        dispatchSlipNumber: generatedSlipNumber,
        customerName,
        notes: safeNotes,
        createdAt: now,
        warehouseName: meta.wname,
        staffName: meta.uname,
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
      headers: { 'Server-Timing': serverTiming }
    });

  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

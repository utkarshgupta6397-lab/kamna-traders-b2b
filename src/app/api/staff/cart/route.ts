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

    // 2. Auth Verification
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

    // 3. Batch Reads & Validation (OPTIMIZED: 2 Unified Queries)
    const tReadStart = performance.now();
    const skuIds = items.map((i) => i.skuId);
    
    const [warehouseData, staffUser] = await Promise.all([
      prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: {
          id: true,
          name: true,
          active: true,
          inventory: {
            where: { skuId: { in: skuIds } },
            include: { sku: true }
          }
        }
      }),
      prisma.user.findUnique({ where: { id: staffId }, select: { id: true, name: true, active: true } }),
    ]);
    queryCount += 2;
    perf.preReads = performance.now() - tReadStart;

    // 4. In-Memory Validation & Preparations
    if (!warehouseData || !warehouseData.active) throw new Error('Warehouse not found or inactive');
    if (!staffUser || !staffUser.active) throw new Error('Staff account not found or deactivated');

    // Flatten inventories and skus from unified fetch
    const inventories = warehouseData.inventory;
    const inventoryMap = new Map(inventories.map((i) => [i.skuId, i]));
    const skuMap = new Map(inventories.map((i) => [i.skuId, i.sku]));

    // Check for any missing SKUs (those not in inventory)
    const missingSkuIds = skuIds.filter(id => !skuMap.has(id));
    if (missingSkuIds.length > 0) {
      // Fallback: fetch missing SKUs if they haven't been stocked yet
      const missingSkus = await prisma.sku.findMany({ where: { id: { in: missingSkuIds } } });
      queryCount += 1;
      missingSkus.forEach(s => skuMap.set(s.id, s));
    }

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
    const inventoryOps: any[] = [];
    for (const item of items) {
      const inv = inventoryMap.get(item.skuId);
      const beforeQty = inv ? inv.qty : 999;
      const afterQty = beforeQty - item.qty;
      inventoryOps.push({
        skuId: item.skuId,
        exists: !!inv,
        beforeQty,
        afterQty,
        deductQty: item.qty,
      });
    }

    // 7. Optimized Transaction (2 Roundtrips Max)
    const tTxStart = performance.now();
    const result = await prisma.$transaction(async (tx) => {
      // 7.1 Sequence Generation (Sequential roundtrip)
      const tSeqStart = performance.now();
      const seqRecord = await tx.dispatchSequence.upsert({
        where: { date: datePart },
        create: { date: datePart, sequence: 1 },
        update: { sequence: { increment: 1 } },
      });
      queryCount += 1;
      perf.dispatchNo = performance.now() - tSeqStart;

      const generatedSlipNumber = `KS-DP-${datePart}-${seqRecord.sequence.toString().padStart(3, '0')}`;
      const tWritesStart = performance.now();

      // 7.2 Prepare History Rows
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

      // 7.3 Parallel Execution of All Writes
      const invPromises = inventoryOps.map((op) => {
        queryCount += 1;
        if (!op.exists) {
          return tx.warehouseInventory.create({
            data: { warehouseId, skuId: op.skuId, qty: op.afterQty, isOos: op.afterQty <= 0 },
          });
        } else {
          return tx.warehouseInventory.update({
            where: { warehouseId_skuId: { warehouseId, skuId: op.skuId } },
            data: { qty: { decrement: op.deductQty }, isOos: op.afterQty <= 0 },
          });
        }
      });

      await Promise.all([
        tx.cart.create({
          data: {
            id: cartId,
            warehouseId,
            customerName,
            notes: notes?.trim() || null,
            staffId,
            dispatchSlipNumber: generatedSlipNumber,
          }
        }),
        tx.cartItem.createMany({
          data: items.map(i => ({ cartId, skuId: i.skuId, qty: i.qty }))
        }),
        tx.inventoryHistory.createMany({ data: historyRows }),
        ...invPromises
      ]);

      queryCount += 3; // cart + cartItems + history
      perf.transactionWrites = performance.now() - tWritesStart;

      return { cartId, generatedSlipNumber };
    }, { maxWait: 10000, timeout: 20000 });
    
    perf.transactionTotal = performance.now() - tTxStart;

    // 8. Build print payload using in-memory data (NO RE-FETCH)
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

    const totalApi = performance.now() - t0;
    perf.apiTotal = totalApi;

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
        warehouseName: warehouseData.name,
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

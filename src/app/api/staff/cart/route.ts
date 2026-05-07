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

    // 3. Batch Reads & Validation (ALL READS OUTSIDE TRANSACTION)
    const tReadStart = performance.now();
    const skuIds = items.map((i) => i.skuId);
    const now = new Date();

    const [skus, inventories, warehouse, staffUser] = await Promise.all([
      prisma.sku.findMany({ where: { id: { in: skuIds } } }),
      prisma.warehouseInventory.findMany({ where: { warehouseId, skuId: { in: skuIds } } }),
      prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, name: true, active: true } }),
      prisma.user.findUnique({ where: { id: staffId }, select: { id: true, name: true, active: true } }),
    ]);
    queryCount += 4;
    perf.preReads = performance.now() - tReadStart;

    // 4. In-Memory Validation & Preparations
    if (!warehouse || !warehouse.active) throw new Error('Warehouse not found or inactive');
    if (!staffUser || !staffUser.active) throw new Error('Staff account not found or deactivated');

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

    // 6. Pre-compute all write data in memory
    const historyRows: any[] = [];
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

    // 7. Minimal Transaction (WRITES ONLY)
    const tTxStart = performance.now();
    const cart = await prisma.$transaction(async (tx) => {
      // 7.1 Generate sequence number
      const tSeqStart = performance.now();
      const seqRecord = await tx.dispatchSequence.upsert({
        where: { date: datePart },
        create: { date: datePart, sequence: 1 },
        update: { sequence: { increment: 1 } },
      });
      queryCount += 1;
      perf.dispatchNo = performance.now() - tSeqStart;

      const generatedSlipNumber = `KS-DP-${datePart}-${seqRecord.sequence.toString().padStart(3, '0')}`;

      // 7.2 Parallelize all inventory updates
      const tInvStart = performance.now();
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

      // 7.3 Build history rows with final slip number
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const op = inventoryOps[i];
        const sku = skuMap.get(item.skuId);
        historyRows.push({
          warehouseId,
          skuId: item.skuId,
          productName: sku?.name || item.skuId,
          beforeQty: op.beforeQty,
          afterQty: op.afterQty,
          qtyChange: -item.qty,
          remarks: `Dispatch ${generatedSlipNumber} | Customer: ${customerName}`,
          createdBy: staffId,
        });
      }

      // 7.4 Create cart + bulk history + all inventory updates in parallel
      const tWritesStart = performance.now();
      const [newCart] = await Promise.all([
        tx.cart.create({
          data: {
            id: cartId,
            warehouseId,
            customerName,
            notes: safeNotes,
            staffId,
            dispatchSlipNumber: generatedSlipNumber,
            items: { create: items.map((i) => ({ skuId: i.skuId, qty: i.qty })) },
          },
          select: {
            id: true,
            dispatchSlipNumber: true,
            customerName: true,
            notes: true,
            createdAt: true,
          },
        }),
        tx.inventoryHistory.createMany({ data: historyRows }),
        ...invPromises,
      ]);
      queryCount += 2; // cart create + history createMany
      perf.transactionWrites = performance.now() - tWritesStart;

      return newCart;
    }, { maxWait: 10000, timeout: 20000 });
    
    perf.transactionTotal = performance.now() - tTxStart;

    // 8. Build print payload
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

    const tEnd = performance.now();
    const totalApi = tEnd - t0;
    perf.apiTotal = totalApi;

    // Region diagnostics
    const vercelRegion = request.headers.get('x-vercel-id')?.split(':')[0] || 'local';
    
    // Construct Server-Timing header
    const serverTiming = Object.entries(perf)
      .map(([name, dur]) => `${name};dur=${dur.toFixed(0)}`)
      .join(', ');

    return NextResponse.json({
      success: true,
      cartId: cart.id,
      printPayload: {
        id: cart.id,
        dispatchSlipNumber: cart.dispatchSlipNumber,
        customerName: cart.customerName,
        notes: cart.notes,
        createdAt: cart.createdAt,
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

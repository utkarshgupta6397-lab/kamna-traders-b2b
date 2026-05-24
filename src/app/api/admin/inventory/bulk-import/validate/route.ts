import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (!session.canAdjustInventory && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data provided.' }, { status: 400 });
    }

    // Extract unique SKUs and Warehouses to fetch from DB
    const skuIds = [...new Set(rows.map(r => r.SKU_ID?.toString().trim()).filter(Boolean))];
    const warehouseNames = [...new Set(rows.map(r => r.Warehouse_Name?.toString().trim()).filter(Boolean))];

    const [skus, warehouses] = await Promise.all([
      prisma.sku.findMany({
        where: { id: { in: skuIds }, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.warehouse.findMany({
        where: { name: { in: warehouseNames }, active: true, isSystemWarehouse: false },
        select: { id: true, name: true },
      }),
    ]);

    const skuMap = new Map(skus.map(s => [s.id, s]));
    const warehouseMap = new Map(warehouses.map(w => [w.name, w]));

    // Track combinations to check for duplicates within the file
    const seenCombos = new Set<string>();

    const results = await Promise.all(rows.map(async (row, index) => {
      const skuId = row.SKU_ID?.toString().trim();
      const warehouseName = row.Warehouse_Name?.toString().trim();
      const rawQty = row.Qty;
      const zone = row.Zone?.toString().trim() || null;

      let status = 'VALID';
      let message = '';
      let existingQty = 0;
      let warehouseId = null;

      if (!skuId) {
        status = 'INVALID';
        message = 'SKU_ID is required.';
      } else if (!skuMap.has(skuId)) {
        status = 'INVALID';
        message = `SKU not found or inactive: ${skuId}`;
      }

      if (!warehouseName) {
        status = 'INVALID';
        message = 'Warehouse_Name is required.';
      } else if (!warehouseMap.has(warehouseName)) {
        status = 'INVALID';
        message = `Warehouse not found: ${warehouseName}`;
      } else {
        warehouseId = warehouseMap.get(warehouseName)!.id;
      }

      let parsedQty = 0;
      if (rawQty === undefined || rawQty === null || rawQty === '') {
        status = 'INVALID';
        message = 'Qty is required.';
      } else {
        parsedQty = Number(rawQty);
        if (!Number.isInteger(parsedQty) || parsedQty < 0) {
          status = 'INVALID';
          message = 'Qty must be an integer >= 0.';
        }
      }

      if (status === 'VALID') {
        const comboKey = `${skuId}_${warehouseId}`;
        if (seenCombos.has(comboKey)) {
          status = 'INVALID';
          message = 'Duplicate SKU and Warehouse combination in the uploaded file.';
        } else {
          seenCombos.add(comboKey);
          // Fetch existing qty if valid so far
          const existingInv = await prisma.warehouseInventory.findUnique({
            where: { warehouseId_skuId: { warehouseId: warehouseId!, skuId: skuId! } },
            select: { qty: true },
          });
          if (existingInv) {
            existingQty = existingInv.qty;
          }
        }
      }

      return {
        ...row,
        _index: index,
        status,
        message,
        existingQty,
        warehouseId, // Include internal ID to help process step if we want
        parsedQty,
      };
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Bulk Import Validation Error:', error);
    return NextResponse.json({ error: error.message || 'Validation failed' }, { status: 500 });
  }
}

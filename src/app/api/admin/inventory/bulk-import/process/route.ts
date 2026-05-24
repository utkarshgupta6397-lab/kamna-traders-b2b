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

    const results = [];
    
    // Process sequentially or using prisma.$transaction
    // The requirement says "Use Prisma transaction"
    // Since we need to return individual row results and allow partial success,
    // wrapping everything in one massive $transaction might fail the whole batch if one fails.
    // The prompt says: "Each uploaded row must return result independently. Partial success imports are allowed."
    // So we should do individual transactions per row.

    for (const row of rows) {
      if (row.status !== 'VALID') {
        results.push({ ...row, Result: `FAILED: ${row.message || 'Validation failed'}` });
        continue;
      }

      try {
        const skuId = row.SKU_ID?.toString().trim();
        const warehouseId = row.warehouseId;
        const parsedQty = row.parsedQty;
        const zone = row.Zone?.toString().trim() || null;
        const isOos = parsedQty <= 0;

        let beforeQty = 0;
        let productName = 'Unknown';
        let qtyChange = 0;

        await prisma.$transaction(async (tx) => {
          const currentInv = await tx.warehouseInventory.findUnique({
            where: { warehouseId_skuId: { warehouseId, skuId } }
          });

          beforeQty = currentInv?.qty || 0;
          qtyChange = parsedQty - beforeQty;

          await tx.warehouseInventory.upsert({
            where: { warehouseId_skuId: { warehouseId, skuId } },
            update: {
              qty: parsedQty,
              isOos,
              zone: zone !== null ? zone : currentInv?.zone, // retain old if empty?
              updatedAt: new Date(),
              updatedById: session.id,
            },
            create: {
              warehouseId,
              skuId,
              qty: parsedQty,
              isOos,
              zone,
              updatedById: session.id,
            }
          });

          const product = await tx.sku.findUnique({ where: { id: skuId } });
          productName = product?.name || 'Unknown';
        });

        try {
          await prisma.inventoryHistory.create({
            data: {
              warehouseId,
              skuId,
              productName,
              beforeQty,
              afterQty: parsedQty,
              qtyChange,
              remarks: 'Bulk Import',
              referenceType: 'BULK_IMPORT',
              user: {
                connect: {
                  id: session.id
                }
              }
            }
          });
        } catch (historyErr: any) {
          console.warn(`[Bulk Import] Failed to log history for ${skuId}:`, historyErr.message);
        }

        results.push({ ...row, Result: 'SUCCESS' });
      } catch (err: any) {
        console.error(`[Bulk Import] Row processing error for ${row.SKU_ID}:`, err);
        let cleanMsg = err.message || 'Unknown processing error';
        if (cleanMsg.includes('Invalid `prisma') || cleanMsg.includes('PrismaClient')) {
          cleanMsg = 'Database operation failed.';
        } else {
          const lines = cleanMsg.split('\n').map((l: string) => l.trim()).filter(Boolean);
          cleanMsg = lines.length > 0 ? lines[lines.length - 1] : cleanMsg;
        }
        results.push({ ...row, Result: `FAILED: ${cleanMsg}` });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Bulk Import Process Error:', error);
    return NextResponse.json({ error: error.message || 'Process failed' }, { status: 500 });
  }
}

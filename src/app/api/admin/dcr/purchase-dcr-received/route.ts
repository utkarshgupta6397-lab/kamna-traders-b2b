import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && !session.dcr_purchase_dcr_receive && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serials: rawSerials, skuId } = await req.json();

    if (!Array.isArray(rawSerials)) {
      return NextResponse.json({ error: 'Invalid payload: serials array is required' }, { status: 400 });
    }

    const imported: any[] = [];
    const failed: any[] = [];
    const seen = new Set<string>();

    // Cleaned serials list for database query
    const cleanedSerials = rawSerials
      .map((s: string) => s.replace(/\(\s*\d+\s*W[pP]?\s*\)/g, '').trim().toUpperCase())
      .map((s: string) => s.replace(/[^A-Z0-9-]/g, '').trim())
      .filter((s: string) => s.length > 0);

    // Fetch existing records in bulk to avoid N+1 queries
    const existingSerials = await prisma.dcrSerial.findMany({
      where: {
        serialNumber: { in: cleanedSerials }
      }
    });

    const allocations = await prisma.dcrSerialAllocation.findMany({
      where: {
        serialNumber: { in: cleanedSerials }
      },
      include: {
        invoice: true
      }
    });

    // Collect all unique SKU/Item IDs to query brand/SKU mappings
    const skuIds = new Set<string>();
    if (skuId) skuIds.add(skuId);
    existingSerials.forEach(s => {
      if (s.skuId) skuIds.add(s.skuId);
    });

    const skuList = await prisma.sku.findMany({
      where: { id: { in: Array.from(skuIds) } }
    });
    const invoiceItemList = await prisma.dcrInvoiceItem.findMany({
      where: { id: { in: Array.from(skuIds) } }
    });

    const isCuidOrUuid = (val: string) => {
      return /^[a-z0-9-]{24,36}$/i.test(val) && !/^[A-Z]{2,4}\d+$/i.test(val);
    };

    const resolveSku = async (id: string | null) => {
      if (!id) return { name: 'N/A', code: 'N/A' };
      const sku = skuList.find(s => s.id === id);
      if (sku) return { name: sku.name, code: sku.id };

      const invItem = invoiceItemList.find(i => i.id === id);
      if (invItem) return { name: invItem.itemName, code: invItem.sku || 'N/A' };

      // Fallback: query database directly if not pre-fetched
      try {
        const dbSku = await prisma.sku.findUnique({ where: { id } });
        if (dbSku) return { name: dbSku.name, code: dbSku.id };
      } catch {}

      try {
        const dbInvItem = await prisma.dcrInvoiceItem.findUnique({ where: { id } });
        if (dbInvItem) return { name: dbInvItem.itemName, code: dbInvItem.sku || 'N/A' };
      } catch {}

      if (isCuidOrUuid(id)) {
        return { name: 'Unknown Product', code: 'N/A' };
      }

      return { name: 'Unknown Product', code: id };
    };

    for (let i = 0; i < rawSerials.length; i++) {
      const raw = rawSerials[i];
      const trimmed = raw.trim();

      if (!trimmed) {
        failed.push({
          index: i + 1,
          serial: "",
          sku: skuId || "N/A",
          failureType: "Empty Serial",
          reason: "Empty row skipped.",
          suggestedAction: "Discard empty line"
        });
        continue;
      }

      // Check format on the original input
      if (trimmed.includes(' ') || !/^[A-Z0-9-]+$/.test(trimmed.toUpperCase())) {
        failed.push({
          index: i + 1,
          serial: trimmed,
          sku: skuId || "N/A",
          failureType: "Invalid Format",
          reason: "Serial contains spaces or invalid special characters (only uppercase alphanumeric and hyphens allowed).",
          suggestedAction: "Remove spaces/special characters"
        });
        continue;
      }

      const cleaned = trimmed
        .replace(/\(\s*\d+\s*W[pP]?\s*\)/g, '')
        .replace(/[^A-Z0-9-]/g, '')
        .toUpperCase();

      if (cleaned.length < 6 || cleaned.length > 30) {
        failed.push({
          index: i + 1,
          serial: cleaned,
          sku: skuId || "N/A",
          failureType: "Invalid Format",
          reason: `Serial length is ${cleaned.length} (must be between 6 and 30 characters).`,
          suggestedAction: "Check length"
        });
        continue;
      }

      if (seen.has(cleaned)) {
        failed.push({
          index: i + 1,
          serial: cleaned,
          sku: skuId || "N/A",
          failureType: "Duplicate Upload",
          reason: "Duplicate in uploaded list.",
          suggestedAction: "Remove duplicate from list"
        });
        continue;
      }
      seen.add(cleaned);

      const existing = existingSerials.find(s => s.serialNumber === cleaned);
      const allocation = allocations.find(a => a.serialNumber === cleaned);

      if (existing) {
        if (existing.status === 'ISSUED') {
          failed.push({
            index: i + 1,
            serial: cleaned,
            sku: existing.skuId || "N/A",
            failureType: "Already Issued",
            reason: `Serial already issued to Invoice ${allocation?.invoice?.invoiceNumber || 'N/A'} (Issue Date: ${existing.updatedAt.toLocaleDateString()}).`,
            suggestedAction: "Review allocation"
          });
          continue;
        }

        if (existing.vendorDcrStatus === 'RECEIVED') {
          failed.push({
            index: i + 1,
            serial: cleaned,
            sku: existing.skuId || "N/A",
            failureType: "Already Has Vendor DCR",
            reason: `Vendor DCR already received (Imported on: ${existing.vendorDcrReceivedAt?.toLocaleDateString() || 'N/A'}).`,
            suggestedAction: "No action required"
          });
          continue;
        }

        if (skuId && existing.skuLocked && existing.skuId !== skuId) {
          failed.push({
            index: i + 1,
            serial: cleaned,
            sku: existing.skuId || "N/A",
            failureType: "SKU Mismatch",
            reason: `Serial belongs to SKU: ${existing.skuId}. Expected SKU: ${skuId}. SKU locked.`,
            suggestedAction: "Select correct SKU"
          });
          continue;
        }

        imported.push({
          serial: cleaned,
          sku: existing.skuId || skuId || "N/A",
          action: "UPDATE",
          existingId: existing.id,
          allocatedInvoiceNumber: allocation?.invoice?.invoiceNumber || null
        });
      } else {
        if (!skuId) {
          failed.push({
            index: i + 1,
            serial: cleaned,
            sku: "N/A",
            failureType: "SKU Missing",
            reason: "Serial not found in the system. A SKU must be selected (Quick Mode) to create new serial records.",
            suggestedAction: "Use Quick Entry mode"
          });
          continue;
        }

        imported.push({
          serial: cleaned,
          sku: skuId,
          action: "CREATE"
        });
      }
    }

    if (imported.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const item of imported) {
          if (item.action === "CREATE") {
            const newSerial = await tx.dcrSerial.create({
              data: {
                serialNumber: item.serial,
                skuId: item.sku,
                serialSource: 'VENDOR_DCR_IMPORT',
                status: 'AVAILABLE',
                vendorDcrStatus: 'RECEIVED',
                vendorDcrReceivedAt: new Date(),
                vendorDcrReceivedBy: session.name || session.userId,
                skuLocked: true
              }
            });
            await tx.dcrSerialHistory.create({
              data: {
                serialId: newSerial.id,
                eventType: 'VENDOR_DCR_RECEIVED',
                eventDescription: 'Vendor DCR received (Auto-created via Import)',
                userId: session.userId,
              }
            });
          } else {
            const updateData: any = {
              vendorDcrStatus: 'RECEIVED',
              vendorDcrReceivedAt: new Date(),
              vendorDcrReceivedBy: session.name || session.userId,
            };
            if (skuId) {
              updateData.skuId = skuId;
              updateData.skuLocked = true;
            }
            await tx.dcrSerial.update({
              where: { id: item.existingId },
              data: updateData
            });
            await tx.dcrSerialHistory.create({
              data: {
                serialId: item.existingId,
                eventType: 'VENDOR_DCR_RECEIVED',
                eventDescription: 'Vendor DCR Certificate Imported',
                userId: session.userId,
              }
            });
          }
        }

        const allocations = await tx.dcrSerialAllocation.findMany({
          where: {
            serialNumber: { in: imported.map(i => i.serial) }
          }
        });

        const invoiceIds = Array.from(new Set(allocations.map(a => a.invoiceId)));

        for (const invId of invoiceIds) {
          const inv = await tx.dcrInvoice.findUnique({
            where: { id: invId },
            include: {
              items: {
                where: { selectedForDCR: true },
                include: { serialAllocations: true }
              }
            }
          });

          if (inv) {
            let allSerialsAllocated = true;
            let anyVendorDcrPending = false;
            let totalRequired = 0;
            let totalAllocated = 0;

            const invSerialNumbers = inv.items.flatMap(item => item.serialAllocations.map(a => a.serialNumber));
            const invSerials = await tx.dcrSerial.findMany({
              where: { serialNumber: { in: invSerialNumbers } }
            });

            inv.items.forEach(item => {
              totalRequired += item.quantity;
              totalAllocated += item.serialAllocations.length;
              if (item.serialAllocations.length < item.quantity) {
                allSerialsAllocated = false;
              }
            });

            invSerials.forEach(s => {
              if (s.vendorDcrStatus === 'NOT_RECEIVED') {
                anyVendorDcrPending = true;
              }
            });

            let nextStatus = inv.dcrStatus;

            if (totalAllocated === 0) {
              nextStatus = 'PENDING_SERIALS';
            } else if (totalAllocated < totalRequired) {
              nextStatus = 'PARTIALLY_ALLOCATED';
            } else if (allSerialsAllocated) {
              if (anyVendorDcrPending) {
                nextStatus = 'VENDOR_DCR_PENDING';
              } else {
                nextStatus = 'HOLD';
              }
            }

            if (nextStatus !== inv.dcrStatus) {
              await tx.dcrInvoice.update({
                where: { id: inv.id },
                data: { dcrStatus: nextStatus }
              });

              await tx.dcrAuditLog.create({
                data: {
                  entityType: 'INVOICE',
                  entityId: inv.id,
                  action: 'DCR_STATUS_UPDATED',
                  userId: session.userId,
                  metadata: { oldStatus: inv.dcrStatus, newStatus: nextStatus, reason: 'Vendor DCR Received' }
                }
              });
            }
          }
        }
      });
    }

    const enrichedFailed = await Promise.all(
      failed.map(async f => {
        const resolved = await resolveSku(f.sku);
        return {
          ...f,
          skuName: resolved.name,
          skuCode: resolved.code
        };
      })
    );

    const enrichedImported = await Promise.all(
      imported.map(async i => {
        let status = 'Vendor DCR Received';
        if (i.allocatedInvoiceNumber) {
          status = `Vendor DCR received. Allocated Invoice: ${i.allocatedInvoiceNumber}`;
        }
        const resolved = await resolveSku(i.sku);
        return {
          serial: i.serial,
          skuName: resolved.name,
          skuCode: resolved.code,
          status
        };
      })
    );

    return NextResponse.json({
      success: true,
      imported: enrichedImported,
      failed: enrichedFailed
    });
  } catch (error: any) {
    console.error('[Purchase DCR Receive POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process DCR certificates' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { canEditStockAllocation } from '@/lib/post-dispatch-auth';
import {
  classifyAllocation,
  executeStockDeduction,
  validateAllocationsStock,
  checkInvoiceDeductionCompletion,
  AllocationEntry,
  resolveSkuPrecision,
} from '@/lib/stock-deduction-service';
import { validateQuantityPrecision } from '@/lib/uom-precision';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string; lineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEditStockAllocation(session)) return NextResponse.json({ error: 'Forbidden: Stock allocation editing permission required' }, { status: 403 });

  const { invoiceId, lineId } = await params;
  const userId = (session.userId as string) || (session.id as string);
  const userName = (session.name as string) || 'Staff';

  try {
    const body = await request.json();
    const { allocations, isExploded, expectedSkuId, expectedWarehouseId, expectedQty, expectedUom, expectedItemId, expectedItemName, submitForApproval } = body;

    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoiceId },
      select: { invoiceNumber: true, erpSubStatus: true, zohoStatus: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.erpSubStatus === 'Void' || invoice.zohoStatus?.toLowerCase() === 'void') {
      return NextResponse.json({ error: 'Invoice Void — Action Blocked' }, { status: 400 });
    }

    const line = await prisma.postDispatchInvoiceLine.findFirst({
      where: { id: lineId, invoiceId },
    });
    if (!line) return NextResponse.json({ error: 'Invoice line not found' }, { status: 404 });

    const existing = await prisma.stockDeductionAllocation.findUnique({ where: { invoiceLineId: lineId } });
    if (existing?.status === 'DEDUCTED') {
      return NextResponse.json({ error: 'This line has already been deducted and cannot be modified.' }, { status: 409 });
    }
    if (existing?.status === 'SUBMITTED_FOR_APPROVAL') {
      return NextResponse.json({ error: 'This allocation is pending approval and cannot be edited. Withdraw or wait for a decision.' }, { status: 409 });
    }

    // Server-side validation of allocations
    const rawAllocations = Array.isArray(allocations) ? allocations : [];
    const validatedAllocations: AllocationEntry[] = [];

    for (let i = 0; i < rawAllocations.length; i++) {
      const a = rawAllocations[i];
      if (!a || typeof a !== 'object') {
        return NextResponse.json({ error: `Row #${i + 1}: Invalid allocation object.` }, { status: 400 });
      }

      const qty = parseFloat(String(a.qty));
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `Row #${i + 1}: Quantity must be a valid positive number.` }, { status: 400 });
      }

      if (!a.skuId) {
        return NextResponse.json({ error: `Row #${i + 1}: SKU ID is required.` }, { status: 400 });
      }

      // Verify SKU exists in local master (either Sku or ProductVariant)
      let resolvedSkuId: string | null = null;
      let resolvedSkuName: string | null = null;
      let resolvedSkuUnit: string | null = null;

      const skuRecord = await prisma.sku.findUnique({
        where: { id: a.skuId },
        select: { id: true, name: true, unit: true },
      });

      if (skuRecord) {
        resolvedSkuId = skuRecord.id;
        resolvedSkuName = skuRecord.name;
        resolvedSkuUnit = skuRecord.unit;
      } else {
        const variantRecord = await prisma.productVariant.findFirst({
          where: { sku: a.skuId, isActive: true },
          select: {
            sku: true,
            product: {
              select: {
                name: true,
                unitId: true,
              },
            },
          },
        });

        if (variantRecord && variantRecord.sku) {
          resolvedSkuId = variantRecord.sku;
          resolvedSkuName = variantRecord.product.name;
          if (variantRecord.product.unitId) {
            const uom = await prisma.unitOfMeasurement.findUnique({
              where: { id: variantRecord.product.unitId },
              select: { abbreviation: true, name: true },
            });
            resolvedSkuUnit = uom?.abbreviation || uom?.name || null;
          }
        }
      }

      if (!resolvedSkuId || !resolvedSkuName) {
        return NextResponse.json({ error: `Row #${i + 1}: SKU "${a.skuId}" not found in local master.` }, { status: 400 });
      }

      if (!a.warehouseId) {
        return NextResponse.json({ error: `Row #${i + 1}: Warehouse is required.` }, { status: 400 });
      }

      // Check for duplicate SKU + Warehouse combination
      const isDuplicate = validatedAllocations.some(
        existing => existing.skuId === resolvedSkuId && existing.warehouseId === a.warehouseId
      );
      if (isDuplicate) {
        return NextResponse.json(
          { error: `Row #${i + 1}: This SKU is already allocated to this warehouse.` },
          { status: 400 }
        );
      }

      // Verify Warehouse exists and is active
      const whRecord = await prisma.warehouse.findFirst({
        where: { id: a.warehouseId, active: true },
        select: { id: true, name: true },
      });
      if (!whRecord) {
        return NextResponse.json({ error: `Row #${i + 1}: Active warehouse "${a.warehouseId}" not found.` }, { status: 400 });
      }

      // Validate UOM precision for the allocated SKU
      const isDecimal = await resolveSkuPrecision(prisma, resolvedSkuId, resolvedSkuUnit || a.uom);
      const precisionCheck = validateQuantityPrecision(String(a.qty), isDecimal);
      if (!precisionCheck.valid) {
        return NextResponse.json(
          { error: `Row #${i + 1} (${resolvedSkuName}): ${precisionCheck.error}` },
          { status: 400 }
        );
      }

      validatedAllocations.push({
        skuId: resolvedSkuId,
        skuName: resolvedSkuName,
        warehouseId: whRecord.id,
        warehouseName: whRecord.name,
        qty,
        uom: resolvedSkuUnit || a.uom || 'UNIT',
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // QUANTITY VALIDATION AGAINST SOURCE INVOICE LINE
    // For normal (non-exploded) allocations:
    // - Total allocated quantity cannot exceed the source invoice line quantity (1:1 direct numeric relationship).
    // - UOM labels are NOT a validation barrier.
    // For manual / exploded allocations (isExploded = true):
    // - A source item (e.g. "1 Set") explodes into multiple physical inventory items.
    //   Blind numerical summation across child components is not applicable without a BOM rule.
    // - Each individual allocation entry is validated for positive quantity, valid SKU,
    //   valid warehouse, and sufficient stock.
    // ──────────────────────────────────────────────────────────────────────────
    const targetSourceQty = parseFloat(String(expectedQty || line.quantity)) || 0;
    const targetSourceUom = String(expectedUom || 'Units');

    if (!isExploded && validatedAllocations.length > 0) {
      const totalAllocatedQty = validatedAllocations.reduce((sum, a) => sum + a.qty, 0);

      // Quantity check for normal allocation: must not exceed source quantity
      if (totalAllocatedQty > targetSourceQty) {
        return NextResponse.json(
          {
            error: `Total allocated quantity (${totalAllocatedQty}) exceeds source invoice line quantity (${targetSourceQty} ${targetSourceUom}).`,
          },
          { status: 400 }
        );
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // LEVEL 1: PRE-SUBMISSION / SAVE STOCK VALIDATION
    // Insufficient or missing stock is a hard operational blocker (NOT an approval reason).
    // ──────────────────────────────────────────────────────────────────────────
    if (validatedAllocations.length > 0) {
      const stockCheck = await validateAllocationsStock(prisma, validatedAllocations);
      if (!stockCheck.valid) {
        return NextResponse.json({ error: stockCheck.error }, { status: 400 });
      }
    }

    const classifyResult = classifyAllocation({
      expectedSkuId: expectedSkuId || null,
      expectedWarehouseId: expectedWarehouseId || null,
      expectedQty: parseFloat(expectedQty) || 0,
      allocations: validatedAllocations,
      isExploded: Boolean(isExploded),
    });

    const isFirstSave = !existing;

    // ──────────────────────────────────────────────────────────────────────────
    // SUBMISSION FOR APPROVAL (ATOMIC TRANSACTION)
    // When submitForApproval is true AND the allocation requires approval (has deviations),
    // persist allocation, transition status to SUBMITTED_FOR_APPROVAL, create snapshot,
    // and log audit event atomically. Normal AUTO_APPROVED allocations bypass this and
    // proceed directly to Case A immediate atomic deduction.
    // ──────────────────────────────────────────────────────────────────────────
    if (submitForApproval && classifyResult.classification !== 'AUTO_APPROVED') {
      if (validatedAllocations.length === 0) {
        return NextResponse.json({ error: 'Cannot submit empty allocation for approval.' }, { status: 400 });
      }

      const snapshot = {
        allocations: validatedAllocations,
        isExploded: Boolean(isExploded),
        expectedSkuId: expectedSkuId || null,
        expectedWarehouseId: expectedWarehouseId || null,
        expectedQty: parseFloat(expectedQty) || line.quantity,
        expectedUom: expectedUom || null,
        classification: classifyResult.classification,
        deviationReasons: classifyResult.deviationReasons,
        snapshotAt: new Date().toISOString(),
      };

      const result = await prisma.$transaction(async (tx) => {
        const upsertData = {
          invoiceId,
          invoiceLineId: lineId,
          expectedItemId: expectedItemId || line.itemId,
          expectedItemName: expectedItemName || line.itemName,
          expectedSkuId: expectedSkuId || null,
          expectedWarehouseId: expectedWarehouseId || null,
          expectedQty: parseFloat(expectedQty) || line.quantity,
          expectedUom: expectedUom || null,
          allocationData: validatedAllocations as any,
          isExploded: Boolean(isExploded),
          status: 'SUBMITTED_FOR_APPROVAL',
          classification: classifyResult.classification,
          deviationReasons: classifyResult.deviationReasons.length > 0 ? classifyResult.deviationReasons : Prisma.DbNull,
          submittedById: userId,
          submittedByName: userName,
          submittedAt: new Date(),
          submittedSnapshot: snapshot as any,
          rejectedById: null,
          rejectedByName: null,
          rejectedAt: null,
          rejectionRemarks: null,
          updatedAt: new Date(),
        };

        const allocRecord = await tx.stockDeductionAllocation.upsert({
          where: { invoiceLineId: lineId },
          create: { ...upsertData, id: undefined },
          update: upsertData,
        });

        await recordPostDispatchHistory(tx as any, {
          invoiceId,
          workflowType: 'INVENTORY_DEDUCTION',
          eventType: 'STOCK_SUBMITTED_FOR_APPROVAL',
          userId,
          userName,
          submissionId: allocRecord.id,
          metadata: {
            lineId,
            itemName: line.itemName,
            classification: classifyResult.classification,
            deviationReasons: classifyResult.deviationReasons,
            snapshotRef: allocRecord.id,
            allocatedQty: classifyResult.allocatedQty,
            remainingQty: classifyResult.remainingQty,
          },
        });

        return allocRecord;
      });

      return NextResponse.json({
        success: true,
        submitted: true,
        allocation: {
          ...result,
          expectedQty: parseFloat(result.expectedQty.toString()),
        },
        classification: {
          ...classifyResult,
          status: 'SUBMITTED_FOR_APPROVAL',
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE A: EXACT MATCH + SUFFICIENT STOCK → IMMEDIATE ATOMIC DEDUCTION
    // Status immediately becomes DEDUCTED and locked permanently.
    // ──────────────────────────────────────────────────────────────────────────
    if (classifyResult.classification === 'AUTO_APPROVED') {
      const deductionResult = await prisma.$transaction(async (tx) => {
        // 1. Initial upsert to secure the allocation record
        const upsertData = {
          invoiceId,
          invoiceLineId: lineId,
          expectedItemId: expectedItemId || line.itemId,
          expectedItemName: expectedItemName || line.itemName,
          expectedSkuId: expectedSkuId || null,
          expectedWarehouseId: expectedWarehouseId || null,
          expectedQty: parseFloat(expectedQty) || line.quantity,
          expectedUom: expectedUom || null,
          allocationData: validatedAllocations.length > 0 ? (validatedAllocations as any) : null,
          isExploded: Boolean(isExploded),
          status: 'DRAFT',
          classification: 'AUTO_APPROVED',
          deviationReasons: Prisma.DbNull,
          updatedAt: new Date(),
        };

        const allocRecord = await tx.stockDeductionAllocation.upsert({
          where: { invoiceLineId: lineId },
          create: { ...upsertData, id: undefined },
          update: upsertData,
        });

        // 2. Level 2 Authoritative Atomic Deduction with row-level locking (SELECT ... FOR UPDATE)
        const historyIds = await executeStockDeduction(tx, {
          entries: validatedAllocations.map(e => ({
            skuId: e.skuId,
            skuName: e.skuName,
            warehouseId: e.warehouseId,
            warehouseName: e.warehouseName,
            qty: e.qty,
            uom: e.uom,
          })),
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceLineId: lineId,
          allocationId: allocRecord.id,
          userId,
          userName,
        });

        // 3. Mark allocation permanently DEDUCTED
        const updatedAlloc = await tx.stockDeductionAllocation.update({
          where: { id: allocRecord.id },
          data: {
            status: 'DEDUCTED',
            deductedAt: new Date(),
            deductedById: userId,
            deductedByName: userName,
            inventoryHistoryIds: historyIds as any,
          },
        });

        // 4. Record post-dispatch audit history
        await recordPostDispatchHistory(tx as any, {
          invoiceId,
          workflowType: 'INVENTORY_DEDUCTION',
          eventType: 'STOCK_DEDUCTED',
          userId,
          userName,
          submissionId: allocRecord.id,
          metadata: {
            lineId,
            invoiceNumber: invoice.invoiceNumber,
            entries: validatedAllocations,
            inventoryHistoryIds: historyIds,
            method: 'AUTO_DEDUCT_EXACT',
          },
        });

        // 5. Check if entire invoice deduction is complete
        const isComplete = await checkInvoiceDeductionCompletion(tx, invoiceId, userId, userName);

        return {
          allocation: updatedAlloc,
          historyIds,
          isComplete,
        };
      });

      return NextResponse.json({
        success: true,
        autoDeducted: true,
        allocation: {
          ...deductionResult.allocation,
          expectedQty: parseFloat(deductionResult.allocation.expectedQty.toString()),
        },
        classification: {
          ...classifyResult,
          status: 'DEDUCTED',
        },
        historyIds: deductionResult.historyIds,
        isInvoiceComplete: deductionResult.isComplete,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE C: DEVIATION + SUFFICIENT STOCK → SAVED AS DRAFT (APPROVAL_REQUIRED)
    // ──────────────────────────────────────────────────────────────────────────
    const upsertData = {
      invoiceId,
      invoiceLineId: lineId,
      expectedItemId: expectedItemId || line.itemId,
      expectedItemName: expectedItemName || line.itemName,
      expectedSkuId: expectedSkuId || null,
      expectedWarehouseId: expectedWarehouseId || null,
      expectedQty: parseFloat(expectedQty) || line.quantity,
      expectedUom: expectedUom || null,
      allocationData: validatedAllocations.length > 0 ? (validatedAllocations as any) : null,
      isExploded: Boolean(isExploded),
      status: classifyResult.status === 'NOT_ALLOCATED' ? 'DRAFT' : classifyResult.status,
      classification: classifyResult.classification,
      deviationReasons: classifyResult.deviationReasons.length > 0 ? classifyResult.deviationReasons : Prisma.DbNull,
      updatedAt: new Date(),
    };

    const alloc = await prisma.stockDeductionAllocation.upsert({
      where: { invoiceLineId: lineId },
      create: { ...upsertData, id: undefined },
      update: upsertData,
    });

    await recordPostDispatchHistory(prisma, {
      invoiceId,
      workflowType: 'INVENTORY_DEDUCTION',
      eventType: isFirstSave ? 'STOCK_ALLOCATION_DRAFTED' : 'STOCK_ALLOCATION_UPDATED',
      userId,
      userName,
      submissionId: alloc.id,
      metadata: {
        lineId,
        itemName: line.itemName,
        classification: classifyResult.classification,
        allocatedQty: classifyResult.allocatedQty,
        remainingQty: classifyResult.remainingQty,
      },
    });

    return NextResponse.json({
      success: true,
      autoDeducted: false,
      allocation: {
        ...alloc,
        expectedQty: parseFloat(alloc.expectedQty.toString()),
      },
      classification: classifyResult,
    });
  } catch (err: any) {
    console.error('[StockDeduction Save]', err);
    return NextResponse.json({ error: err.message || 'Save failed' }, { status: 400 });
  }
}

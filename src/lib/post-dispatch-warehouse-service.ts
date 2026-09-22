import { prisma } from './db';
import { recordPostDispatchHistory } from './post-dispatch-history';
import { computeAggregateInventoryStatus } from './stock-deduction-service';

export interface ReassignWarehouseInput {
  invoiceId: string;
  targetWarehouseId: string;
  reason: string;
  expectedCurrentWarehouse?: string;
  userId: string;
  userName: string;
}

export interface ReassignWarehouseResult {
  success: boolean;
  noop?: boolean;
  message: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    dispatchWarehouse: string;
    dispatchWarehouseId: string;
    originalWarehouse: string;
    reassignedAt?: Date | null;
    isReassigned: boolean;
  };
  auditRecord?: any;
}

export async function reassignPostDispatchWarehouse(
  input: ReassignWarehouseInput
): Promise<ReassignWarehouseResult> {
  const {
    invoiceId,
    targetWarehouseId,
    reason: rawReason,
    expectedCurrentWarehouse,
    userId,
    userName,
  } = input;

  if (!invoiceId) {
    throw new Error('Invoice ID is required.');
  }

  if (!rawReason || typeof rawReason !== 'string' || !rawReason.trim()) {
    throw new Error('Reason for warehouse reassignment is mandatory.');
  }
  const trimmedReason = rawReason.trim();

  if (!targetWarehouseId || typeof targetWarehouseId !== 'string' || !targetWarehouseId.trim()) {
    throw new Error('Target warehouse ID is required.');
  }

  // 1. Fetch current invoice state
  const invoice = await prisma.postDispatchInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { select: { id: true } },
      workflows: {
        include: {
          submissions: {
            orderBy: { submissionNumber: 'desc' },
            take: 1,
          },
        },
      },
      stockDeductionAllocations: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  // 2. Validate target warehouse
  const targetWarehouse = await prisma.warehouse.findUnique({
    where: { id: targetWarehouseId.trim() },
  });

  if (!targetWarehouse || !targetWarehouse.active || targetWarehouse.isSystemWarehouse) {
    throw new Error('Target warehouse is invalid, inactive, or not allowed.');
  }

  // 3. Concurrency & Same warehouse check
  const detailsJson = invoice.zohoDetailsJson as any;
  const currentWarehouseName =
    invoice.dispatchWarehouse ||
    (detailsJson?.location_name as string) ||
    'Not Assigned';

  // Safe handling if already assigned to the same warehouse
  if (targetWarehouse.name.trim().toLowerCase() === currentWarehouseName.trim().toLowerCase()) {
    const originalWarehouse = invoice.originalWarehouse || currentWarehouseName;
    return {
      success: true,
      noop: true,
      message: 'Invoice is already assigned to this dispatch warehouse.',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dispatchWarehouse: targetWarehouse.name,
        dispatchWarehouseId: targetWarehouse.id,
        originalWarehouse,
        reassignedAt: invoice.reassignedAt,
        isReassigned: Boolean(originalWarehouse && originalWarehouse !== targetWarehouse.name),
      },
    };
  }

  // Prevent silent overwrite if client provided expectedCurrentWarehouse and it is stale
  if (
    expectedCurrentWarehouse &&
    typeof expectedCurrentWarehouse === 'string' &&
    expectedCurrentWarehouse.trim() !== currentWarehouseName
  ) {
    const err: any = new Error(
      `Warehouse was modified concurrently by another user to "${currentWarehouseName}". Please refresh the page.`
    );
    err.code = 'CONCURRENCY_CONFLICT';
    err.currentWarehouse = currentWarehouseName;
    throw err;
  }

  // 4. Resolve original warehouse (must never be altered after first assignment)
  const originalWarehouse = invoice.originalWarehouse || currentWarehouseName;

  // 5. Workflow stage & Inventory deduction status at change
  const receivingWf = invoice.workflows.find((w) => w.workflowType === 'RECEIVING');
  const checkedWf = invoice.workflows.find((w) => w.workflowType === 'CHECKED');
  const computedInventoryStatus = computeAggregateInventoryStatus(
    invoice.lines?.length || 0,
    invoice.stockDeductionAllocations || []
  );

  const workflowStageSummary = `Receiving: ${receivingWf?.status || 'PENDING'}, Checked: ${checkedWf?.status || 'PENDING'}, Inventory: ${computedInventoryStatus}`;
  const now = new Date();

  // Prepare updated zohoDetailsJson
  const updatedZohoDetailsJson = detailsJson && typeof detailsJson === 'object'
    ? { ...detailsJson, location_name: targetWarehouse.name }
    : { location_name: targetWarehouse.name };

  // 6. Atomic database transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update PostDispatchInvoice
    const updatedInvoice = await tx.postDispatchInvoice.update({
      where: { id: invoice.id },
      data: {
        dispatchWarehouse: targetWarehouse.name,
        dispatchWarehouseId: targetWarehouse.id,
        originalWarehouse,
        zohoDetailsJson: updatedZohoDetailsJson,
        reassignedAt: now,
        reassignedById: userId,
        reassignedByName: userName,
      },
    });

    // For un-deducted allocations (NOT_ALLOCATED / DRAFT), update expectedWarehouseId so
    // subsequent drafting or direct deductions point to the new operational warehouse.
    // Already DEDUCTED lines are never altered!
    await tx.stockDeductionAllocation.updateMany({
      where: {
        invoiceId: invoice.id,
        status: { in: ['NOT_ALLOCATED', 'DRAFT'] },
      },
      data: {
        expectedWarehouseId: targetWarehouse.id,
      },
    });

    // Create dedicated immutable audit record
    const auditRecord = await tx.dispatchWarehouseAudit.create({
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        originalWarehouse,
        previousDispatchWarehouse: currentWarehouseName,
        newDispatchWarehouse: targetWarehouse.name,
        changedByUserId: userId,
        changedByUserName: userName,
        changedAt: now,
        reason: trimmedReason,
        workflowStageAtChange: workflowStageSummary,
        inventoryDeductionStatusAtChange: computedInventoryStatus,
      },
    });

    // Dual-log into central PostDispatchHistory for timeline inclusion
    await recordPostDispatchHistory(tx, {
      invoiceId: invoice.id,
      eventType: 'DISPATCH_WAREHOUSE_CHANGED',
      userId,
      userName,
      rejectionReason: trimmedReason,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        original_warehouse: originalWarehouse,
        previous_dispatch_warehouse: currentWarehouseName,
        new_dispatch_warehouse: targetWarehouse.name,
        changed_by_user_id: userId,
        changed_at: now.toISOString(),
        reason: trimmedReason,
        workflow_stage_at_change: workflowStageSummary,
        inventory_deduction_status_at_change: computedInventoryStatus,
        audit_record_id: auditRecord.id,
      },
    });

    return { updatedInvoice, auditRecord };
  });

  const isReassigned = Boolean(originalWarehouse !== targetWarehouse.name);

  return {
    success: true,
    message: `Dispatch warehouse successfully reassigned to ${targetWarehouse.name}.`,
    invoice: {
      id: result.updatedInvoice.id,
      invoiceNumber: result.updatedInvoice.invoiceNumber,
      dispatchWarehouse: result.updatedInvoice.dispatchWarehouse!,
      dispatchWarehouseId: result.updatedInvoice.dispatchWarehouseId!,
      originalWarehouse: result.updatedInvoice.originalWarehouse!,
      reassignedAt: result.updatedInvoice.reassignedAt,
      isReassigned,
    },
    auditRecord: result.auditRecord,
  };
}

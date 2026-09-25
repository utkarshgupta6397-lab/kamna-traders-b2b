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

export interface CanonicalWarehouse {
  id: string; // Immutable canonical identifier
  name: string; // Configured canonical display name
  zohoLocationId: string | null;
  isMapped: boolean;
}

export interface CanonicalWarehouseResolverIndex {
  whById: Map<string, { id: string; name: string; zohoLocationId: string | null }>;
  whByZohoLocationId: Map<string, { id: string; name: string; zohoLocationId: string | null }>;
  whByNameLower: Map<string, { id: string; name: string; zohoLocationId: string | null }>;
}

/**
 * Builds an in-memory indexed lookup of warehouses to resolve any invoice
 * to its canonical warehouse identity in O(1) time without N+1 queries.
 */
export async function getCanonicalWarehouseResolverIndex(
  db: typeof prisma = prisma
): Promise<CanonicalWarehouseResolverIndex> {
  const warehouses = await db.warehouse.findMany({
    where: { isSystemWarehouse: false },
    select: { id: true, name: true, active: true, zohoLocationId: true },
  });

  const whById = new Map<string, { id: string; name: string; zohoLocationId: string | null }>();
  const whByZohoLocationId = new Map<string, { id: string; name: string; zohoLocationId: string | null }>();
  const whByNameLower = new Map<string, { id: string; name: string; zohoLocationId: string | null }>();

  for (const w of warehouses) {
    const item = { id: w.id, name: w.name, zohoLocationId: w.zohoLocationId };
    whById.set(w.id, item);
    if (w.zohoLocationId) {
      whByZohoLocationId.set(w.zohoLocationId, item);
    }
    whByNameLower.set(w.name.trim().toLowerCase(), item);
  }

  return { whById, whByZohoLocationId, whByNameLower };
}

/**
 * Resolves an operational invoice to its canonical warehouse identity.
 *
 * Precedence / Source of Truth:
 * 1. Explicit local warehouse ID (dispatchWarehouseId) -> resolves to mapped Warehouse.
 * 2. Zoho Books Location ID (zohoDetailsJson.location_id) -> resolves via Warehouse.zohoLocationId mapping.
 * 3. Exact configured warehouse name match (dispatchWarehouse or zohoDetailsJson.location_name).
 * 4. Deterministic fallback for unmapped warehouses (preserves their distinct identities without silent merging).
 */
export function resolveCanonicalWarehouse(
  inv: {
    dispatchWarehouse?: string | null;
    dispatchWarehouseId?: string | null;
    zohoDetailsJson?: any;
  },
  resolverIndex: CanonicalWarehouseResolverIndex
): CanonicalWarehouse {
  const { whById, whByZohoLocationId, whByNameLower } = resolverIndex;

  // 1. Resolve by local warehouse ID (dispatchWarehouseId)
  if (inv.dispatchWarehouseId && whById.has(inv.dispatchWarehouseId)) {
    const wh = whById.get(inv.dispatchWarehouseId)!;
    return {
      id: wh.id,
      name: wh.name,
      zohoLocationId: wh.zohoLocationId,
      isMapped: Boolean(wh.zohoLocationId),
    };
  }

  // 2. Resolve by Zoho Location ID (zohoDetailsJson.location_id)
  const locId = inv.zohoDetailsJson?.location_id
    ? String(inv.zohoDetailsJson.location_id).trim()
    : null;
  if (locId && whByZohoLocationId.has(locId)) {
    const wh = whByZohoLocationId.get(locId)!;
    return {
      id: wh.id,
      name: wh.name,
      zohoLocationId: wh.zohoLocationId,
      isMapped: true,
    };
  }

  // 3. Resolve by exact configured warehouse name (dispatchWarehouse or zohoDetailsJson.location_name)
  const dispatchName = inv.dispatchWarehouse?.trim();
  if (dispatchName && whByNameLower.has(dispatchName.toLowerCase())) {
    const wh = whByNameLower.get(dispatchName.toLowerCase())!;
    return {
      id: wh.id,
      name: wh.name,
      zohoLocationId: wh.zohoLocationId,
      isMapped: Boolean(wh.zohoLocationId),
    };
  }

  const locName = inv.zohoDetailsJson?.location_name
    ? String(inv.zohoDetailsJson.location_name).trim()
    : null;
  if (locName && whByNameLower.has(locName.toLowerCase())) {
    const wh = whByNameLower.get(locName.toLowerCase())!;
    return {
      id: wh.id,
      name: wh.name,
      zohoLocationId: wh.zohoLocationId,
      isMapped: Boolean(wh.zohoLocationId),
    };
  }

  // 4. Deterministic fallback for unmapped warehouses (Step 6)
  if (inv.dispatchWarehouseId) {
    return {
      id: inv.dispatchWarehouseId,
      name: dispatchName || locName || inv.dispatchWarehouseId,
      zohoLocationId: null,
      isMapped: false,
    };
  }

  if (locId) {
    return {
      id: `zoho:${locId}`,
      name: locName || dispatchName || `Zoho Location ${locId}`,
      zohoLocationId: locId,
      isMapped: false,
    };
  }

  const rawName = dispatchName || locName;
  if (rawName) {
    return {
      id: `raw:${rawName.toLowerCase()}`,
      name: rawName,
      zohoLocationId: null,
      isMapped: false,
    };
  }

  return {
    id: 'unassigned',
    name: 'Unassigned',
    zohoLocationId: null,
    isMapped: false,
  };
}

/**
 * Canonical helper returning only warehouses originating from / configured from Zoho Books
 * for the Post-Dispatch workflow (active, non-system, and mapped via zohoLocationId).
 */
export async function getEligibleZohoDispatchWarehouses() {
  return prisma.warehouse.findMany({
    where: {
      active: true,
      isSystemWarehouse: false,
      zohoLocationId: { not: null },
    },
    select: {
      id: true,
      name: true,
      zohoLocationId: true,
    },
    orderBy: { name: 'asc' },
  });
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

  if (
    !targetWarehouse ||
    !targetWarehouse.active ||
    targetWarehouse.isSystemWarehouse ||
    !targetWarehouse.zohoLocationId
  ) {
    throw new Error('Target warehouse is invalid, inactive, or not configured from Zoho Books.');
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
    ? {
        ...detailsJson,
        location_name: targetWarehouse.name,
        location_id: targetWarehouse.zohoLocationId,
      }
    : {
        location_name: targetWarehouse.name,
        location_id: targetWarehouse.zohoLocationId,
      };

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

import { Prisma } from '@prisma/client';
import { recordPostDispatchHistory } from './post-dispatch-history';
import { checkAndArchiveInvoice } from './post-dispatch-sync';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AllocationStatus =
  | 'NOT_ALLOCATED'
  | 'DRAFT'
  | 'PARTIALLY_ALLOCATED'
  | 'SUBMITTED_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REWORK_REQUIRED'
  | 'DEDUCTED';

export type AllocationClassification =
  | 'NOT_ALLOCATED'
  | 'AUTO_APPROVED'
  | 'APPROVAL_REQUIRED'
  | 'PARTIAL'
  | 'INVALID';

export interface AllocationEntry {
  skuId: string;
  skuName: string;
  skuCode?: string;
  warehouseId: string;
  warehouseName: string;
  qty: number; // stored as JS number, DB uses Decimal
  uom: string;
}

export interface ClassifyInput {
  expectedSkuId: string | null;
  expectedWarehouseId: string | null;
  expectedQty: number;
  allocations: AllocationEntry[];
  isExploded?: boolean;
  availableStock?: number | Prisma.Decimal | null;
}

export interface ClassifyResult {
  classification: AllocationClassification;
  deviationReasons: string[];
  status: AllocationStatus;
  allocatedQty: number;
  remainingQty: number;
}

// ─── UOM Normalization & Compatibility ────────────────────────────────────────

const UOM_CANONICAL_MAP: Record<string, string> = {
  nos: 'NOS',
  numbers: 'NOS',
  number: 'NOS',
  pcs: 'PCS',
  pieces: 'PCS',
  piece: 'PCS',
  unit: 'UNIT',
  units: 'UNIT',
  mtr: 'MTR',
  meter: 'MTR',
  meters: 'MTR',
  kgs: 'KGS',
  kg: 'KGS',
  kilograms: 'KGS',
  pair: 'PAIR',
  pairs: 'PAIR',
  set: 'SET',
  sets: 'SET',
};

// Groups of interchangeable/equivalent counting units
const EQUIVALENT_UOM_GROUPS = [
  new Set(['NOS', 'PCS', 'UNIT']),
  new Set(['MTR']),
  new Set(['KGS']),
  new Set(['PAIR']),
  new Set(['SET']),
];

export function normalizeUom(uom: string | null | undefined): string {
  if (!uom) return 'UNIT';
  const clean = uom.trim().toLowerCase();
  return UOM_CANONICAL_MAP[clean] || clean.toUpperCase();
}

/**
 * Checks if two UOMs are compatible:
 * - Exact or normalized match (e.g. 'Nos' and 'NOS', 'Pcs' and 'PCS')
 * - Equivalent standard discrete count units ('NOS', 'PCS', 'UNIT')
 * - Otherwise incompatible (e.g. 'SET' vs 'MTR', 'SET' vs 'NOS')
 */
export function areUomsCompatible(uomA: string | null | undefined, uomB: string | null | undefined): boolean {
  const normA = normalizeUom(uomA);
  const normB = normalizeUom(uomB);
  if (normA === normB) return true;

  for (const group of EQUIVALENT_UOM_GROUPS) {
    if (group.has(normA) && group.has(normB)) {
      return true;
    }
  }

  return false;
}

// ─── Aggregate Inventory Status Helper ────────────────────────────────────────

export type AggregateInventoryStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

/**
 * Computes aggregate invoice-level inventory status strictly from physical deduction state.
 *
 * Rules:
 * 1. PENDING: 0 lines deducted.
 * 2. IN_PROGRESS: At least 1 line deducted, and at least 1 other line still incomplete/pending/approved.
 * 3. COMPLETED: ALL applicable invoice lines are successfully DEDUCTED (linesCount > 0).
 */
export function computeAggregateInventoryStatus(
  linesCount: number,
  allocations: Array<{ status: string }>
): AggregateInventoryStatus {
  if (linesCount <= 0) return 'PENDING';

  const deductedCount = (allocations || []).filter((a) => a.status === 'DEDUCTED').length;

  if (deductedCount === linesCount) {
    return 'COMPLETED';
  }

  if (deductedCount > 0) {
    return 'IN_PROGRESS';
  }

  return 'PENDING';
}

// ─── Classification Engine (server-authoritative) ─────────────────────────────
export function classifyAllocation(input: ClassifyInput): ClassifyResult {
  const { expectedSkuId, expectedWarehouseId, expectedQty, allocations, isExploded } = input;
  const deviationReasons: string[] = [];

  // No allocations at all
  if (!allocations || allocations.length === 0) {
    return {
      classification: 'NOT_ALLOCATED',
      deviationReasons: [],
      status: 'NOT_ALLOCATED',
      allocatedQty: 0,
      remainingQty: expectedQty,
    };
  }

  // Validate all allocations have required fields
  for (const a of allocations) {
    if (!a.skuId || !a.warehouseId || a.qty <= 0) {
      deviationReasons.push('INVALID_ALLOCATION_ENTRY');
      return {
        classification: 'INVALID',
        deviationReasons,
        status: 'DRAFT',
        allocatedQty: 0,
        remainingQty: expectedQty,
      };
    }
  }

  // Calculate total allocated qty
  const allocatedQty = allocations.reduce((sum, a) => sum + a.qty, 0);
  const remainingQty = Math.max(0, expectedQty - allocatedQty);

  // EXPLOSION always requires approval
  if (isExploded) {
    deviationReasons.push('ITEM_EXPLODED');
  } else {
    // Quantity > expected requires approval
    if (allocatedQty > expectedQty) {
      deviationReasons.push('QUANTITY_EXCEEDS_EXPECTED');
    }

    // SKU deviation check (different SKU than expected, or line has no expected SKU mapped)
    const hasSkuDeviation = !expectedSkuId || allocations.some(a => a.skuId !== expectedSkuId);
    if (hasSkuDeviation) {
      deviationReasons.push('SKU_DEVIATION');
    }
  }

  // Warehouse deviation check
  const distinctWarehouseIds = new Set(allocations.map(a => a.warehouseId).filter(Boolean));
  const hasMultiWarehouse = distinctWarehouseIds.size > 1;
  const hasWarehouseDeviation = !expectedWarehouseId || allocations.some(a => a.warehouseId !== expectedWarehouseId);
  if (hasMultiWarehouse) {
    deviationReasons.push('MULTI_WAREHOUSE_ALLOCATION');
  } else if (hasWarehouseDeviation) {
    deviationReasons.push('WAREHOUSE_DEVIATION');
  }

  // Any deviation → APPROVAL_REQUIRED
  if (deviationReasons.length > 0) {
    return {
      classification: 'APPROVAL_REQUIRED',
      deviationReasons,
      status: 'DRAFT',
      allocatedQty,
      remainingQty,
    };
  }

  // Partial allocation (no deviations yet, just incomplete)
  if (remainingQty > 0) {
    return {
      classification: 'PARTIAL',
      deviationReasons: [],
      status: 'PARTIALLY_ALLOCATED',
      allocatedQty,
      remainingQty,
    };
  }

  // Perfect exact match → AUTO_APPROVED
  return {
    classification: 'AUTO_APPROVED',
    deviationReasons: [],
    status: 'DRAFT', // draft until deduction executed atomically
    allocatedQty,
    remainingQty: 0,
  };
}

// ─── Stock Pre-Check Validation (Level 1) ──────────────────────────────────────

export interface StockValidationDetail {
  skuId: string;
  skuName: string;
  warehouseId: string;
  warehouseName: string;
  requiredQty: number;
  availableQty: number | null;
  uom: string;
  recordExists: boolean;
}

export interface StockValidationResult {
  valid: boolean;
  error?: string;
  details: StockValidationDetail[];
}

/**
 * Validates available stock for an array of allocation entries without locking.
 * Aggregates multiple allocations pointing to the same SKU and warehouse.
 * If any inventory record is missing or available stock is less than required,
 * returns valid: false with a user-friendly error message.
 */
export async function validateAllocationsStock(
  client: Prisma.TransactionClient | { warehouseInventory: { findUnique: Function } },
  allocations: AllocationEntry[]
): Promise<StockValidationResult> {
  if (!allocations || allocations.length === 0) {
    return { valid: true, details: [] };
  }

  // Group allocations by warehouseId + skuId
  const aggregatedMap = new Map<string, {
    skuId: string;
    skuName: string;
    warehouseId: string;
    warehouseName: string;
    requiredQty: Prisma.Decimal;
    uom: string;
  }>();

  for (const entry of allocations) {
    const key = `${entry.warehouseId}___${entry.skuId}`;
    const existing = aggregatedMap.get(key);
    const entryQty = new Prisma.Decimal(entry.qty.toString());
    if (existing) {
      existing.requiredQty = existing.requiredQty.plus(entryQty);
    } else {
      aggregatedMap.set(key, {
        skuId: entry.skuId,
        skuName: entry.skuName || entry.skuId,
        warehouseId: entry.warehouseId,
        warehouseName: entry.warehouseName || entry.warehouseId,
        requiredQty: entryQty,
        uom: entry.uom || 'UNIT',
      });
    }
  }

  const details: StockValidationDetail[] = [];
  let firstError: string | undefined;

  for (const item of aggregatedMap.values()) {
    const inv = await (client as any).warehouseInventory.findUnique({
      where: {
        warehouseId_skuId: {
          warehouseId: item.warehouseId,
          skuId: item.skuId,
        },
      },
      select: { qty: true },
    });

    if (!inv) {
      details.push({
        skuId: item.skuId,
        skuName: item.skuName,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouseName,
        requiredQty: item.requiredQty.toNumber(),
        availableQty: null,
        uom: item.uom,
        recordExists: false,
      });
      if (!firstError) {
        firstError = `Stock unavailable: No inventory record exists for "${item.skuName}" at ${item.warehouseName}. Please choose another warehouse or allocation.`;
      }
      continue;
    }

    const availableQty = new Prisma.Decimal(inv.qty.toString());
    if (availableQty.lessThan(item.requiredQty)) {
      details.push({
        skuId: item.skuId,
        skuName: item.skuName,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouseName,
        requiredQty: item.requiredQty.toNumber(),
        availableQty: availableQty.toNumber(),
        uom: item.uom,
        recordExists: true,
      });
      if (!firstError) {
        firstError = `Insufficient stock for "${item.skuName}" at ${item.warehouseName}. Available: ${availableQty.toString()} ${item.uom}, Required: ${item.requiredQty.toString()} ${item.uom}. Stock deduction cannot be completed because sufficient stock is not available.`;
      }
    } else {
      details.push({
        skuId: item.skuId,
        skuName: item.skuName,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouseName,
        requiredQty: item.requiredQty.toNumber(),
        availableQty: availableQty.toNumber(),
        uom: item.uom,
        recordExists: true,
      });
    }
  }

  if (firstError) {
    return { valid: false, error: firstError, details };
  }

  return { valid: true, details };
}

// ─── Invoice Completion Check ─────────────────────────────────────────────────

export async function checkInvoiceDeductionCompletion(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  userId: string,
  userName: string
): Promise<boolean> {
  // Get all invoice lines
  const lines = await tx.postDispatchInvoiceLine.findMany({
    where: { invoiceId },
    select: { id: true },
  });

  if (lines.length === 0) return false;

  // Get all allocations for this invoice
  const allocations = await tx.stockDeductionAllocation.findMany({
    where: { invoiceId },
    select: { invoiceLineId: true, status: true },
  });

  const deductedLineIds = new Set(
    allocations.filter(a => a.status === 'DEDUCTED').map(a => a.invoiceLineId)
  );

  const allDeducted = lines.every(l => deductedLineIds.has(l.id));

  if (allDeducted) {
    // Mark INVENTORY_DEDUCTION workflow as COMPLETED
    await tx.postDispatchWorkflow.updateMany({
      where: { invoiceId, workflowType: 'INVENTORY_DEDUCTION' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await recordPostDispatchHistory(tx as any, {
      invoiceId,
      workflowType: 'INVENTORY_DEDUCTION',
      eventType: 'INVENTORY_DEDUCTION_COMPLETED',
      userId,
      userName,
      metadata: { linesDeducted: lines.length },
    });

    await checkAndArchiveInvoice(invoiceId, tx);

    return true;
  }

  return false;
}

// ─── Atomic Stock Deduction ───────────────────────────────────────────────────

export interface DeductEntry {
  skuId: string;
  skuName: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
  uom: string;
}

export interface DeductParams {
  entries: DeductEntry[];
  invoiceId: string;
  invoiceNumber: string;
  invoiceLineId: string;
  allocationId: string;
  userId: string;
  userName: string;
}

export async function executeStockDeduction(
  tx: Prisma.TransactionClient,
  params: DeductParams
): Promise<string[]> {
  const { entries, invoiceId, invoiceNumber, invoiceLineId, allocationId, userId, userName } = params;
  const historyIds: string[] = [];

  for (const entry of entries) {
    // Lock the WarehouseInventory row to prevent concurrent deductions
    const locked = await tx.$queryRaw<Array<{ id: string; qty: string }>>(
      Prisma.sql`
        SELECT id, qty FROM "WarehouseInventory"
        WHERE "warehouseId" = ${entry.warehouseId} AND "skuId" = ${entry.skuId}
        FOR UPDATE
      `
    );

    let resolvedSkuName = entry.skuName;
    if (!resolvedSkuName || !resolvedSkuName.trim()) {
      const s = await tx.sku.findUnique({ where: { id: entry.skuId }, select: { name: true } });
      if (s?.name) {
        resolvedSkuName = s.name;
      } else {
        const v = await tx.productVariant.findFirst({
          where: { sku: entry.skuId },
          include: { product: { select: { name: true } } },
        });
        resolvedSkuName = v?.product?.name || v?.variantName || entry.skuId;
      }
    }

    let resolvedWarehouseName = entry.warehouseName;
    if (!resolvedWarehouseName || !resolvedWarehouseName.trim()) {
      const wh = await tx.warehouse.findUnique({ where: { id: entry.warehouseId }, select: { name: true } });
      resolvedWarehouseName = wh?.name || entry.warehouseId;
    }

    if (!locked || locked.length === 0) {
      throw new Error(
        `No inventory record found for SKU "${resolvedSkuName}" in warehouse "${resolvedWarehouseName}". Cannot deduct.`
      );
    }

    const currentQty = new Prisma.Decimal(locked[0].qty);
    const deductQty = new Prisma.Decimal(entry.qty);

    if (deductQty.lessThanOrEqualTo(0)) {
      throw new Error(`Deduction quantity must be greater than zero.`);
    }

    if (currentQty.lessThan(deductQty)) {
      throw new Error(
        `Insufficient stock for "${resolvedSkuName}" in ${resolvedWarehouseName}. ` +
        `Available: ${currentQty.toString()} ${entry.uom || 'units'}, Requested: ${deductQty.toString()} ${entry.uom || 'units'}.`
      );
    }

    const afterQty = currentQty.minus(deductQty);
    if (afterQty.lessThan(0)) {
      throw new Error(`Negative stock is not permitted.`);
    }

    // Decrement stock
    await tx.warehouseInventory.update({
      where: { warehouseId_skuId: { warehouseId: entry.warehouseId, skuId: entry.skuId } },
      data: {
        qty: afterQty,
        isOos: afterQty.lessThanOrEqualTo(0),
        updatedAt: new Date(),
      },
    });

    // Write InventoryHistory
    const historyEntry = await tx.inventoryHistory.create({
      data: {
        warehouseId: entry.warehouseId,
        skuId: entry.skuId,
        productName: resolvedSkuName,
        beforeQty: currentQty,
        afterQty,
        qtyChange: deductQty.negated(),
        remarks: `Post-Dispatch Stock Deduction | Invoice: ${invoiceNumber}`,
        referenceType: 'POST_DISPATCH_DEDUCTION',
        referenceId: invoiceId,
        createdBy: userId,
      },
    });

    historyIds.push(historyEntry.id);
  }

  return historyIds;
}

// ─── Warehouse Resolver ───────────────────────────────────────────────────────

export async function resolveZohoWarehouse(
  tx: Prisma.TransactionClient | { warehouse: { findFirst: Function } },
  zohoLocationId: string | null | undefined
): Promise<{ id: string; name: string; zohoLocationId: string | null } | null> {
  if (!zohoLocationId) return null;
  const wh = await (tx as any).warehouse.findFirst({
    where: { zohoLocationId, active: true },
    select: { id: true, name: true, zohoLocationId: true },
  });
  return wh || null;
}

// ─── SKU Resolver ─────────────────────────────────────────────────────────────

export async function resolveZohoSku(
  tx: any,
  zohoItemId: string | null | undefined
): Promise<{ id: string; name: string; unit: string | null } | null> {
  if (!zohoItemId) return null;

  // Try Sku table first
  const sku = await tx.sku.findFirst({
    where: { zohoBookItemId: zohoItemId },
    select: { id: true, name: true, unit: true },
  });
  if (sku) return sku;

  // Try ProductVariant
  const variant = await tx.productVariant.findFirst({
    where: { zohoBookItemId: zohoItemId, isActive: true },
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

  if (variant && variant.sku) {
    // Check if a legacy Sku record exists with this ID
    const variantSku = await tx.sku.findFirst({
      where: { id: variant.sku },
      select: { id: true, name: true, unit: true },
    });
    if (variantSku) return variantSku;

    // Resolve UOM from UnitOfMeasurement table
    let unit: string | null = null;
    if (variant.product.unitId) {
      const uom = await tx.unitOfMeasurement.findUnique({
        where: { id: variant.product.unitId },
        select: { abbreviation: true, name: true },
      });
      unit = uom?.abbreviation || uom?.name || null;
    }

    return {
      id: variant.sku,
      name: variant.product.name,
      unit,
    };
  }

  return null;
}

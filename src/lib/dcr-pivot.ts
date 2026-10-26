/**
 * DCR Item & Invoice Pivot Data Layer & Utilities
 * 
 * Provides shared calculation, normalization, grouping, sorting, 
 * CSV export, and quantity reconciliation logic for Customer DCR Lookup.
 */

export interface DcrItemMetrics {
  billedQty: number;
  issuedQty: number;
  serialEntryPending: number;
  vendorDcrPending: number;
  onHold: number;
  readyToIssue: number;
}

export interface RawDcrItem {
  id?: string;
  itemId?: string | null;
  sku?: string | null;
  itemName: string;
  quantity: number;
  selectedForDCR?: boolean;
  metrics?: DcrItemMetrics;
  serialAllocations?: Array<{
    id?: string;
    serialNumber?: string;
    serial?: {
      status?: string | null;
      vendorDcrStatus?: string | null;
    } | null;
  }> | null;
}

export interface RawDcrInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  items?: RawDcrItem[];
  [key: string]: any;
}

export interface NormalizedPivotRow {
  productKey: string;
  itemDisplayName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  billedQty: number;
  issuedQty: number;
  serialEntryPending: number;
  vendorDcrPending: number;
  onHold: number;
  readyToIssue: number;
}

export type PivotOrientation = 'ITEM_FIRST' | 'INVOICE_FIRST';

export interface PivotTotals {
  billedQty: number;
  issuedQty: number;
  serialEntryPending: number;
  vendorDcrPending: number;
  onHold: number;
  readyToIssue: number;
}

/**
 * Calculates authoritative DCR metrics for an invoice item based on
 * its quantity, selectedForDCR flag, and serial allocations.
 */
export function calculateItemDcrMetrics(item: {
  quantity: number;
  selectedForDCR?: boolean;
  serialAllocations?: Array<{
    serial?: {
      status?: string | null;
      vendorDcrStatus?: string | null;
    } | null;
  }> | null;
}): DcrItemMetrics {
  if (!item.selectedForDCR) {
    return {
      billedQty: 0,
      issuedQty: 0,
      serialEntryPending: 0,
      vendorDcrPending: 0,
      onHold: 0,
      readyToIssue: 0,
    };
  }

  const billedQty = Math.max(0, Number(item.quantity) || 0);
  const allocations = item.serialAllocations || [];
  const serialEntryPending = billedQty > allocations.length ? billedQty - allocations.length : 0;

  let vendorDcrPending = 0;
  let issuedQty = 0;
  let readyToIssue = 0;
  let onHold = 0;

  for (const alloc of allocations) {
    const s = alloc?.serial;
    if (!s) continue;

    if (s.vendorDcrStatus !== 'RECEIVED') {
      vendorDcrPending++;
    } else if (s.status === 'ISSUED') {
      issuedQty++;
    } else if (s.status === 'READY_TO_ISSUE') {
      readyToIssue++;
    } else {
      // Any other status (HOLD, ALLOCATED, RETURNED) when vendor DCR is received is considered On Hold.
      onHold++;
    }
  }

  return {
    billedQty,
    issuedQty,
    serialEntryPending,
    vendorDcrPending,
    onHold,
    readyToIssue,
  };
}

/**
 * Resolves a stable product identity key for grouping.
 * Prioritizes itemId (Zoho Item ID), then SKU, then itemName.
 */
export function getProductIdentityKey(item: {
  itemId?: string | null;
  sku?: string | null;
  itemName: string;
}): string {
  if (item.itemId && String(item.itemId).trim()) {
    return `item_${String(item.itemId).trim()}`;
  }
  if (item.sku && String(item.sku).trim()) {
    return `sku_${String(item.sku).trim()}`;
  }
  return `name_${String(item.itemName || '').trim()}`;
}

/**
 * Formats a clear display name for the item, distinguishing variant SKUs when present.
 */
export function getItemDisplayName(item: {
  itemName: string;
  sku?: string | null;
}): string {
  const name = (item.itemName || '').trim() || 'Unknown Item';
  const sku = (item.sku || '').trim();
  if (sku && sku !== name && !name.includes(sku)) {
    return `${name} (${sku})`;
  }
  return name;
}

/**
 * Normalizes invoices and their line items into a flat list of Item + Invoice rows.
 * If the same product appears multiple times within a single invoice,
 * those lines are aggregated into a single row for that (Item, Invoice) pair.
 */
export function buildNormalizedPivotRows(invoices: RawDcrInvoice[]): NormalizedPivotRow[] {
  const rowMap = new Map<string, NormalizedPivotRow>();

  for (const inv of invoices) {
    if (!inv || !inv.items || !Array.isArray(inv.items)) continue;

    const invoiceDateStr = inv.invoiceDate instanceof Date 
      ? inv.invoiceDate.toISOString() 
      : String(inv.invoiceDate || '');

    for (const item of inv.items) {
      // Must be selected for DCR (or default to true if already filtered)
      if (item.selectedForDCR === false) continue;

      const metrics = item.metrics || calculateItemDcrMetrics(item);
      const productKey = getProductIdentityKey(item);
      const compositeKey = `${inv.id}__${productKey}`;
      const itemDisplayName = getItemDisplayName(item);

      const existing = rowMap.get(compositeKey);
      if (existing) {
        existing.billedQty += metrics.billedQty;
        existing.issuedQty += metrics.issuedQty;
        existing.serialEntryPending += metrics.serialEntryPending;
        existing.vendorDcrPending += metrics.vendorDcrPending;
        existing.onHold += metrics.onHold;
        existing.readyToIssue += metrics.readyToIssue;
      } else {
        rowMap.set(compositeKey, {
          productKey,
          itemDisplayName,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: invoiceDateStr,
          billedQty: metrics.billedQty,
          issuedQty: metrics.issuedQty,
          serialEntryPending: metrics.serialEntryPending,
          vendorDcrPending: metrics.vendorDcrPending,
          onHold: metrics.onHold,
          readyToIssue: metrics.readyToIssue,
        });
      }
    }
  }

  return Array.from(rowMap.values());
}

/**
 * Sorts normalized rows according to the selected orientation.
 * 
 * View A (ITEM_FIRST):
 *   Primary: Item display name (A-Z)
 *   Secondary: Invoice number (natural order)
 * 
 * View B (INVOICE_FIRST):
 *   Primary: Invoice number (natural order)
 *   Secondary: Item display name (A-Z)
 */
export function sortPivotRows(
  rows: NormalizedPivotRow[],
  orientation: PivotOrientation
): NormalizedPivotRow[] {
  const cloned = [...rows];

  if (orientation === 'ITEM_FIRST') {
    cloned.sort((a, b) => {
      const cmpItem = a.itemDisplayName.localeCompare(b.itemDisplayName, undefined, { sensitivity: 'base' });
      if (cmpItem !== 0) return cmpItem;
      const cmpKey = a.productKey.localeCompare(b.productKey);
      if (cmpKey !== 0) return cmpKey;
      return a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
  } else {
    cloned.sort((a, b) => {
      const cmpInv = a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true, sensitivity: 'base' });
      if (cmpInv !== 0) return cmpInv;
      const cmpItem = a.itemDisplayName.localeCompare(b.itemDisplayName, undefined, { sensitivity: 'base' });
      if (cmpItem !== 0) return cmpItem;
      return a.productKey.localeCompare(b.productKey);
    });
  }

  return cloned;
}

/**
 * Calculates grand totals across all rows.
 */
export function calculatePivotTotals(rows: NormalizedPivotRow[]): PivotTotals {
  return rows.reduce(
    (acc, row) => ({
      billedQty: acc.billedQty + row.billedQty,
      issuedQty: acc.issuedQty + row.issuedQty,
      serialEntryPending: acc.serialEntryPending + row.serialEntryPending,
      vendorDcrPending: acc.vendorDcrPending + row.vendorDcrPending,
      onHold: acc.onHold + row.onHold,
      readyToIssue: acc.readyToIssue + row.readyToIssue,
    }),
    {
      billedQty: 0,
      issuedQty: 0,
      serialEntryPending: 0,
      vendorDcrPending: 0,
      onHold: 0,
      readyToIssue: 0,
    }
  );
}

/**
 * Escapes a single cell value for CSV output.
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates RFC 4180 compliant CSV string with UTF-8 BOM.
 */
export function generatePivotCsv(
  rows: NormalizedPivotRow[],
  orientation: PivotOrientation,
  totals: PivotTotals
): string {
  const lines: string[] = [];

  if (orientation === 'ITEM_FIRST') {
    lines.push([
      'Item',
      'Invoice No',
      'Billed Qty',
      'Issued Qty',
      'Serial Entry Pending',
      'Vendor DCR Pending',
      'On Hold',
      'Ready to Issue',
    ].map(escapeCsvCell).join(','));

    for (const row of rows) {
      lines.push([
        row.itemDisplayName,
        row.invoiceNumber,
        row.billedQty,
        row.issuedQty,
        row.serialEntryPending,
        row.vendorDcrPending,
        row.onHold,
        row.readyToIssue,
      ].map(escapeCsvCell).join(','));
    }

    lines.push([
      'Grand Total',
      '',
      totals.billedQty,
      totals.issuedQty,
      totals.serialEntryPending,
      totals.vendorDcrPending,
      totals.onHold,
      totals.readyToIssue,
    ].map(escapeCsvCell).join(','));
  } else {
    lines.push([
      'Invoice No',
      'Item',
      'Billed Qty',
      'Issued Qty',
      'Serial Entry Pending',
      'Vendor DCR Pending',
      'On Hold',
      'Ready to Issue',
    ].map(escapeCsvCell).join(','));

    for (const row of rows) {
      lines.push([
        row.invoiceNumber,
        row.itemDisplayName,
        row.billedQty,
        row.issuedQty,
        row.serialEntryPending,
        row.vendorDcrPending,
        row.onHold,
        row.readyToIssue,
      ].map(escapeCsvCell).join(','));
    }

    lines.push([
      'Grand Total',
      '',
      totals.billedQty,
      totals.issuedQty,
      totals.serialEntryPending,
      totals.vendorDcrPending,
      totals.onHold,
      totals.readyToIssue,
    ].map(escapeCsvCell).join(','));
  }

  // Prepend UTF-8 BOM for Excel compatibility
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Sanitizes customer name or string for safe filename generation.
 */
export function sanitizeFilenamePart(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return sanitized.slice(0, 40) || 'customer';
}

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
  date?: string | Date;
  billDate?: string | Date;
  items?: RawDcrItem[];
  [key: string]: any;
}

export interface NormalizedPivotRow {
  productKey: string;
  itemDisplayName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  billDate: string;
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
 * Parses and returns a numeric timestamp for a Bill Date.
 * Missing, null, or invalid dates return -Infinity so they are sorted last.
 */
export function getBillDateTimestamp(dateVal: string | Date | null | undefined): number {
  if (!dateVal) return -Infinity;
  const d = new Date(dateVal);
  const time = d.getTime();
  return isNaN(time) ? -Infinity : time;
}

/**
 * Formats invoice bill date consistently with ERP conventions (e.g. "01 Jul 26").
 * Returns '-' for missing or invalid dates.
 */
export function formatBillDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
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

    // Authoritative bill date resolution from invoice data source
    const rawBillDate = inv.invoiceDate ?? (inv as any).date ?? (inv as any).billDate;
    const billDateStr = rawBillDate instanceof Date 
      ? rawBillDate.toISOString() 
      : (rawBillDate ? String(rawBillDate) : '');

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
          invoiceDate: billDateStr,
          billDate: billDateStr,
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
 * MANDATORY DEFAULT SORT:
 * Primary Sort: Bill Date descending (newest bill date first; undated rows last).
 * 
 * View A (ITEM_FIRST):
 *   Primary: Bill Date descending (newest first)
 *   Secondary: Item display name (A-Z)
 *   Tertiary: Product key (stable identifier)
 *   Tie-breaker: Invoice number (natural order) / invoiceId
 * 
 * View B (INVOICE_FIRST):
 *   Primary: Bill Date descending (newest first)
 *   Secondary: Invoice number (natural order) / invoiceId
 *   Tertiary: Item display name (A-Z)
 *   Tie-breaker: Product key
 */
export function sortPivotRows(
  rows: NormalizedPivotRow[],
  orientation: PivotOrientation
): NormalizedPivotRow[] {
  const cloned = [...rows];

  if (orientation === 'ITEM_FIRST') {
    cloned.sort((a, b) => {
      // 1. Primary: Bill Date descending (newest first, undated last)
      const timeA = getBillDateTimestamp(a.billDate || a.invoiceDate);
      const timeB = getBillDateTimestamp(b.billDate || b.invoiceDate);
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      // 2. Secondary: Item display name (A-Z)
      const cmpItem = a.itemDisplayName.localeCompare(b.itemDisplayName, undefined, { sensitivity: 'base' });
      if (cmpItem !== 0) return cmpItem;

      // 3. Stable product key
      const cmpKey = a.productKey.localeCompare(b.productKey);
      if (cmpKey !== 0) return cmpKey;

      // 4. Final tie-breaker: Invoice number / invoiceId
      const cmpInv = a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true, sensitivity: 'base' });
      if (cmpInv !== 0) return cmpInv;

      return a.invoiceId.localeCompare(b.invoiceId);
    });
  } else {
    // INVOICE_FIRST
    cloned.sort((a, b) => {
      // 1. Primary: Bill Date descending (newest first, undated last)
      const timeA = getBillDateTimestamp(a.billDate || a.invoiceDate);
      const timeB = getBillDateTimestamp(b.billDate || b.invoiceDate);
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      // 2. Secondary: Invoice number (natural order)
      const cmpInv = a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true, sensitivity: 'base' });
      if (cmpInv !== 0) return cmpInv;

      const cmpInvId = a.invoiceId.localeCompare(b.invoiceId);
      if (cmpInvId !== 0) return cmpInvId;

      // 3. Tertiary: Item display name (A-Z)
      const cmpItem = a.itemDisplayName.localeCompare(b.itemDisplayName, undefined, { sensitivity: 'base' });
      if (cmpItem !== 0) return cmpItem;

      // 4. Final tie-breaker: productKey
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
 * Generates RFC 4180 compliant CSV string with UTF-8 BOM, including
 * leading sequential row index `#` and `Bill Date` column.
 * 
 * View A (ITEM_FIRST):
 *   # | Item | Invoice No | Bill Date | Billed Qty | Issued Qty | Serial Entry Pending | Vendor DCR Pending | On Hold | Ready to Issue
 * 
 * View B (INVOICE_FIRST):
 *   # | Invoice No | Bill Date | Item | Billed Qty | Issued Qty | Serial Entry Pending | Vendor DCR Pending | On Hold | Ready to Issue
 */
export function generatePivotCsv(
  rows: NormalizedPivotRow[],
  orientation: PivotOrientation,
  totals: PivotTotals
): string {
  const lines: string[] = [];

  if (orientation === 'ITEM_FIRST') {
    lines.push([
      '#',
      'Item',
      'Invoice No',
      'Bill Date',
      'Billed Qty',
      'Issued Qty',
      'Serial Entry Pending',
      'Vendor DCR Pending',
      'On Hold',
      'Ready to Issue',
    ].map(escapeCsvCell).join(','));

    rows.forEach((row, idx) => {
      lines.push([
        idx + 1,
        row.itemDisplayName,
        row.invoiceNumber,
        formatBillDate(row.billDate || row.invoiceDate),
        row.billedQty,
        row.issuedQty,
        row.serialEntryPending,
        row.vendorDcrPending,
        row.onHold,
        row.readyToIssue,
      ].map(escapeCsvCell).join(','));
    });

    lines.push([
      'Grand Total',
      '',
      '',
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
      '#',
      'Invoice No',
      'Bill Date',
      'Item',
      'Billed Qty',
      'Issued Qty',
      'Serial Entry Pending',
      'Vendor DCR Pending',
      'On Hold',
      'Ready to Issue',
    ].map(escapeCsvCell).join(','));

    rows.forEach((row, idx) => {
      lines.push([
        idx + 1,
        row.invoiceNumber,
        formatBillDate(row.billDate || row.invoiceDate),
        row.itemDisplayName,
        row.billedQty,
        row.issuedQty,
        row.serialEntryPending,
        row.vendorDcrPending,
        row.onHold,
        row.readyToIssue,
      ].map(escapeCsvCell).join(','));
    });

    lines.push([
      'Grand Total',
      '',
      '',
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

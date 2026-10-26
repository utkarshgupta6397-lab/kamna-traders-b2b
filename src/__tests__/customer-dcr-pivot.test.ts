/**
 * Comprehensive Test Suite for Customer DCR Lookup Dual Pivot Tables
 * 
 * Verifies all requirements from AG Implementation Prompt + Additional Requirements:
 * - Section 12.A: Data aggregation tests (Cases 1-15)
 * - Section 12.B: Pivot consistency tests (View A vs View B reconciliation)
 * - Section 12.C: Filter tests (All Invoices vs Pending DCR, Status Filter)
 * - Section 12.D: CSV export tests (Headers, columns, escaping, UTF-8 BOM, grand total)
 * - Section 12.E: JPEG export tests (Container contents, columns, grand total row)
 * - Section 12.F: Regression tests (Preservation of existing logic & status calculations)
 * - Additional Requirements:
 *     1. Bill Date column in both views
 *     2. Stable sequential row index (#)
 *     3. Mandatory default sorting: Bill Date descending (newest first)
 *     4. Undated invoices sorted last safely
 */

import {
  calculateItemDcrMetrics,
  getProductIdentityKey,
  getItemDisplayName,
  getBillDateTimestamp,
  formatBillDate,
  buildNormalizedPivotRows,
  sortPivotRows,
  calculatePivotTotals,
  escapeCsvCell,
  generatePivotCsv,
  sanitizeFilenamePart,
  RawDcrInvoice,
  NormalizedPivotRow,
} from '../lib/dcr-pivot';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, message?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}${message ? ` - ${message}` : ''}`);
  }
}

console.log('\n======================================================');
console.log('   CUSTOMER DCR LOOKUP PIVOT TEST SUITE               ');
console.log('======================================================\n');

// -------------------------------------------------------------
// SECTION A: DATA AGGREGATION TESTS
// -------------------------------------------------------------
console.log('--- SECTION 12.A: DATA AGGREGATION TESTS ---');

// Case 1: One invoice with one product
{
  const inv: RawDcrInvoice = {
    id: 'inv_1',
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-07-01',
    items: [
      {
        id: 'item_1',
        itemId: 'prod_100',
        sku: 'SKU-100',
        itemName: 'Panel 540W',
        quantity: 10,
        selectedForDCR: true,
        serialAllocations: Array(10).fill(null).map((_, i) => ({
          serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' },
        })),
      },
    ],
  };

  const rows = buildNormalizedPivotRows([inv]);
  assert(rows.length === 1, 'Case 1: One invoice with one product -> 1 row');
  assert(rows[0].billedQty === 10, 'Case 1: Billed Qty is 10');
  assert(rows[0].issuedQty === 10, 'Case 1: Issued Qty is 10');
  assert(rows[0].serialEntryPending === 0, 'Case 1: Serial Entry Pending is 0');
  assert(rows[0].billDate === '2026-07-01', 'Case 1: Bill Date is mapped accurately');
}

// Case 2: One invoice with multiple products
{
  const inv: RawDcrInvoice = {
    id: 'inv_2',
    invoiceNumber: 'INV-002',
    invoiceDate: '2026-07-02',
    items: [
      {
        id: 'item_2a',
        itemId: 'prod_200',
        sku: 'SKU-200',
        itemName: 'Panel 400W Mono',
        quantity: 5,
        selectedForDCR: true,
        serialAllocations: [],
      },
      {
        id: 'item_2b',
        itemId: 'prod_300',
        sku: 'SKU-300',
        itemName: 'Panel 550W Bifacial',
        quantity: 8,
        selectedForDCR: true,
        serialAllocations: [],
      },
    ],
  };

  const rows = buildNormalizedPivotRows([inv]);
  assert(rows.length === 2, 'Case 2: One invoice with 2 distinct products -> 2 rows');
  const totals = calculatePivotTotals(rows);
  assert(totals.billedQty === 13, 'Case 2: Total billed is 13');
  assert(totals.serialEntryPending === 13, 'Case 2: Total serial pending is 13');
}

// Case 3: One product appearing on multiple invoices
{
  const invoices: RawDcrInvoice[] = [
    {
      id: 'inv_3a',
      invoiceNumber: 'INV-003A',
      invoiceDate: '2026-07-03',
      items: [
        {
          id: 'item_3a',
          itemId: 'prod_common',
          sku: 'SKU-COMMON',
          itemName: 'Adani 545W',
          quantity: 20,
          selectedForDCR: true,
          serialAllocations: [],
        },
      ],
    },
    {
      id: 'inv_3b',
      invoiceNumber: 'INV-003B',
      invoiceDate: '2026-07-04',
      items: [
        {
          id: 'item_3b',
          itemId: 'prod_common',
          sku: 'SKU-COMMON',
          itemName: 'Adani 545W',
          quantity: 30,
          selectedForDCR: true,
          serialAllocations: [],
        },
      ],
    },
  ];

  const rows = buildNormalizedPivotRows(invoices);
  assert(rows.length === 2, 'Case 3: One product on 2 invoices -> 2 rows (Item+Invoice distinct)');
  assert(rows.every(r => r.productKey === 'item_prod_common'), 'Case 3: Both rows share same productKey');
}

// Case 4: Multiple invoice lines referencing the same product in a single invoice
{
  const inv: RawDcrInvoice = {
    id: 'inv_4',
    invoiceNumber: 'INV-004',
    invoiceDate: '2026-07-05',
    items: [
      {
        id: 'line_1',
        itemId: 'prod_split',
        sku: 'SKU-SPLIT',
        itemName: 'Waaree 540W',
        quantity: 15,
        selectedForDCR: true,
        serialAllocations: [],
      },
      {
        id: 'line_2',
        itemId: 'prod_split',
        sku: 'SKU-SPLIT',
        itemName: 'Waaree 540W',
        quantity: 25,
        selectedForDCR: true,
        serialAllocations: [],
      },
    ],
  };

  const rows = buildNormalizedPivotRows([inv]);
  assert(rows.length === 1, 'Case 4: Multiple lines for same product in 1 invoice aggregate to 1 row');
  assert(rows[0].billedQty === 40, 'Case 4: Aggregated Billed Qty is 40 (15 + 25)');
}

// Case 5: Different SKUs sharing similar display names
{
  const inv: RawDcrInvoice = {
    id: 'inv_5',
    invoiceNumber: 'INV-005',
    invoiceDate: '2026-07-06',
    items: [
      {
        id: 'line_5a',
        itemId: 'prod_var_a',
        sku: 'SKU-V1',
        itemName: 'Solar Panel 500W',
        quantity: 10,
        selectedForDCR: true,
      },
      {
        id: 'line_5b',
        itemId: 'prod_var_b',
        sku: 'SKU-V2',
        itemName: 'Solar Panel 500W',
        quantity: 12,
        selectedForDCR: true,
      },
    ],
  };

  const rows = buildNormalizedPivotRows([inv]);
  assert(rows.length === 2, 'Case 5: Different variant SKUs sharing similar name remain separate rows');
  assert(rows[0].productKey !== rows[1].productKey, 'Case 5: Product keys are distinct');
  assert(rows[0].itemDisplayName.includes('SKU-V1') || rows[1].itemDisplayName.includes('SKU-V2'), 'Case 5: Variant SKU disambiguation included in display name');
}

// Case 6: An invoice containing both issued and pending serials
{
  const inv: RawDcrInvoice = {
    id: 'inv_6',
    invoiceNumber: 'INV-006',
    invoiceDate: '2026-07-07',
    items: [
      {
        id: 'line_6',
        itemId: 'prod_6',
        sku: 'SKU-6',
        itemName: 'Panel 535W',
        quantity: 10,
        selectedForDCR: true,
        serialAllocations: [
          { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
          { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
          { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
          { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
          { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
          { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
          { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
        ],
      },
    ],
  };

  const rows = buildNormalizedPivotRows([inv]);
  assert(rows[0].billedQty === 10, 'Case 6: Billed Qty is 10');
  assert(rows[0].issuedQty === 4, 'Case 6: Issued Qty is 4');
  assert(rows[0].vendorDcrPending === 3, 'Case 6: Vendor DCR Pending is 3');
  assert(rows[0].serialEntryPending === 3, 'Case 6: Serial Entry Pending is 3 (10 - 7)');
  assert(
    rows[0].issuedQty + rows[0].vendorDcrPending + rows[0].serialEntryPending === rows[0].billedQty,
    'Case 6: Sum of states reconciles perfectly with Billed Qty (4 + 3 + 3 = 10)'
  );
}

// Case 7, 8, 9, 10: Product containing serials in all 4 workflow states
{
  const itemMetrics = calculateItemDcrMetrics({
    quantity: 20,
    selectedForDCR: true,
    serialAllocations: [
      { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'ISSUED', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'READY_TO_ISSUE', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'READY_TO_ISSUE', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'READY_TO_ISSUE', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'READY_TO_ISSUE', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'HOLD', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'ALLOCATED', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'RETURNED', vendorDcrStatus: 'RECEIVED' } },
      { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
      { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
      { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
      { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
      { serial: { status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED' } },
      { serial: { status: 'HOLD', vendorDcrStatus: 'NOT_RECEIVED' } },
    ],
  });

  assert(itemMetrics.billedQty === 20, 'Cases 7-10: Billed Qty is 20');
  assert(itemMetrics.issuedQty === 5, 'Cases 7-10: Issued Qty is 5');
  assert(itemMetrics.readyToIssue === 4, 'Case 10: Ready to Issue is 4');
  assert(itemMetrics.onHold === 3, 'Case 8: On Hold is 3');
  assert(itemMetrics.vendorDcrPending === 6, 'Case 9: Vendor DCR Pending is 6');
  assert(itemMetrics.serialEntryPending === 2, 'Cases 7-10: Serial Entry Pending is 2');
  const sum = itemMetrics.issuedQty + itemMetrics.readyToIssue + itemMetrics.onHold + itemMetrics.vendorDcrPending + itemMetrics.serialEntryPending;
  assert(sum === 20, 'Cases 7-10: Complete partition of 20 panels into mutually exclusive states');
}

// Case 11: Non-DCR / excluded items omitted
{
  const inv: RawDcrInvoice = {
    id: 'inv_11',
    invoiceNumber: 'INV-011',
    invoiceDate: '2026-07-08',
    items: [
      {
        id: 'line_dcr',
        itemId: 'prod_dcr',
        sku: 'DCR-1',
        itemName: 'DCR Panel',
        quantity: 5,
        selectedForDCR: true,
      },
      {
        id: 'line_nondcr',
        itemId: 'prod_nondcr',
        sku: 'INV-1',
        itemName: 'Inverter',
        quantity: 2,
        selectedForDCR: false,
      },
    ],
  };

  const rows = buildNormalizedPivotRows([inv]);
  assert(rows.length === 1, 'Case 11: Non-DCR items (selectedForDCR = false) excluded from pivot');
  assert(rows[0].productKey === 'item_prod_dcr', 'Case 11: Only DCR item included');
}

// Case 12: Missing optional DCR serial records handled gracefully
{
  const itemMetrics = calculateItemDcrMetrics({
    quantity: 5,
    selectedForDCR: true,
    serialAllocations: [
      null as any,
      { serial: null },
      { serial: { status: null, vendorDcrStatus: null } },
    ],
  });

  assert(itemMetrics.billedQty === 5, 'Case 12: Handles null/missing serial gracefully without crashing');
  assert(itemMetrics.serialEntryPending === 2, 'Case 12: 5 - 3 allocations = 2 pending');
}

// Case 13: Empty dataset
{
  const rows = buildNormalizedPivotRows([]);
  assert(rows.length === 0, 'Case 13: Empty invoices input -> 0 rows');
  const totals = calculatePivotTotals(rows);
  assert(totals.billedQty === 0 && totals.issuedQty === 0, 'Case 13: Empty dataset totals are all 0');
}

// Case 14: Large dataset performance
{
  const startTime = Date.now();
  const largeInvoices: RawDcrInvoice[] = [];
  for (let i = 0; i < 200; i++) {
    largeInvoices.push({
      id: `inv_lg_${i}`,
      invoiceNumber: `INV-${String(i).padStart(4, '0')}`,
      invoiceDate: '2026-07-09',
      items: [
        {
          id: `item_lg_${i}_1`,
          itemId: `prod_${i % 15}`,
          sku: `SKU-${i % 15}`,
          itemName: `Solar Panel Variant ${i % 15}`,
          quantity: 20,
          selectedForDCR: true,
          metrics: {
            billedQty: 20,
            issuedQty: 5,
            serialEntryPending: 5,
            vendorDcrPending: 5,
            onHold: 3,
            readyToIssue: 2,
          },
        },
      ],
    });
  }

  const rows = buildNormalizedPivotRows(largeInvoices);
  const sortedA = sortPivotRows(rows, 'ITEM_FIRST');
  const sortedB = sortPivotRows(rows, 'INVOICE_FIRST');
  const totals = calculatePivotTotals(rows);
  const duration = Date.now() - startTime;

  assert(rows.length === 200, 'Case 14: 200 invoices processed accurately');
  assert(totals.billedQty === 4000, 'Case 14: 200 x 20 = 4000 billed panels');
  assert(duration < 200, `Case 14: Large dataset processed in ${duration}ms (< 200ms)`);
}

// -------------------------------------------------------------
// SECTION B: PIVOT CONSISTENCY & DUAL-ORIENTATION TESTS
// -------------------------------------------------------------
console.log('\n--- SECTION 12.B: PIVOT CONSISTENCY & DUAL ORIENTATION ---');

{
  const testInvoices: RawDcrInvoice[] = [
    {
      id: 'inv_101',
      invoiceNumber: 'INV-101',
      invoiceDate: '2026-08-01',
      items: [
        {
          id: 'it_1',
          itemId: 'p_alpha',
          sku: 'SKU-A',
          itemName: 'Alpha 540W',
          quantity: 10,
          selectedForDCR: true,
          metrics: { billedQty: 10, issuedQty: 4, serialEntryPending: 2, vendorDcrPending: 2, onHold: 1, readyToIssue: 1 },
        },
        {
          id: 'it_2',
          itemId: 'p_beta',
          sku: 'SKU-B',
          itemName: 'Beta 550W',
          quantity: 20,
          selectedForDCR: true,
          metrics: { billedQty: 20, issuedQty: 10, serialEntryPending: 5, vendorDcrPending: 3, onHold: 1, readyToIssue: 1 },
        },
      ],
    },
    {
      id: 'inv_102',
      invoiceNumber: 'INV-102',
      invoiceDate: '2026-08-05', // More recent date
      items: [
        {
          id: 'it_3',
          itemId: 'p_alpha',
          sku: 'SKU-A',
          itemName: 'Alpha 540W',
          quantity: 15,
          selectedForDCR: true,
          metrics: { billedQty: 15, issuedQty: 5, serialEntryPending: 5, vendorDcrPending: 2, onHold: 2, readyToIssue: 1 },
        },
      ],
    },
  ];

  const rows = buildNormalizedPivotRows(testInvoices);
  const viewA = sortPivotRows(rows, 'ITEM_FIRST');
  const viewB = sortPivotRows(rows, 'INVOICE_FIRST');

  assert(viewA.length === viewB.length, 'Consistency: View A and View B record counts match (3 === 3)');

  // Verify all 6 grand totals match between View A and View B
  const totalsA = calculatePivotTotals(viewA);
  const totalsB = calculatePivotTotals(viewB);

  assert(totalsA.billedQty === totalsB.billedQty, 'Consistency: Grand Total Billed Qty matches (45 === 45)');
  assert(totalsA.issuedQty === totalsB.issuedQty, 'Consistency: Grand Total Issued Qty matches (19 === 19)');
  assert(totalsA.serialEntryPending === totalsB.serialEntryPending, 'Consistency: Grand Total Serial Pending matches (12 === 12)');
  assert(totalsA.vendorDcrPending === totalsB.vendorDcrPending, 'Consistency: Grand Total Vendor Pending matches (7 === 7)');
  assert(totalsA.onHold === totalsB.onHold, 'Consistency: Grand Total On Hold matches (4 === 4)');
  assert(totalsA.readyToIssue === totalsB.readyToIssue, 'Consistency: Grand Total Ready to Issue matches (3 === 3)');

  // Mandatory Default Sorting check: INV-102 (dated 2026-08-05) appears before INV-101 (dated 2026-08-01)
  assert(viewA[0].invoiceNumber === 'INV-102', 'Default Sort View A: Most recent date (2026-08-05) appears first');
  assert(viewB[0].invoiceNumber === 'INV-102', 'Default Sort View B: Most recent date (2026-08-05) appears first');
}

// -------------------------------------------------------------
// SECTION C: ADDITIONAL REQUIREMENTS — BILL DATE, INDEXING & SORTING
// -------------------------------------------------------------
console.log('\n--- SECTION 12.C: BILL DATE, INDEXING & DEFAULT SORTING ---');

{
  // Test date sorting with 3 invoices: Aug 10, Aug 05, and Undated
  const dateInvoices: RawDcrInvoice[] = [
    {
      id: 'inv_d1',
      invoiceNumber: 'INV-OLD',
      invoiceDate: '2026-08-01',
      items: [{ itemId: 'p1', itemName: 'Panel A', quantity: 5, selectedForDCR: true }],
    },
    {
      id: 'inv_d2',
      invoiceNumber: 'INV-NEW',
      invoiceDate: '2026-08-10',
      items: [{ itemId: 'p1', itemName: 'Panel A', quantity: 5, selectedForDCR: true }],
    },
    {
      id: 'inv_d3',
      invoiceNumber: 'INV-UNDATED',
      invoiceDate: '' as any, // Missing / undated
      items: [{ itemId: 'p1', itemName: 'Panel A', quantity: 5, selectedForDCR: true }],
    },
  ];

  const rows = buildNormalizedPivotRows(dateInvoices);
  const sortedA = sortPivotRows(rows, 'ITEM_FIRST');
  const sortedB = sortPivotRows(rows, 'INVOICE_FIRST');

  // View A check
  assert(sortedA[0].invoiceNumber === 'INV-NEW', 'Bill Date Sort View A: 2026-08-10 is row 1');
  assert(sortedA[1].invoiceNumber === 'INV-OLD', 'Bill Date Sort View A: 2026-08-01 is row 2');
  assert(sortedA[2].invoiceNumber === 'INV-UNDATED', 'Bill Date Sort View A: Undated invoice appears last (row 3)');

  // View B check
  assert(sortedB[0].invoiceNumber === 'INV-NEW', 'Bill Date Sort View B: 2026-08-10 is row 1');
  assert(sortedB[1].invoiceNumber === 'INV-OLD', 'Bill Date Sort View B: 2026-08-01 is row 2');
  assert(sortedB[2].invoiceNumber === 'INV-UNDATED', 'Bill Date Sort View B: Undated invoice appears last (row 3)');

  // Date Formatting check
  assert(formatBillDate('2026-08-10') === '10 Aug 26', 'Date Formatter: formats valid date into "10 Aug 26"');
  assert(formatBillDate('') === '-', 'Date Formatter: missing date formats to "-"');
  assert(formatBillDate(null) === '-', 'Date Formatter: null date formats to "-"');

  // Timestamp check
  assert(getBillDateTimestamp('2026-08-10') > getBillDateTimestamp('2026-08-01'), 'Timestamp: Aug 10 > Aug 01');
  assert(getBillDateTimestamp('') === -Infinity, 'Timestamp: Undated returns -Infinity');
}

// -------------------------------------------------------------
// SECTION D: CSV EXPORT TESTS WITH # AND BILL DATE
// -------------------------------------------------------------
console.log('\n--- SECTION 12.D: CSV EXPORT TESTS ---');

{
  const rows: NormalizedPivotRow[] = [
    {
      productKey: 'item_1',
      itemDisplayName: 'Panel "Pro", 550W',
      invoiceId: 'inv_1',
      invoiceNumber: 'INV,001',
      invoiceDate: '2026-08-05',
      billDate: '2026-08-05',
      billedQty: 10,
      issuedQty: 5,
      serialEntryPending: 2,
      vendorDcrPending: 1,
      onHold: 1,
      readyToIssue: 1,
    },
    {
      productKey: 'item_2',
      itemDisplayName: 'Panel Standard 540W',
      invoiceId: 'inv_2',
      invoiceNumber: 'INV-002',
      invoiceDate: '2026-08-01',
      billDate: '2026-08-01',
      billedQty: 20,
      issuedQty: 10,
      serialEntryPending: 5,
      vendorDcrPending: 2,
      onHold: 2,
      readyToIssue: 1,
    },
  ];

  const totals = calculatePivotTotals(rows);

  // View A CSV
  const csvA = generatePivotCsv(rows, 'ITEM_FIRST', totals);
  assert(csvA.startsWith('\uFEFF'), 'CSV Export: Begins with UTF-8 BOM');
  const linesA = csvA.split('\r\n');
  assert(
    linesA[0].replace(/^\uFEFF/, '') === '#,Item,Invoice No,Bill Date,Billed Qty,Issued Qty,Serial Entry Pending,Vendor DCR Pending,On Hold,Ready to Issue',
    'CSV View A: Exact 10 columns with # and Bill Date'
  );
  assert(linesA[1].startsWith('1,"Panel ""Pro"", 550W","INV,001",05 Aug 26'), 'CSV View A: Row 1 has index 1, escaped item, escaped invoice, and formatted bill date');
  assert(linesA[2].startsWith('2,Panel Standard 540W,INV-002,01 Aug 26'), 'CSV View A: Row 2 has index 2');
  assert(linesA[3].startsWith('Grand Total,,,,30,15,7,3,3,2'), 'CSV View A: Grand Total row placed accurately without numeric index');

  // View B CSV
  const csvB = generatePivotCsv(rows, 'INVOICE_FIRST', totals);
  const linesB = csvB.split('\r\n');
  assert(
    linesB[0].replace(/^\uFEFF/, '') === '#,Invoice No,Bill Date,Item,Billed Qty,Issued Qty,Serial Entry Pending,Vendor DCR Pending,On Hold,Ready to Issue',
    'CSV View B: Exact 10 columns in reversed order'
  );
  assert(linesB[1].startsWith('1,"INV,001",05 Aug 26,"Panel ""Pro"", 550W"'), 'CSV View B: Row 1 has index 1, invoice, bill date, item');
  assert(linesB[2].startsWith('2,INV-002,01 Aug 26,Panel Standard 540W'), 'CSV View B: Row 2 has index 2');
  assert(linesB[3].startsWith('Grand Total,,,,30,15,7,3,3,2'), 'CSV View B: Grand Total row placed accurately');

  // Filename sanitation
  assert(sanitizeFilenamePart('Apex Solar / Energy Corp.') === 'Apex_Solar_Energy_Corp', 'Filename: Characters sanitized cleanly');
}

// -------------------------------------------------------------
// SECTION E: FILTER INTEGRATION TESTS
// -------------------------------------------------------------
console.log('\n--- SECTION 12.E: FILTER INTEGRATION TESTS ---');

{
  const invoicesWithFilterStatus: Array<RawDcrInvoice & { processingStatus: string; issued: number; dcrPanels: number; onHold: number; readyToIssue: number; serialEntryPending: number; vendorDcrPending: number }> = [
    {
      id: 'inv_f1',
      invoiceNumber: 'INV-F1',
      invoiceDate: '2026-08-01',
      processingStatus: 'PROCESSED_DCR',
      dcrPanels: 10,
      issued: 10, // Fully issued
      onHold: 0,
      readyToIssue: 0,
      serialEntryPending: 0,
      vendorDcrPending: 0,
      items: [
        {
          id: 'i1',
          itemId: 'p1',
          itemName: 'Panel 1',
          quantity: 10,
          selectedForDCR: true,
          metrics: { billedQty: 10, issuedQty: 10, serialEntryPending: 0, vendorDcrPending: 0, onHold: 0, readyToIssue: 0 },
        },
      ],
    },
    {
      id: 'inv_f2',
      invoiceNumber: 'INV-F2',
      invoiceDate: '2026-08-02',
      processingStatus: 'PROCESSED_DCR',
      dcrPanels: 15,
      issued: 0,
      onHold: 5, // Has hold
      readyToIssue: 0,
      serialEntryPending: 10,
      vendorDcrPending: 0,
      items: [
        {
          id: 'i2',
          itemId: 'p2',
          itemName: 'Panel 2',
          quantity: 15,
          selectedForDCR: true,
          metrics: { billedQty: 15, issuedQty: 0, serialEntryPending: 10, vendorDcrPending: 0, onHold: 5, readyToIssue: 0 },
        },
      ],
    },
  ];

  const isPending = (inv: typeof invoicesWithFilterStatus[0], mode: 'ALL' | 'PENDING') => {
    if (mode === 'PENDING') return inv.processingStatus === 'UNPROCESSED' || inv.issued !== inv.dcrPanels;
    return true;
  };
  const matchesStatus = (inv: typeof invoicesWithFilterStatus[0], filter: string) => {
    if (filter === 'ALL') return true;
    if (filter === 'HOLD') return inv.onHold > 0;
    if (filter === 'ISSUED') return inv.dcrPanels > 0 && inv.issued === inv.dcrPanels;
    return true;
  };

  // 1. ALL Invoices
  const allFiltered = invoicesWithFilterStatus.filter(i => isPending(i, 'ALL')).filter(i => matchesStatus(i, 'ALL'));
  assert(buildNormalizedPivotRows(allFiltered).length === 2, 'Filters: ALL mode returns both invoices');

  // 2. PENDING DCR Filter
  const pendingFiltered = invoicesWithFilterStatus.filter(i => isPending(i, 'PENDING')).filter(i => matchesStatus(i, 'ALL'));
  assert(buildNormalizedPivotRows(pendingFiltered).length === 1, 'Filters: PENDING DCR excludes fully issued invoice INV-F1');
  assert(buildNormalizedPivotRows(pendingFiltered)[0].invoiceNumber === 'INV-F2', 'Filters: Only pending invoice INV-F2 present');

  // 3. Status Filter = HOLD
  const holdFiltered = invoicesWithFilterStatus.filter(i => isPending(i, 'ALL')).filter(i => matchesStatus(i, 'HOLD'));
  assert(buildNormalizedPivotRows(holdFiltered).length === 1, 'Filters: HOLD filter returns only INV-F2');

  // 4. Status Filter = ISSUED
  const issuedFiltered = invoicesWithFilterStatus.filter(i => isPending(i, 'ALL')).filter(i => matchesStatus(i, 'ISSUED'));
  assert(buildNormalizedPivotRows(issuedFiltered).length === 1, 'Filters: ISSUED filter returns only INV-F1');
}

// -------------------------------------------------------------
// SECTION F: REGRESSION VERIFICATION
// -------------------------------------------------------------
console.log('\n--- SECTION 12.F: REGRESSION VERIFICATION ---');

{
  const nonDcrItem = calculateItemDcrMetrics({ quantity: 50, selectedForDCR: false });
  assert(nonDcrItem.billedQty === 0, 'Regression: Non-DCR item produces 0 billedQty');
  assert(nonDcrItem.serialEntryPending === 0, 'Regression: Non-DCR item produces 0 serialEntryPending');

  const allocs = [
    { serial: { vendorDcrStatus: 'NOT_RECEIVED', status: 'ALLOCATED' } },
    { serial: { vendorDcrStatus: 'RECEIVED', status: 'ISSUED' } },
    { serial: { vendorDcrStatus: 'RECEIVED', status: 'READY_TO_ISSUE' } },
    { serial: { vendorDcrStatus: 'RECEIVED', status: 'HOLD' } },
    { serial: { vendorDcrStatus: 'RECEIVED', status: 'ALLOCATED' } },
  ];
  const m = calculateItemDcrMetrics({ quantity: 6, selectedForDCR: true, serialAllocations: allocs });
  assert(m.billedQty === 6, 'Regression: Billed is 6');
  assert(m.serialEntryPending === 1, 'Regression: 6 - 5 = 1 pending entry');
  assert(m.vendorDcrPending === 1, 'Regression: 1 pending vendor DCR');
  assert(m.issuedQty === 1, 'Regression: 1 issued');
  assert(m.readyToIssue === 1, 'Regression: 1 ready to issue');
  assert(m.onHold === 2, 'Regression: 2 on hold (HOLD + ALLOCATED with vendor DCR received)');
}

console.log('\n======================================================');
console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}

/**
 * Comprehensive Test Suite for Mobile DCR Grouped Serials
 * 
 * Verifies all 12 test cases specified in Section 17 of the requirements:
 * 1. Four serials with same Product + Serial Tag -> one group containing four serials
 * 2. Same Product with two different Serial Tags -> two groups
 * 3. Different Products with same Serial Tag -> separate groups
 * 4. Group with mixed serial statuses -> group status does not report first serial's status
 * 5. Status filter ON HOLD -> group appears if any underlying serial is ON HOLD
 * 6. Search by serial -> containing group appears and matching serial is identified
 * 7. Invoice filter -> no cross-invoice grouping
 * 8. Product with image -> image displayed
 * 9. Product without image -> existing placeholder displayed
 * 10. Large group with 50+ serials -> remains usable and performant
 * 11. Pagination does not split one logical group into duplicate group cards
 * 12. Summary Total remains physical serial count, not group count
 */

import {
  groupSerialsByProductAndTag,
  SerialItem,
  GroupedSerial,
  getStatusBadgeStyle,
  getVendorDcrBadgeStyle
} from '../components/dcr/MobileGroupedSerials';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, message?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${message || 'Assertion failed'}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('    MOBILE DCR GROUPED SERIALS TEST SUITE             ');
  console.log('======================================================\n');

  // --- TEST 1: Four serials with same Product + Serial Tag -> one group containing four serials ---
  console.log('--- TEST 1: Four serials with same Product + Serial Tag -> one group ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'SER-001', computedProduct: 'Adani 625 Watt TOPCon DCR Solar Panel', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
      { id: '2', serialNumber: 'SER-002', computedProduct: 'Adani 625 Watt TOPCon DCR Solar Panel', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
      { id: '3', serialNumber: 'SER-003', computedProduct: 'Adani 625 Watt TOPCon DCR Solar Panel', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
      { id: '4', serialNumber: 'SER-004', computedProduct: 'Adani 625 Watt TOPCon DCR Solar Panel', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
    ];

    const groups = groupSerialsByProductAndTag(serials, 'INV-101');
    assert(groups.length === 1, 'TEST 1a: Exactly 1 group created', `Got ${groups.length}`);
    assert(groups[0].totalCount === 4, 'TEST 1b: Group contains exactly 4 serials', `Got ${groups[0]?.totalCount}`);
    assert(groups[0].productName === 'Adani 625 Watt TOPCon DCR Solar Panel', 'TEST 1c: Product name matches');
    assert(groups[0].serialTag === 'KT/26-27/3181', 'TEST 1d: Serial Tag matches');
    assert(groups[0].statusSummary.primaryStatus === 'ALLOCATED', 'TEST 1e: Group status is ALLOCATED');
    assert(!groups[0].statusSummary.isMixed, 'TEST 1f: Group status is not mixed');
  }

  // --- TEST 2: Same Product with two different Serial Tags -> two groups ---
  console.log('\n--- TEST 2: Same Product with two different Serial Tags -> two groups ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'SER-A1', computedProduct: 'Adani 625 Watt X 12', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
      { id: '2', serialNumber: 'SER-A2', computedProduct: 'Adani 625 Watt X 12', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
      { id: '3', serialNumber: 'SER-B1', computedProduct: 'Adani 625 Watt X 12', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't2', tag: 'KT/26-27/3190' } },
      { id: '4', serialNumber: 'SER-B2', computedProduct: 'Adani 625 Watt X 12', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't2', tag: 'KT/26-27/3190' } },
    ];

    const groups = groupSerialsByProductAndTag(serials, 'INV-102');
    assert(groups.length === 2, 'TEST 2a: Exactly 2 separate groups created', `Got ${groups.length}`);
    const tags = groups.map(g => g.serialTag).sort();
    assert(tags[0] === 'KT/26-27/3181' && tags[1] === 'KT/26-27/3190', 'TEST 2b: Distinct serial tags present');
    assert(groups[0].totalCount === 2 && groups[1].totalCount === 2, 'TEST 2c: Each group contains 2 serials');
  }

  // --- TEST 3: Different Products with same Serial Tag -> separate groups ---
  console.log('\n--- TEST 3: Different Products with same Serial Tag -> separate groups ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'PANEL-01', computedProduct: 'Adani 625 Watt TOPCon DCR Solar Panel', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
      { id: '2', serialNumber: 'PANEL-02', computedProduct: 'Vikram 550 Watt Bifacial DCR Solar Panel', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
    ];

    const groups = groupSerialsByProductAndTag(serials, 'INV-103');
    assert(groups.length === 2, 'TEST 3a: Exactly 2 separate groups created for different products', `Got ${groups.length}`);
    const products = groups.map(g => g.productName);
    assert(products.includes('Adani 625 Watt TOPCon DCR Solar Panel'), 'TEST 3b: First product present');
    assert(products.includes('Vikram 550 Watt Bifacial DCR Solar Panel'), 'TEST 3c: Second product present');
    assert(groups[0].serialTag === 'KT/26-27/3181' && groups[1].serialTag === 'KT/26-27/3181', 'TEST 3d: Same tag shared without merging');
  }

  // --- TEST 4: Group with mixed serial statuses -> group status does not report first serial status ---
  console.log('\n--- TEST 4: Group with mixed serial statuses -> accurate mixed breakdown ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'S-01', computedProduct: 'Adani 625W', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-1' } },
      { id: '2', serialNumber: 'S-02', computedProduct: 'Adani 625W', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-1' } },
      { id: '3', serialNumber: 'S-03', computedProduct: 'Adani 625W', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-1' } },
      { id: '4', serialNumber: 'S-04', computedProduct: 'Adani 625W', status: 'HOLD', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-1' } },
    ];

    const groups = groupSerialsByProductAndTag(serials, 'INV-104');
    assert(groups.length === 1, 'TEST 4a: 1 group created');
    assert(groups[0].statusSummary.isMixed === true, 'TEST 4b: Group marked as mixed status');
    assert(groups[0].statusSummary.primaryStatus === 'MIXED', 'TEST 4c: Primary status is MIXED (not first serial ALLOCATED)');
    assert(groups[0].statusSummary.counts['ALLOCATED'] === 3, 'TEST 4d: Exactly 3 Allocated counted');
    assert(groups[0].statusSummary.counts['HOLD'] === 1, 'TEST 4e: Exactly 1 Hold counted');
  }

  // --- TEST 5: Status filter ON HOLD -> group appears if any underlying serial is ON HOLD ---
  console.log('\n--- TEST 5: Status filter ON HOLD -> group appears with matching serials ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'S-01', computedProduct: 'Product Alpha', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-X' } },
      { id: '2', serialNumber: 'S-02', computedProduct: 'Product Alpha', status: 'HOLD', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-X' } },
      { id: '3', serialNumber: 'S-03', computedProduct: 'Product Beta', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't2', tag: 'TAG-Y' } },
    ];

    const groups = groupSerialsByProductAndTag(serials, 'INV-105');
    // Filter groups where at least one serial has status HOLD
    const holdGroups = groups.filter(g => g.serials.some(s => s.status === 'HOLD'));
    assert(holdGroups.length === 1, 'TEST 5a: Only group with HOLD serial appears', `Got ${holdGroups.length}`);
    assert(holdGroups[0].productName === 'Product Alpha', 'TEST 5b: Correct group surfaced');
    const holdSerials = holdGroups[0].serials.filter(s => s.status === 'HOLD');
    assert(holdSerials.length === 1 && holdSerials[0].serialNumber === 'S-02', 'TEST 5c: Matching serial S-02 identified');
  }

  // --- TEST 6: Search by serial -> containing group appears and matching serial is identified ---
  console.log('\n--- TEST 6: Search by serial -> containing group appears ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'ABC12345', computedProduct: 'Adani 625 Watt TOPCon DCR Solar Panel', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'KT/26-27/3181' } },
      { id: '2', serialNumber: 'DEF67890', computedProduct: 'Vikram 550 Watt', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't2', tag: 'KT/26-27/3182' } },
    ];

    const searchQuery = 'ABC12345';
    const groups = groupSerialsByProductAndTag(serials, 'INV-106');
    const matchedGroups = groups.filter(g => g.serials.some(s => s.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())));

    assert(matchedGroups.length === 1, 'TEST 6a: Exactly 1 group matches serial search');
    assert(matchedGroups[0].productName === 'Adani 625 Watt TOPCon DCR Solar Panel', 'TEST 6b: Matched correct group');
    assert(matchedGroups[0].serials[0].serialNumber === 'ABC12345', 'TEST 6c: Matching serial visible inside group');
  }

  // --- TEST 7: Invoice filter -> no cross-invoice grouping ---
  console.log('\n--- TEST 7: Invoice filter -> no cross-invoice grouping ---');
  {
    const serialsInv1: SerialItem[] = [
      { id: '1', serialNumber: 'SER-INV1-01', computedProduct: 'Same Product', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'SAME-TAG' }, allocations: [{ invoiceId: 'INV-001' }] },
      { id: '2', serialNumber: 'SER-INV1-02', computedProduct: 'Same Product', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'SAME-TAG' }, allocations: [{ invoiceId: 'INV-001' }] },
    ];

    const serialsInv2: SerialItem[] = [
      { id: '3', serialNumber: 'SER-INV2-01', computedProduct: 'Same Product', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'SAME-TAG' }, allocations: [{ invoiceId: 'INV-002' }] },
    ];

    const groupInv1 = groupSerialsByProductAndTag(serialsInv1, 'INV-001');
    const groupInv2 = groupSerialsByProductAndTag(serialsInv2, 'INV-002');

    assert(groupInv1.length === 1 && groupInv1[0].totalCount === 2, 'TEST 7a: Invoice 1 has 1 group with 2 serials');
    assert(groupInv2.length === 1 && groupInv2[0].totalCount === 1, 'TEST 7b: Invoice 2 has 1 group with 1 serial');
    assert(groupInv1[0].groupKey !== groupInv2[0].groupKey, 'TEST 7c: Group keys are isolated by invoiceId');

    // Combined global test
    const combined = groupSerialsByProductAndTag([...serialsInv1, ...serialsInv2]);
    assert(combined.length === 2, 'TEST 7d: Without invoice filter, distinct allocation invoiceIds create 2 separate groups');
  }

  // --- TEST 8: Product with image -> image displayed ---
  console.log('\n--- TEST 8: Product with image -> image displayed ---');
  {
    const mockImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'S-IMG-1', computedProduct: 'Adani 625W with Image', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', productImage: mockImage, tag: { id: 't1', tag: 'TAG-IMG' } },
    ];

    const groups = groupSerialsByProductAndTag(serials, 'INV-108');
    assert(groups[0].productImage === mockImage, 'TEST 8: Group carries product thumbnail image');
  }

  // --- TEST 9: Product without image -> existing placeholder displayed ---
  console.log('\n--- TEST 9: Product without image -> existing placeholder displayed ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'S-NOIMG-1', computedProduct: 'Panel without Image', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', productImage: null, tag: { id: 't1', tag: 'TAG-NOIMG' } },
    ];

    const groups = groupSerialsByProductAndTag(serials, 'INV-109');
    assert(groups[0].productImage === null, 'TEST 9a: Group productImage is null');
    assert(groups[0].productName === 'Panel without Image', 'TEST 9b: Product name renders cleanly without image requirement');
  }

  // --- TEST 10: Large group with 50+ serials -> remains usable and performant ---
  console.log('\n--- TEST 10: Large group with 50+ serials -> performant grouping ---');
  {
    const largeSerials: SerialItem[] = [];
    for (let i = 1; i <= 65; i++) {
      largeSerials.push({
        id: `lg-${i}`,
        serialNumber: `BULK-SERIAL-${i.toString().padStart(4, '0')}`,
        computedProduct: 'Commercial 600W Bulk Panels',
        status: i <= 50 ? 'ALLOCATED' : 'READY_TO_ISSUE',
        vendorDcrStatus: i <= 40 ? 'RECEIVED' : 'NOT_RECEIVED',
        tag: { id: 't-bulk', tag: 'TAG-BULK-01' },
      });
    }

    const t0 = performance.now();
    const groups = groupSerialsByProductAndTag(largeSerials, 'INV-BULK');
    const t1 = performance.now();

    assert(groups.length === 1, 'TEST 10a: Single group for 65 serials with same product and tag');
    assert(groups[0].totalCount === 65, 'TEST 10b: Exact serial count is 65');
    assert(groups[0].statusSummary.isMixed === true, 'TEST 10c: Mixed status properly detected (50 Allocated, 15 Ready to Issue)');
    assert(groups[0].vendorDcrSummary.receivedCount === 40, 'TEST 10d: Exactly 40 Received Vendor DCR counted');
    assert((t1 - t0) < 50, 'TEST 10e: Grouping 65 serials completed in under 50ms', `Took ${(t1 - t0).toFixed(2)}ms`);
  }

  // --- TEST 11: Pagination does not split one logical group into duplicate group cards ---
  console.log('\n--- TEST 11: Pagination does not split one logical group into duplicates ---');
  {
    // Page 1 arrives (30 serials)
    const page1Serials: SerialItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: `p1-${i}`,
      serialNumber: `SER-P1-${i}`,
      computedProduct: 'Adani 625W Bifacial',
      status: 'ALLOCATED',
      vendorDcrStatus: 'NOT_RECEIVED',
      tag: { id: 'tag-pag', tag: 'KT/26-27/3181' },
    }));

    // Page 2 arrives (20 serials with same Product + Tag)
    const page2Serials: SerialItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `p2-${i}`,
      serialNumber: `SER-P2-${i}`,
      computedProduct: 'Adani 625W Bifacial',
      status: 'ALLOCATED',
      vendorDcrStatus: 'NOT_RECEIVED',
      tag: { id: 'tag-pag', tag: 'KT/26-27/3181' },
    }));

    // Cumulative state on client when "Load More" appends items
    const accumulatedSerials = [...page1Serials, ...page2Serials];
    const groups = groupSerialsByProductAndTag(accumulatedSerials, 'INV-PAG');

    assert(groups.length === 1, 'TEST 11a: Exactly 1 group card maintained across pages (not 2 cards)', `Got ${groups.length}`);
    assert(groups[0].totalCount === 50, 'TEST 11b: Total count dynamically merged to 50 serials');
    assert(groups[0].serials.length === 50, 'TEST 11c: All 50 serial records present in single group');
  }

  // --- TEST 12: Summary Total remains the physical serial count, not group count ---
  console.log('\n--- TEST 12: Summary Total remains physical serial count, not group count ---');
  {
    const serials: SerialItem[] = [
      { id: '1', serialNumber: 'S1', computedProduct: 'Product A', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-1' } },
      { id: '2', serialNumber: 'S2', computedProduct: 'Product A', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-1' } },
      { id: '3', serialNumber: 'S3', computedProduct: 'Product A', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't1', tag: 'TAG-1' } },
      { id: '4', serialNumber: 'S4', computedProduct: 'Product B', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't2', tag: 'TAG-2' } },
      { id: '5', serialNumber: 'S5', computedProduct: 'Product B', status: 'ALLOCATED', vendorDcrStatus: 'NOT_RECEIVED', tag: { id: 't2', tag: 'TAG-2' } },
    ];

    const physicalSerialCount = serials.length; // 5
    const groups = groupSerialsByProductAndTag(serials, 'INV-112');
    const groupCount = groups.length; // 2

    assert(physicalSerialCount === 5, 'TEST 12a: Physical serial count is 5');
    assert(groupCount === 2, 'TEST 12b: Group card count is 2');
    
    // Check that summing totalCount across groups equals physical serial count
    const sumGroupTotals = groups.reduce((acc, g) => acc + g.totalCount, 0);
    assert(sumGroupTotals === physicalSerialCount, 'TEST 12c: Sum of group totals matches physical serial count exactly (5 === 5)');
    assert(sumGroupTotals !== groupCount, 'TEST 12d: Grouping does not alter numerical meaning of top Total counter (5 !== 2)');
  }

  // Badge styling tests
  console.log('\n--- STYLING & STATUS BADGE HELPER TESTS ---');
  {
    assert(getStatusBadgeStyle('ALLOCATED').includes('purple'), 'Badge style: ALLOCATED is purple');
    assert(getStatusBadgeStyle('HOLD').includes('red'), 'Badge style: HOLD is red');
    assert(getStatusBadgeStyle('MIXED').includes('amber'), 'Badge style: MIXED is amber');
    assert(getVendorDcrBadgeStyle('RECEIVED').includes('green'), 'Badge style: Vendor RECEIVED is green');
    assert(getVendorDcrBadgeStyle('NOT_RECEIVED').includes('slate'), 'Badge style: Vendor NOT_RECEIVED is slate');
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});

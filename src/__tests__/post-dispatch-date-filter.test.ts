import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { buildPostDispatchWhereClause } from '../lib/post-dispatch-query';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n==========================================================');
  console.log('   POST DISPATCH DATE FILTER — COMPREHENSIVE TEST SUITE   ');
  console.log('==========================================================\n');

  console.log('--- TEST 1: Date Boundary Calculations ---');
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  assert(todayStart < todayEnd, 'today startOfDay is earlier than endOfDay');
  assert(todayStart.getHours() === 0 && todayStart.getMinutes() === 0, 'today startOfDay starts at 00:00');
  assert(todayEnd.getHours() === 23 && todayEnd.getMinutes() === 59, 'today endOfDay ends at 23:59');

  const yesterday = subDays(now, 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd = endOfDay(yesterday);
  assert(yesterdayStart < todayStart, 'yesterday is before today');
  assert(yesterdayEnd < todayStart, 'yesterday end is before today start');

  const last7Start = startOfDay(subDays(now, 6));
  assert(last7Start < todayStart, 'last 7 days starts 6 days prior to today');
  const daysDiff = Math.round((todayStart.getTime() - last7Start.getTime()) / (1000 * 60 * 60 * 24));
  assert(daysDiff === 6, `exactly 6 days prior to today (7 calendar days total including today), got ${daysDiff}`);

  console.log('\n--- TEST 2: Custom Date Range Boundaries ---');
  const customFromStr = '2026-09-12';
  const customToStr = '2026-09-17';
  const customStart = startOfDay(new Date(customFromStr + 'T00:00:00'));
  const customEnd = endOfDay(new Date(customToStr + 'T23:59:59.999'));

  assert(customStart < customEnd, 'custom start is before custom end');
  assert(format(customStart, 'yyyy-MM-dd') === '2026-09-12', 'custom start matches From date');
  assert(format(customEnd, 'yyyy-MM-dd') === '2026-09-17', 'custom end matches To date');

  // Pill label formatting
  const fStr = format(new Date(customFromStr + 'T00:00:00'), 'd MMM');
  const tStr = format(new Date(customToStr + 'T00:00:00'), 'd MMM');
  const pillLabel = `${fStr} – ${tStr}`;
  assert(pillLabel === '12 Sep – 17 Sep', `pill label formatted correctly as '12 Sep – 17 Sep', got '${pillLabel}'`);

  // Single-day custom range
  const singleDayStr = '2026-09-15';
  const singleLabel = format(new Date(singleDayStr + 'T00:00:00'), 'd MMM');
  assert(singleLabel === '15 Sep', `single day custom pill label formatted correctly as '15 Sep', got '${singleLabel}'`);

  console.log('\n--- TEST 3: buildPostDispatchWhereClause with Date Filters ---');
  // 3a. Without date filter
  const whereNoDate = buildPostDispatchWhereClause({ tab: 'all' });
  assert(!whereNoDate.zohoCreatedTime, 'where clause without date filter has no zohoCreatedTime');

  // 3b. With today date filter
  const whereToday = buildPostDispatchWhereClause({
    tab: 'all',
    startDate: todayStart.toISOString(),
    endDate: todayEnd.toISOString(),
  });
  assert(Boolean(whereToday.zohoCreatedTime), 'where clause with today date filter has zohoCreatedTime');
  assert((whereToday.zohoCreatedTime as any)?.gte?.toISOString() === todayStart.toISOString(), 'where clause has correct gte');
  assert((whereToday.zohoCreatedTime as any)?.lte?.toISOString() === todayEnd.toISOString(), 'where clause has correct lte');

  // 3c. With yesterday date filter
  const whereYesterday = buildPostDispatchWhereClause({
    tab: 'all',
    startDate: yesterdayStart.toISOString(),
    endDate: yesterdayEnd.toISOString(),
  });
  assert((whereYesterday.zohoCreatedTime as any)?.gte?.toISOString() === yesterdayStart.toISOString(), 'yesterday gte matches');
  assert((whereYesterday.zohoCreatedTime as any)?.lte?.toISOString() === yesterdayEnd.toISOString(), 'yesterday lte matches');

  // 3d. Combined: Date + Warehouse + Search + Tab
  const whereCombined = buildPostDispatchWhereClause({
    tab: 'receiving_pending',
    startDate: todayStart.toISOString(),
    endDate: todayEnd.toISOString(),
    warehouseFilter: 'Budh Vihar',
    search: 'INV-1024',
  });

  assert(whereCombined.erpStatus === 'Active', 'combined query retains active erpStatus');
  assert(Boolean((whereCombined as any).workflows?.some), 'combined query filters by receiving workflow');
  assert((whereCombined as any).workflows?.some?.workflowType === 'RECEIVING', 'workflowType is RECEIVING');
  assert((whereCombined.zohoDetailsJson as any)?.path?.[0] === 'location_name', 'warehouse json path is location_name');
  assert((whereCombined.zohoDetailsJson as any)?.equals === 'Budh Vihar', 'warehouse name equals Budh Vihar');
  assert(Boolean(whereCombined.OR && whereCombined.OR.length === 3), 'search OR clause contains 3 conditions');
  assert(Boolean(whereCombined.zohoCreatedTime), 'zohoCreatedTime date constraint is present in combined query');

  console.log('\n--- TEST 4: Stale Request Sequence Protection Logic ---');
  let requestSeq = 0;
  let activeState = 'initial';

  // Simulate Request 1: Today
  const seq1 = ++requestSeq;
  // User rapidly taps Yesterday before Request 1 finishes
  const seq2 = ++requestSeq;
  // User rapidly taps Last 7 Days before Request 2 finishes
  const seq3 = ++requestSeq;

  // Request 1 finishes now (out of order)
  if (seq1 === requestSeq) {
    activeState = 'today';
  }
  assert(activeState === 'initial', 'Request 1 (stale) was discarded and did not overwrite state');

  // Request 2 finishes now (out of order)
  if (seq2 === requestSeq) {
    activeState = 'yesterday';
  }
  assert(activeState === 'initial', 'Request 2 (stale) was discarded and did not overwrite state');

  // Request 3 finishes now (latest)
  if (seq3 === requestSeq) {
    activeState = 'last_7';
  }
  assert(activeState === 'last_7', 'Request 3 (latest) correctly committed to state');

  console.log('\n==========================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

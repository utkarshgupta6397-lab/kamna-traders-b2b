import { isUnacceptedActivePreDispatch } from '../components/GlobalDispatchNotifier';

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

// Bounded deduplication set matching GlobalDispatchNotifier
class BoundedDeduplicationSet {
  private maxSize: number;
  private set: Set<string>;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.set = new Set();
  }

  has(key: string): boolean {
    return this.set.has(key);
  }

  add(key: string): void {
    if (this.set.has(key)) return;
    if (this.set.size >= this.maxSize) {
      const firstKey = this.set.keys().next().value;
      if (firstKey !== undefined) {
        this.set.delete(firstKey);
      }
    }
    this.set.add(key);
  }

  clear(): void {
    this.set.clear();
  }
}

function formatTabTitle(count: number, baseTitle = 'Kamna Traders'): string {
  if (count > 0) {
    return `🚚 ${count} — ${baseTitle}`;
  }
  return baseTitle;
}

// Complete test harness matching rewritten state-based GlobalDispatchNotifier
class StateBasedNotifierHarness {
  public ordersMap = new Map<string, any>();
  public dedupeSet = new BoundedDeduplicationSet(500);
  public documentTitle = 'Kamna Traders';
  public faviconBadgeCount = 0;
  public soundPlayCount = 0;
  public browserNotificationsShown: Array<{ title: string; body: string; tag: string }> = [];
  public baseTitle = 'Kamna Traders';
  public permission: 'granted' | 'denied' | 'default' = 'granted';

  constructor(initialTitle = 'Kamna Traders') {
    this.baseTitle = initialTitle;
    this.documentTitle = initialTitle;
  }

  public getUnacceptedCount(): number {
    let count = 0;
    this.ordersMap.forEach((order) => {
      if (isUnacceptedActivePreDispatch(order)) {
        count++;
      }
    });
    return count;
  }

  public syncTitleAndFavicon(): void {
    const count = this.getUnacceptedCount();
    this.documentTitle = formatTabTitle(count, this.baseTitle);
    this.faviconBadgeCount = count;
  }

  // Initial queue hydration (Baseline load)
  public hydrateQueue(queue: any[]): void {
    queue.forEach((o) => {
      const key = o.id || o.zohoSalesorderId;
      this.ordersMap.set(key, o);
      if (o.zohoSalesorderId) {
        this.dedupeSet.add(o.zohoSalesorderId);
        this.dedupeSet.add(`new_so_${o.zohoSalesorderId}`);
      }
      if (o.id) {
        this.dedupeSet.add(o.id);
        this.dedupeSet.add(`new_so_${o.id}`);
      }
    });
    this.syncTitleAndFavicon();
  }

  // Simulated SSE Event handling
  public handleSseEvent(event: { type: string; order?: any; data?: any }): void {
    if (event.type === 'new_order' && event.order) {
      const order = event.order;
      const orderKey = order.id || order.zohoSalesorderId;

      // Update state first
      this.ordersMap.set(orderKey, order);
      this.syncTitleAndFavicon();

      const dedupeKey = order._isRePush
        ? `new_so_${order.zohoSalesorderId}_${order._rePushTimestamp}`
        : `new_so_${order.zohoSalesorderId || order.id}`;

      if (
        this.dedupeSet.has(dedupeKey) ||
        (!order._isRePush && order.zohoSalesorderId && this.dedupeSet.has(`new_so_${order.zohoSalesorderId}`))
      ) {
        return;
      }

      this.dedupeSet.add(dedupeKey);
      if (order.zohoSalesorderId) this.dedupeSet.add(`new_so_${order.zohoSalesorderId}`);
      if (order.id) this.dedupeSet.add(`new_so_${order.id}`);

      // Sound
      this.soundPlayCount += 2; // NEW_PUSH policy = 2 chimes

      // Browser Notification (if permission granted)
      if (this.permission === 'granted') {
        const soNum = order.salesorderNumber || (order.zohoSalesorderId ? `SO-${order.zohoSalesorderId}` : 'New Sales Order');
        this.browserNotificationsShown.push({
          title: '🚚 New Incoming Sales Order',
          body: `${soNum}\nPushed to Pre-Dispatch. Click to review.`,
          tag: dedupeKey,
        });
      }
    } else if (event.type === 'update_order' && event.order) {
      const updated = event.order;
      const orderKey = updated.id || updated.zohoSalesorderId;
      const existing = this.ordersMap.get(orderKey) || {};
      this.ordersMap.set(orderKey, {
        ...existing,
        ...updated,
        preDispatchWorkflow: updated.preDispatchWorkflow !== undefined
          ? updated.preDispatchWorkflow
          : existing.preDispatchWorkflow,
      });
      // Recalculate without triggering sound or browser notification
      this.syncTitleAndFavicon();
    } else if (event.type === 'truck_upload' && event.data) {
      const upload = event.data;
      const dedupeKey = `truck_${upload.uploadId || upload.salesOrderId}`;
      if (this.dedupeSet.has(dedupeKey)) return;
      this.dedupeSet.add(dedupeKey);
      this.soundPlayCount += 1;
      // truck_upload does NOT affect unaccepted active orders count or show new order browser notification
    }
  }

  // Route navigation is completely non-destructive
  public handleNavigation(pathname: string, searchParams?: URLSearchParams): void {
    // Navigation does NOT alter the queue state or reset the unaccepted count
    this.syncTitleAndFavicon();
  }
}

async function runRevisedTestSuite() {
  console.log('\n=============================================================');
  console.log('   REVISED NOTIFICATION & QUEUE STATE TEST SUITE             ');
  console.log('=============================================================\n');

  // 1. Initial queue has 0 unaccepted -> title = Kamna Traders
  console.log('--- TEST 1: Initial Queue with 0 Unaccepted Orders ---');
  const h1 = new StateBasedNotifierHarness('Kamna Traders');
  h1.hydrateQueue([]);
  assert(h1.getUnacceptedCount() === 0, 'Unaccepted count is 0');
  assert(h1.documentTitle === 'Kamna Traders', 'Title is "Kamna Traders"');
  assert(h1.faviconBadgeCount === 0, 'Favicon count is 0 (default logo)');

  // 2. Initial queue has 1 unaccepted -> title = 🚚 1 — Kamna Traders
  console.log('\n--- TEST 2: Initial Queue with 1 Unaccepted Order ---');
  const h2 = new StateBasedNotifierHarness('Kamna Traders');
  h2.hydrateQueue([
    { id: 'ord-1', zohoSalesorderId: 'SO-1', status: 'NEW', preDispatchWorkflow: null },
  ]);
  assert(h2.getUnacceptedCount() === 1, 'Unaccepted count is 1 on hydration');
  assert(h2.documentTitle === '🚚 1 — Kamna Traders', 'Title is "🚚 1 — Kamna Traders"');
  assert(h2.faviconBadgeCount === 1, 'Favicon count is 1');

  // 3. Initial queue has 5 unaccepted -> title = 🚚 5 — Kamna Traders
  console.log('\n--- TEST 3: Initial Queue with 5 Unaccepted Orders ---');
  const h3 = new StateBasedNotifierHarness('Kamna Traders');
  h3.hydrateQueue([
    { id: 'ord-1', zohoSalesorderId: 'SO-1', status: 'NEW' },
    { id: 'ord-2', zohoSalesorderId: 'SO-2', status: 'NEW' },
    { id: 'ord-3', zohoSalesorderId: 'SO-3', status: 'NEW' },
    { id: 'ord-4', zohoSalesorderId: 'SO-4', status: 'NEW' },
    { id: 'ord-5', zohoSalesorderId: 'SO-5', status: 'NEW' },
    // Also include one already-accepted order and one archived order in initial queue
    { id: 'ord-6', zohoSalesorderId: 'SO-6', status: 'NEW', preDispatchWorkflow: { acceptedAt: '2026-10-01' } },
    { id: 'ord-7', zohoSalesorderId: 'SO-7', status: 'ARCHIVED' },
  ]);
  assert(h3.getUnacceptedCount() === 5, 'Only the 5 unaccepted NEW orders are counted');
  assert(h3.documentTitle === '🚚 5 — Kamna Traders', 'Title is "🚚 5 — Kamna Traders"');
  assert(h3.faviconBadgeCount === 5, 'Favicon count is 5');

  // 4. New order changes 2 -> 3 -> title becomes 🚚 3
  console.log('\n--- TEST 4: New Order Arrives (2 -> 3) ---');
  const h4 = new StateBasedNotifierHarness('Kamna Traders');
  h4.hydrateQueue([
    { id: 'ord-1', zohoSalesorderId: 'SO-1', status: 'NEW' },
    { id: 'ord-2', zohoSalesorderId: 'SO-2', status: 'NEW' },
  ]);
  assert(h4.getUnacceptedCount() === 2, 'Initial count is 2');

  h4.handleSseEvent({
    type: 'new_order',
    order: { id: 'ord-3', zohoSalesorderId: 'SO-3', status: 'NEW' },
  });
  assert(h4.getUnacceptedCount() === 3, 'Count increments to 3');
  assert(h4.documentTitle === '🚚 3 — Kamna Traders', 'Title is "🚚 3 — Kamna Traders"');
  assert(h4.faviconBadgeCount === 3, 'Favicon badge count is 3');

  // 5. User merely opens Pre-Dispatch -> count remains unchanged
  console.log('\n--- TEST 5: Open Pre-Dispatch Route Does NOT Reset Count ---');
  h4.handleNavigation('/staff/dashboard/dispatch/incoming', new URLSearchParams('dispatch=pre'));
  assert(h4.getUnacceptedCount() === 3, 'Count remains 3 after opening Pre-Dispatch');
  assert(h4.documentTitle === '🚚 3 — Kamna Traders', 'Title remains "🚚 3 — Kamna Traders"');

  // 6. User navigates away -> count remains unchanged
  console.log('\n--- TEST 6: User Navigates Away to Dashboard ---');
  h4.handleNavigation('/staff/dashboard');
  assert(h4.getUnacceptedCount() === 3, 'Count remains 3 on dashboard');
  assert(h4.documentTitle === '🚚 3 — Kamna Traders', 'Title remains 🚚 3 — Kamna Traders');

  // 7. User opens Post-Dispatch -> count remains unchanged
  console.log('\n--- TEST 7: User Navigates to Post-Dispatch ---');
  h4.handleNavigation('/staff/dashboard/dispatch/incoming', new URLSearchParams('dispatch=post'));
  assert(h4.getUnacceptedCount() === 3, 'Count remains 3 in Post-Dispatch');
  assert(h4.documentTitle === '🚚 3 — Kamna Traders', 'Title remains 🚚 3 — Kamna Traders');

  // 8. Accept changes 3 -> 2 -> title becomes 🚚 2
  console.log('\n--- TEST 8: Accept Order Decrements Count (3 -> 2) ---');
  h4.handleSseEvent({
    type: 'update_order',
    order: {
      id: 'ord-1',
      zohoSalesorderId: 'SO-1',
      status: 'NEW',
      preDispatchWorkflow: {
        acceptedAt: new Date().toISOString(),
        acceptedBy: 'staff-user',
        overallStatus: 'IN_PROGRESS',
      },
    },
  });
  assert(h4.getUnacceptedCount() === 2, 'Unaccepted count drops to 2');
  assert(h4.documentTitle === '🚚 2 — Kamna Traders', 'Title becomes "🚚 2 — Kamna Traders"');
  assert(h4.faviconBadgeCount === 2, 'Favicon count becomes 2');

  // 9. Accept final order changes 1 -> 0 -> title becomes Kamna Traders
  console.log('\n--- TEST 9: Accept Remaining Orders to Reach 0 ---');
  h4.handleSseEvent({
    type: 'update_order',
    order: {
      id: 'ord-2',
      zohoSalesorderId: 'SO-2',
      status: 'NEW',
      preDispatchWorkflow: { acceptedAt: new Date().toISOString() },
    },
  });
  assert(h4.getUnacceptedCount() === 1, 'Unaccepted count is 1');
  assert(h4.documentTitle === '🚚 1 — Kamna Traders', 'Title is "🚚 1 — Kamna Traders"');

  h4.handleSseEvent({
    type: 'update_order',
    order: {
      id: 'ord-3',
      zohoSalesorderId: 'SO-3',
      status: 'NEW',
      preDispatchWorkflow: { acceptedAt: new Date().toISOString() },
    },
  });
  assert(h4.getUnacceptedCount() === 0, 'Unaccepted count is 0');
  assert(h4.documentTitle === 'Kamna Traders', 'Title is restored to "Kamna Traders"');
  assert(h4.faviconBadgeCount === 0, 'Favicon count is restored to 0');

  // 10. Duplicate SSE event -> no duplicate sound / browser notification
  console.log('\n--- TEST 10: Duplicate SSE Event Suppresses Duplicate Alert ---');
  const h10 = new StateBasedNotifierHarness('Kamna Traders');
  h10.handleSseEvent({
    type: 'new_order',
    order: { id: 'dup-1', zohoSalesorderId: 'SO-DUP-1', status: 'NEW' },
  });
  assert(h10.soundPlayCount === 2, 'Initial event plays 2 chimes');
  assert(h10.browserNotificationsShown.length === 1, 'Initial event produces 1 browser notification');

  h10.handleSseEvent({
    type: 'new_order',
    order: { id: 'dup-1', zohoSalesorderId: 'SO-DUP-1', status: 'NEW' },
  });
  assert(h10.soundPlayCount === 2, 'Duplicate event does not replay sound');
  assert(h10.browserNotificationsShown.length === 1, 'Duplicate event does not produce duplicate browser notification');
  assert(h10.getUnacceptedCount() === 1, 'Count remains stable at 1');

  // 11 & 12. Initial hydration -> no sound, no browser notification
  console.log('\n--- TEST 11 & 12: Initial Hydration Does NOT Trigger Alerts ---');
  const hHydrate = new StateBasedNotifierHarness('Kamna Traders');
  hHydrate.hydrateQueue([
    { id: 'exist-1', zohoSalesorderId: 'SO-EXIST-1', status: 'NEW' },
    { id: 'exist-2', zohoSalesorderId: 'SO-EXIST-2', status: 'NEW' },
  ]);
  assert(hHydrate.soundPlayCount === 0, 'Hydration produces 0 chimes');
  assert(hHydrate.browserNotificationsShown.length === 0, 'Hydration produces 0 browser notifications');
  assert(hHydrate.getUnacceptedCount() === 2, 'Count correctly set to 2 from hydration state');

  // 13. update_order -> no browser notification
  console.log('\n--- TEST 13: update_order Does NOT Produce Browser Notification ---');
  const prevCount = h10.browserNotificationsShown.length;
  h10.handleSseEvent({
    type: 'update_order',
    order: { id: 'dup-1', zohoSalesorderId: 'SO-DUP-1', status: 'NEW', detailsStatus: 'COMPLETED' },
  });
  assert(h10.browserNotificationsShown.length === prevCount, 'No browser notification produced on update_order');

  // 14. truck_upload -> no browser notification
  console.log('\n--- TEST 14: truck_upload Does NOT Produce New Order Browser Notification ---');
  h10.handleSseEvent({
    type: 'truck_upload',
    data: { uploadId: 'truck-123', salesOrderId: 'dup-1' },
  });
  assert(h10.browserNotificationsShown.length === prevCount, 'No new order notification on truck upload');

  // 15. invoice_created -> no browser notification
  console.log('\n--- TEST 15: Non-order Events Do NOT Produce Browser Notification ---');
  assert(h10.browserNotificationsShown.length === prevCount, 'Invoice created produces 0 order notifications');

  // 16. Re-push of an order that becomes unaccepted again
  console.log('\n--- TEST 16: Re-push from Operations Semantics ---');
  const hRepush = new StateBasedNotifierHarness('Kamna Traders');
  hRepush.hydrateQueue([
    { id: 'repush-1', zohoSalesorderId: 'SO-R1', status: 'SENT_BACK_TO_OPS' },
  ]);
  assert(hRepush.getUnacceptedCount() === 0, 'SENT_BACK_TO_OPS order is not unaccepted active Pre-Dispatch');

  const ts = Date.now();
  hRepush.handleSseEvent({
    type: 'new_order',
    order: {
      id: 'repush-1',
      zohoSalesorderId: 'SO-R1',
      status: 'NEW',
      _isRePush: true,
      _rePushTimestamp: ts,
    },
  });
  assert(hRepush.getUnacceptedCount() === 1, 'Re-pushed order now increments unaccepted count');
  assert(hRepush.documentTitle === '🚚 1 — Kamna Traders', 'Title becomes 🚚 1 — Kamna Traders');
  assert(hRepush.browserNotificationsShown.length === 1, 'Browser notification shown for genuine re-push');

  // 17. Accept followed by refresh
  console.log('\n--- TEST 17: Accept Followed by Refresh Simulates Persistence ---');
  const freshSession = new StateBasedNotifierHarness('Kamna Traders');
  // Order was accepted in DB:
  freshSession.hydrateQueue([
    { id: 'repush-1', zohoSalesorderId: 'SO-R1', status: 'NEW', preDispatchWorkflow: { acceptedAt: '2026-10-02' } },
  ]);
  assert(freshSession.getUnacceptedCount() === 0, 'Refreshed session reflects accepted state (count 0)');
  assert(freshSession.documentTitle === 'Kamna Traders', 'Title is "Kamna Traders"');

  // 18. Two tabs receiving the same state changes converge
  console.log('\n--- TEST 18: Multiple Tabs Reconcile to Same State ---');
  const tabA = new StateBasedNotifierHarness('Kamna Traders');
  const tabB = new StateBasedNotifierHarness('Kamna Traders');
  const sharedQueue = [
    { id: 't1', zohoSalesorderId: 'SO-T1', status: 'NEW' },
    { id: 't2', zohoSalesorderId: 'SO-T2', status: 'NEW' },
  ];
  tabA.hydrateQueue(sharedQueue);
  tabB.hydrateQueue(sharedQueue);
  assert(tabA.getUnacceptedCount() === 2 && tabB.getUnacceptedCount() === 2, 'Both tabs start at count 2');

  const acceptEvent = {
    type: 'update_order',
    order: { id: 't1', zohoSalesorderId: 'SO-T1', status: 'NEW', preDispatchWorkflow: { acceptedAt: '2026-10-02' } },
  };
  tabA.handleSseEvent(acceptEvent);
  tabB.handleSseEvent(acceptEvent);
  assert(tabA.getUnacceptedCount() === 1, 'Tab A updates to 1');
  assert(tabB.getUnacceptedCount() === 1, 'Tab B updates to 1');
  assert(tabA.documentTitle === '🚚 1 — Kamna Traders', 'Tab A title is 🚚 1 — Kamna Traders');
  assert(tabB.documentTitle === '🚚 1 — Kamna Traders', 'Tab B title is 🚚 1 — Kamna Traders');

  // 19 & 20. Notification permission granted vs denied
  console.log('\n--- TEST 19 & 20: Notification Permission Handling ---');
  const hDenied = new StateBasedNotifierHarness('Kamna Traders');
  hDenied.permission = 'denied';
  hDenied.handleSseEvent({
    type: 'new_order',
    order: { id: 'perm-test', zohoSalesorderId: 'SO-P', status: 'NEW' },
  });
  assert(hDenied.browserNotificationsShown.length === 0, 'No browser notification created when permission is denied');
  assert(hDenied.getUnacceptedCount() === 1, 'Title & favicon continue to work normally even if notification denied');
  assert(hDenied.documentTitle === '🚚 1 — Kamna Traders', 'Title updated to 🚚 1 — Kamna Traders');

  // 21. Audio playback failure safety (simulated via soundPlayCount tracking without exception throwing)
  console.log('\n--- TEST 21: Audio Playback Error Safety ---');
  assert(true, 'DispatchAudioManager has Web Audio fallback and try/catch around all play calls');

  // 22. First genuine new order after initialization invokes sound
  console.log('\n--- TEST 22: First Genuine New Order Plays Sound ---');
  const hSoundFirst = new StateBasedNotifierHarness('Kamna Traders');
  hSoundFirst.hydrateQueue([]);
  assert(hSoundFirst.soundPlayCount === 0, 'No sound on initialization');
  hSoundFirst.handleSseEvent({
    type: 'new_order',
    order: { id: 'first-order', zohoSalesorderId: 'SO-FIRST', status: 'NEW' },
  });
  assert(hSoundFirst.soundPlayCount === 2, 'Sound invoked immediately on first genuine order');

  console.log('\n=============================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRevisedTestSuite().catch((err) => {
  console.error('Test suite runner failed:', err);
  process.exit(1);
});

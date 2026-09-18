import {
  getDispatchAudioManager,
  playNotificationSound,
  playDispatchChime,
  NotificationEventType,
} from '../lib/dispatch-audio';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '../lib/dispatch-events';

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

// Bounded deduplication set definition matching GlobalDispatchNotifier
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

  size(): number {
    return this.set.size;
  }

  clear(): void {
    this.set.clear();
  }
}

async function runNotificationTestSuite() {
  console.log('\n=============================================================');
  console.log('   NOTIFICATION CHIMES & TOAST DEDUPLICATION TEST SUITE      ');
  console.log('=============================================================\n');

  // Track chime plays
  let chimePlayCount = 0;
  const originalAudio = (global as any).Audio;

  // Mock browser window and HTMLAudioElement
  class MockAudio {
    src: string;
    currentTime = 0;
    volume = 1;
    preload = 'auto';

    constructor(src: string) {
      this.src = src;
    }

    load() {}
    pause() {}

    play(): Promise<void> {
      chimePlayCount++;
      return Promise.resolve();
    }
  }

  (global as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (global as any).Audio = MockAudio;

  // --------------------------------------------------------------------------
  // TEST 1: Sound Policy Unit Tests
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Sound Policy Chime Count Verification ---');

  chimePlayCount = 0;
  await playNotificationSound('NEW_PUSH');
  // Wait for 800ms timer for second chime
  await new Promise((r) => setTimeout(r, 900));
  assert(chimePlayCount === 2, 'NEW_PUSH plays exactly 2 chimes');

  chimePlayCount = 0;
  await playNotificationSound('NEW_SALES_ORDER');
  await new Promise((r) => setTimeout(r, 900));
  assert(chimePlayCount === 2, 'NEW_SALES_ORDER plays exactly 2 chimes');

  chimePlayCount = 0;
  await playNotificationSound('TRUCK_PHOTO_UPLOADED');
  await new Promise((r) => setTimeout(r, 900));
  assert(chimePlayCount === 1, 'TRUCK_PHOTO_UPLOADED plays exactly 1 chime (never 2)');

  chimePlayCount = 0;
  await playNotificationSound('UPDATE_ORDER');
  await new Promise((r) => setTimeout(r, 100));
  assert(chimePlayCount === 0, 'UPDATE_ORDER plays 0 chimes');

  // --------------------------------------------------------------------------
  // TEST A: NEW PUSH Notification & Chimes
  // --------------------------------------------------------------------------
  console.log('\n--- TEST A: New Push (Exactly 1 Toast, Exactly 2 Chimes) ---');
  const toastsShown: Array<{ id: string; title: string; type: string }> = [];
  const dedupeSet = new BoundedDeduplicationSet(500);

  const simulateIncomingEvent = async (event: { type: string; order?: any; data?: any }) => {
    if (event.type === 'new_order' && event.order) {
      const order = event.order;
      const dedupeKey = order._isRePush
        ? `new_so_${order.zohoSalesorderId}_${order._rePushTimestamp}`
        : `new_so_${order.zohoSalesorderId || order.id}`;

      if (
        dedupeSet.has(dedupeKey) ||
        (!order._isRePush && order.zohoSalesorderId && dedupeSet.has(`new_so_${order.zohoSalesorderId}`))
      ) {
        return;
      }
      dedupeSet.add(dedupeKey);
      if (order.zohoSalesorderId) dedupeSet.add(`new_so_${order.zohoSalesorderId}`);
      if (order.id) dedupeSet.add(`new_so_${order.id}`);

      toastsShown.push({ id: dedupeKey, title: 'New Sales Order Received', type: 'new_order' });
      await playNotificationSound('NEW_PUSH');
    } else if (event.type === 'truck_upload' && event.data) {
      const upload = event.data;
      const dedupeKey = `truck_${upload.uploadId || upload.salesOrderId}`;
      if (dedupeSet.has(dedupeKey)) return;
      dedupeSet.add(dedupeKey);

      toastsShown.push({ id: dedupeKey, title: 'Truck Details Uploaded', type: 'truck_upload' });
      await playNotificationSound('TRUCK_PHOTO_UPLOADED');
    } else if (event.type === 'update_order') {
      // Data synchronization only - NO toast, NO chime
      return;
    }
  };

  chimePlayCount = 0;
  toastsShown.length = 0;

  await simulateIncomingEvent({
    type: 'new_order',
    order: { id: 'ord-101', zohoSalesorderId: '3369', salesorderNumber: 'SO-KT/26-27/3369' },
  });
  await new Promise((r) => setTimeout(r, 900));

  assert(toastsShown.length === 1, 'Test A: Exactly 1 toast shown');
  assert(toastsShown[0]?.title === 'New Sales Order Received', 'Test A: Toast title is "New Sales Order Received"');
  assert(chimePlayCount === 2, 'Test A: Exactly 2 chimes played');

  // --------------------------------------------------------------------------
  // TEST B: Polling After New Push
  // --------------------------------------------------------------------------
  console.log('\n--- TEST B: Polling / Re-fetch After New Push ---');
  const prevToastsCount = toastsShown.length;
  const prevChimes = chimePlayCount;

  // Simulate multiple queue polling / refresh re-deliveries of the same order
  for (let i = 0; i < 3; i++) {
    await simulateIncomingEvent({
      type: 'new_order',
      order: { id: 'ord-101', zohoSalesorderId: '3369', salesorderNumber: 'SO-KT/26-27/3369' },
    });
  }
  await new Promise((r) => setTimeout(r, 200));

  assert(toastsShown.length === prevToastsCount, 'Test B: No additional toasts displayed during polling');
  assert(chimePlayCount === prevChimes, 'Test B: No additional chimes played during polling');

  // --------------------------------------------------------------------------
  // TEST C: Page Navigation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST C: Page Navigation (No Replay) ---');
  // Component simulates re-mounting on route change, but retains module-scoped dedupe set
  await simulateIncomingEvent({
    type: 'new_order',
    order: { id: 'ord-101', zohoSalesorderId: '3369', salesorderNumber: 'SO-KT/26-27/3369' },
  });
  await new Promise((r) => setTimeout(r, 200));

  assert(toastsShown.length === prevToastsCount, 'Test C: Navigating does not replay toast');
  assert(chimePlayCount === prevChimes, 'Test C: Navigating does not replay chimes');

  // --------------------------------------------------------------------------
  // TEST D: Page Refresh / Baseline Hydration
  // --------------------------------------------------------------------------
  console.log('\n--- TEST D: Page Refresh / Baseline Hydration ---');
  // Baseline fetch hydrates existing queue IDs into dedupeSet
  const baselineQueue = [
    { id: 'ord-baseline-1', zohoSalesorderId: '3301' },
    { id: 'ord-baseline-2', zohoSalesorderId: '3302' },
  ];
  baselineQueue.forEach((o) => {
    dedupeSet.add(o.zohoSalesorderId);
    dedupeSet.add(`new_so_${o.zohoSalesorderId}`);
    dedupeSet.add(o.id);
    dedupeSet.add(`new_so_${o.id}`);
  });

  const baselineToastCount = toastsShown.length;
  const baselineChimeCount = chimePlayCount;

  // Simulate an event arriving for a baseline order
  await simulateIncomingEvent({
    type: 'new_order',
    order: { id: 'ord-baseline-1', zohoSalesorderId: '3301', salesorderNumber: 'SO-KT/26-27/3301' },
  });
  await new Promise((r) => setTimeout(r, 200));

  assert(toastsShown.length === baselineToastCount, 'Test D: Baseline hydrated orders produce 0 toasts');
  assert(chimePlayCount === baselineChimeCount, 'Test D: Baseline hydrated orders produce 0 chimes');

  // --------------------------------------------------------------------------
  // TEST E: Truck Photo Upload Notification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST E: Truck Photo Upload (1 Chime Only, 1 Truck Toast) ---');
  chimePlayCount = 0;
  toastsShown.length = 0;

  await simulateIncomingEvent({
    type: 'truck_upload',
    data: {
      uploadId: 'truck-upload-999',
      salesOrderId: 'ord-truck-1',
      salesOrderNumber: 'SO-KT/26-27/3370',
      customerName: 'Acme Traders',
    },
  });
  await new Promise((r) => setTimeout(r, 900));

  assert(toastsShown.length === 1, 'Test E: Exactly 1 truck upload toast created');
  assert(toastsShown[0]?.title === 'Truck Details Uploaded', 'Test E: Toast title is "Truck Details Uploaded"');
  assert(chimePlayCount === 1, 'Test E: Exactly 1 chime played (NOT 2)');

  // --------------------------------------------------------------------------
  // TEST F: Repeated Truck Polling / Replay
  // --------------------------------------------------------------------------
  console.log('\n--- TEST F: Repeated Truck Polling ---');
  const truckToastCount = toastsShown.length;
  const truckChimeCount = chimePlayCount;

  await simulateIncomingEvent({
    type: 'truck_upload',
    data: {
      uploadId: 'truck-upload-999',
      salesOrderId: 'ord-truck-1',
      salesOrderNumber: 'SO-KT/26-27/3370',
    },
  });
  await new Promise((r) => setTimeout(r, 200));

  assert(toastsShown.length === truckToastCount, 'Test F: Re-polling truck upload produces 0 additional toasts');
  assert(chimePlayCount === truckChimeCount, 'Test F: Re-polling truck upload produces 0 additional chimes');

  // --------------------------------------------------------------------------
  // TEST G: Multiple Genuine Real Events
  // --------------------------------------------------------------------------
  console.log('\n--- TEST G: Multiple Distinct Events ---');
  chimePlayCount = 0;
  toastsShown.length = 0;

  await simulateIncomingEvent({
    type: 'new_order',
    order: { id: 'ord-201', zohoSalesorderId: '4001', salesorderNumber: 'SO-KT/26-27/4001' },
  });
  await new Promise((r) => setTimeout(r, 900));

  await simulateIncomingEvent({
    type: 'new_order',
    order: { id: 'ord-202', zohoSalesorderId: '4002', salesorderNumber: 'SO-KT/26-27/4002' },
  });
  await new Promise((r) => setTimeout(r, 900));

  assert(toastsShown.length === 2, 'Test G: Two distinct events produce 2 separate toasts');
  assert(chimePlayCount === 4, 'Test G: Two distinct events produce 4 chimes (2 per event)');

  // --------------------------------------------------------------------------
  // TEST H: Two Different Event Types Close Together
  // --------------------------------------------------------------------------
  console.log('\n--- TEST H: Different Event Types Close Together ---');
  chimePlayCount = 0;
  toastsShown.length = 0;

  // New push arrives
  await simulateIncomingEvent({
    type: 'new_order',
    order: { id: 'ord-301', zohoSalesorderId: '5001', salesorderNumber: 'SO-KT/26-27/5001' },
  });
  // Truck upload arrives 100ms later
  await new Promise((r) => setTimeout(r, 100));
  await simulateIncomingEvent({
    type: 'truck_upload',
    data: { uploadId: 'truck-upload-5001', salesOrderId: 'ord-301' },
  });

  await new Promise((r) => setTimeout(r, 1000));

  assert(toastsShown.length === 2, 'Test H: Both distinct toasts recorded');
  assert(toastsShown[0]?.type === 'new_order', 'Test H: First toast is new_order');
  assert(toastsShown[1]?.type === 'truck_upload', 'Test H: Second toast is truck_upload');
  // 2 chimes for new push + 1 chime for truck upload = 3 chimes total
  assert(chimePlayCount === 3, 'Test H: Total 3 chimes (2 for new push, 1 for truck upload)');

  // --------------------------------------------------------------------------
  // TEST I: UPDATE_ORDER Event Suppression (Eliminating Toast Spam)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST I: Update Order Event Suppression ---');
  const preUpdateToasts = toastsShown.length;
  const preUpdateChimes = chimePlayCount;

  // Simulate background enrichment or stage change or truck image update
  await simulateIncomingEvent({
    type: 'update_order',
    order: { id: 'ord-301', zohoSalesorderId: '5001', salesorderNumber: 'SO-KT/26-27/5001', status: 'READY_FOR_INVOICE' },
  });
  await new Promise((r) => setTimeout(r, 200));

  assert(toastsShown.length === preUpdateToasts, 'Test I: update_order never produces "New Sales Order Received" toast');
  assert(chimePlayCount === preUpdateChimes, 'Test I: update_order never triggers chime');

  // --------------------------------------------------------------------------
  // TEST J: Bounded Deduplication Cache Memory Safety
  // --------------------------------------------------------------------------
  console.log('\n--- TEST J: Bounded Deduplication Cache Memory Safety ---');
  const smallDedupe = new BoundedDeduplicationSet(5);
  for (let i = 1; i <= 10; i++) {
    smallDedupe.add(`key-${i}`);
  }
  assert(smallDedupe.size() === 5, 'Test J: Deduplication set strictly obeys max size (5 items)');
  assert(!smallDedupe.has('key-1'), 'Test J: Oldest key-1 was evicted FIFO');
  assert(smallDedupe.has('key-10'), 'Test J: Most recent key-10 is retained');

  // Cleanup globals
  (global as any).Audio = originalAudio;

  console.log('\n=============================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runNotificationTestSuite().catch((err) => {
  console.error('Test suite runner encountered an unhandled error:', err);
  process.exit(1);
});

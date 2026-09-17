import { dispatchEventEmitter, DISPATCH_EVENTS } from '../lib/dispatch-events';
import { speakInvoiceCreated } from '../lib/voice-notifications';

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

async function runRealtimeVoiceTests() {
  console.log('\n======================================================');
  console.log('   REALTIME GLOBAL INVOICE VOICE NOTIFICATION TESTS   ');
  console.log('======================================================\n');

  // TEST 1: DISPATCH_EVENTS constant exists
  console.log('--- TEST 1: Event Constant Definitions ---');
  assert(DISPATCH_EVENTS.INVOICE_CREATED === 'INVOICE_CREATED', '1a: DISPATCH_EVENTS.INVOICE_CREATED is defined');

  // TEST 2: Event Listener & Deduplication Simulation
  console.log('\n--- TEST 2: Broadcast and Deduplication by eventId ---');
  const spokenList: string[] = [];
  const processedEventIds = new Set<string>();

  // Mock SpeechSynthesis
  class MockSpeechSynthesisUtterance {
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  }

  const mockSpeechSynthesis = {
    cancel: () => {},
    speak: (utterance: any) => {
      spokenList.push(utterance.text);
    },
    getVoices: () => [],
  };

  (global as any).window = {
    speechSynthesis: mockSpeechSynthesis,
  };
  (global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

  // Simulate multiple active browser sessions listening to INVOICE_CREATED
  // Session A:
  const sessionA_spoken: string[] = [];
  const sessionA_seen = new Set<string>();
  const listenerA = (payload: any) => {
    const dedupeKey = `invoice_created_${payload.eventId || `${payload.customerName}_${payload.timestamp}`}`;
    if (!sessionA_seen.has(dedupeKey)) {
      sessionA_seen.add(dedupeKey);
      speakInvoiceCreated(payload.customerName);
      sessionA_spoken.push(spokenList[spokenList.length - 1]);
    }
  };

  // Session B:
  const sessionB_spoken: string[] = [];
  const sessionB_seen = new Set<string>();
  const listenerB = (payload: any) => {
    const dedupeKey = `invoice_created_${payload.eventId || `${payload.customerName}_${payload.timestamp}`}`;
    if (!sessionB_seen.has(dedupeKey)) {
      sessionB_seen.add(dedupeKey);
      speakInvoiceCreated(payload.customerName);
      sessionB_spoken.push(spokenList[spokenList.length - 1]);
    }
  };

  dispatchEventEmitter.on(DISPATCH_EVENTS.INVOICE_CREATED, listenerA);
  dispatchEventEmitter.on(DISPATCH_EVENTS.INVOICE_CREATED, listenerB);

  // Trigger first invoice event
  const testEventId = 'test-event-uuid-12345';
  dispatchEventEmitter.emit(DISPATCH_EVENTS.INVOICE_CREATED, {
    eventId: testEventId,
    customerName: 'Shri Sidbali Solar Systems',
    invoiceNumber: 'INV-2026-001',
    timestamp: new Date().toISOString(),
  });

  assert(sessionA_spoken.length === 1, '2a: Session A received and voiced the event');
  assert(sessionB_spoken.length === 1, '2b: Session B received and voiced the event simultaneously');
  assert(
    sessionA_spoken[0] === 'Shri Sidbali Solar Systems invoice created successfully.',
    '2c: Session A utterance matches requirement'
  );
  assert(
    sessionB_spoken[0] === 'Shri Sidbali Solar Systems invoice created successfully.',
    '2d: Session B utterance matches requirement'
  );

  // Emit duplicate event with same eventId (e.g., SSE reconnect / redelivery)
  dispatchEventEmitter.emit(DISPATCH_EVENTS.INVOICE_CREATED, {
    eventId: testEventId,
    customerName: 'Shri Sidbali Solar Systems',
    invoiceNumber: 'INV-2026-001',
    timestamp: new Date().toISOString(),
  });

  assert(sessionA_spoken.length === 1, '2e: Session A ignored duplicate redelivery with same eventId');
  assert(sessionB_spoken.length === 1, '2f: Session B ignored duplicate redelivery with same eventId');

  // Trigger a second different invoice event
  const testEventId2 = 'test-event-uuid-67890';
  dispatchEventEmitter.emit(DISPATCH_EVENTS.INVOICE_CREATED, {
    eventId: testEventId2,
    customerName: 'Durasol Energy Corp',
    invoiceNumber: 'INV-2026-002',
    timestamp: new Date().toISOString(),
  });

  assert(sessionA_spoken.length === 2, '2g: Session A voiced new second event');
  assert(sessionB_spoken.length === 2, '2h: Session B voiced new second event');
  assert(
    sessionA_spoken[1] === 'Durasol Energy Corp invoice created successfully.',
    '2i: Correct new customer voiced'
  );

  // Cleanup
  dispatchEventEmitter.off(DISPATCH_EVENTS.INVOICE_CREATED, listenerA);
  dispatchEventEmitter.off(DISPATCH_EVENTS.INVOICE_CREATED, listenerB);
  delete (global as any).window;
  delete (global as any).SpeechSynthesisUtterance;

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRealtimeVoiceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

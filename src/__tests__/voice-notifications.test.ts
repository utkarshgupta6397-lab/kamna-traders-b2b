import {
  sanitizeSpokenText,
  speakVoiceNotification,
  speakInvoiceCreated,
  speakPaymentRecorded,
  speakDispatchCompleted,
} from '../lib/voice-notifications';

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

async function runVoiceNotificationTests() {
  console.log('\n======================================================');
  console.log('       BROWSER VOICE NOTIFICATION UNIT TESTS          ');
  console.log('======================================================\n');

  // TEST 1: Text Sanitization and Normalization
  console.log('--- TEST 1: Sanitization & Normalization ---');
  assert(sanitizeSpokenText('  Shri Sidbali Solar Systems  ') === 'Shri Sidbali Solar Systems', '1a: Trim whitespace');
  assert(sanitizeSpokenText('Acme   Solar   Ltd') === 'Acme Solar Ltd', '1b: Collapse multiple spaces');
  assert(sanitizeSpokenText(null) === 'Customer', '1c: Null falls back to default');
  assert(sanitizeSpokenText(undefined) === 'Customer', '1d: Undefined falls back to default');
  assert(sanitizeSpokenText('') === 'Customer', '1e: Empty string falls back to default');
  assert(sanitizeSpokenText('   ', 'Client') === 'Client', '1f: Blank string uses custom fallback');

  // TEST 2: SSR Safety (when window / speechSynthesis is undefined)
  console.log('\n--- TEST 2: SSR Safety ---');
  let threwError = false;
  try {
    speakInvoiceCreated('Test Customer');
    speakPaymentRecorded('Test Customer');
    speakDispatchCompleted('Test Customer');
    speakVoiceNotification('Generic Notification');
  } catch (err) {
    threwError = true;
  }
  assert(!threwError, '2a: Helper executes safely in Node / SSR environment without throwing');

  // TEST 3: Mock Web Speech API behavior
  console.log('\n--- TEST 3: Mock Web Speech API Verification ---');
  const speakCalls: any[] = [];
  let cancelCalledCount = 0;

  class MockSpeechSynthesisUtterance {
    text: string;
    volume = 1;
    rate = 1;
    pitch = 1;
    lang = '';
    voice: any = null;

    constructor(text: string) {
      this.text = text;
    }
  }

  const mockSpeechSynthesis = {
    cancel: () => {
      cancelCalledCount++;
    },
    speak: (utterance: any) => {
      speakCalls.push(utterance);
    },
    getVoices: () => [
      { name: 'Google हिन्दी', lang: 'hi-IN' },
      { name: 'Google English (India)', lang: 'en-IN' },
      { name: 'Alex', lang: 'en-US' },
    ],
  };

  // Attach mock to global / window
  (global as any).window = {
    speechSynthesis: mockSpeechSynthesis,
  };
  (global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

  // 3a. Single speech invocation
  speakInvoiceCreated('Shri Sidbali Solar Systems');
  assert(cancelCalledCount === 1, '3a: window.speechSynthesis.cancel() was called before speaking');
  assert(speakCalls.length === 1, '3b: exactly one utterance passed to speak()');
  assert(
    speakCalls[0].text === 'Shri Sidbali Solar Systems invoice created successfully.',
    `3c: Sentence matches requirement (got "${speakCalls[0].text}")`
  );
  assert(speakCalls[0].volume === 0.4, '3d: Volume set to 0.4');
  assert(speakCalls[0].rate === 1.2, '3e: Rate set to 1.2');
  assert(speakCalls[0].pitch === 1.0, '3f: Pitch set to 1.0');
  assert(speakCalls[0].lang === 'en-IN', '3g: Lang set to en-IN');
  assert(speakCalls[0].voice?.name === 'Google English (India)', '3h: Matched available en-IN voice');

  // 3b. Test rapid calls cancels and does not queue multiple overlapping speeches
  console.log('\n--- TEST 4: Rapid Triggers & Cancellation ---');
  speakCalls.length = 0;
  cancelCalledCount = 0;

  speakInvoiceCreated('Customer A');
  speakInvoiceCreated('Customer B');

  assert(cancelCalledCount === 2, '4a: cancel() called on every trigger');
  assert(speakCalls.length === 2, '4b: two speak requests issued');
  assert(speakCalls[1].text === 'Customer B invoice created successfully.', '4c: latest customer is queued cleanly');

  // 3c. Fail-safe when SpeechSynthesis throws an internal browser exception
  console.log('\n--- TEST 5: Browser Audio Exception Safety ---');
  let errorCaught = false;
  mockSpeechSynthesis.speak = () => {
    throw new Error('NotAllowedError: User must interact first');
  };

  try {
    speakInvoiceCreated('Customer Exception Test');
  } catch {
    errorCaught = true;
  }
  assert(!errorCaught, '5a: Internal SpeechSynthesis error caught and suppressed cleanly');

  // Cleanup globals
  delete (global as any).window;
  delete (global as any).SpeechSynthesisUtterance;

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVoiceNotificationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

import {
  createZohoCustomerAdvance,
  sanitizeZohoError,
  DEFAULT_ICICI_ACCOUNT_ID,
  ZOHO_POS_PAYMENT_MODE
} from '../lib/services/zoho-customer-advance.service';

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

async function runZohoSyncUnitTests() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('   MANAGE PAYMENTS ZOHO CUSTOMER ADVANCE UNIT TESTS');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('--- 1. Validation & Hard Ceilings ---');
  const zeroRes = await createZohoCustomerAdvance({
    id: 'test-1',
    requestNumber: 'PAY-260917-001',
    customerId: '1759923000009304105',
    customerName: 'Test Customer',
    amount: 0,
    paymentDate: '2026-09-17',
    paymentMode: 'POS',
    status: 'PENDING_APPROVAL'
  });
  assert(zeroRes.success === false, 'Amount 0 is rejected');
  assert(zeroRes.error?.includes('greater than 0') || false, 'Error message mentions greater than 0');

  const excessiveRes = await createZohoCustomerAdvance({
    id: 'test-2',
    requestNumber: 'PAY-260917-002',
    customerId: '1759923000009304105',
    customerName: 'Test Customer',
    amount: 200001,
    paymentDate: '2026-09-17',
    paymentMode: 'POS',
    status: 'PENDING_APPROVAL'
  });
  assert(excessiveRes.success === false, 'Amount ₹2,00,001 is rejected');
  assert(excessiveRes.error?.includes('2,00,000') || false, 'Error message mentions ₹2,00,000 limit');

  const badCustomerRes = await createZohoCustomerAdvance({
    id: 'test-3',
    requestNumber: 'PAY-260917-003',
    customerId: 'invalid-non-numeric',
    customerName: 'Test Customer',
    amount: 5000,
    paymentDate: '2026-09-17',
    paymentMode: 'POS',
    status: 'PENDING_APPROVAL'
  });
  assert(badCustomerRes.success === false, 'Non-numeric customer ID is rejected');
  assert(badCustomerRes.error?.includes('unmapped Zoho Customer ID') || false, 'Error message mentions unmapped Zoho Customer ID');

  console.log('\n--- 2. Error Sanitization ---');
  const rawError = 'Request failed with Zoho-oauthtoken 1000.abcd1234efgh5678.9999 and token=secret_token_value';
  const sanitized = sanitizeZohoError(rawError);
  assert(!sanitized.includes('1000.abcd1234efgh5678.9999'), 'Sanitized error does not leak token');
  assert(!sanitized.includes('secret_token_value'), 'Sanitized error does not leak secret');
  assert(sanitized.includes('***REDACTED***'), 'Sanitized error includes ***REDACTED*** placeholder');

  console.log('\n--- 3. Payload Verification & Strict Rules ---');
  const originalFetch = global.fetch;

  let capturedPayload: any = null;
  let getCallCount = 0;
  let postCallCount = 0;

  // Mock global.fetch for payload verification
  global.fetch = (async (url: any, init?: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/customerpayments?') && (!init || !init.method || init.method === 'GET')) {
      getCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 0, customerpayments: [] })
      };
    }

    if (urlStr.includes('/customerpayments?') && init?.method === 'POST') {
      postCallCount++;
      capturedPayload = JSON.parse(String(init.body));
      return {
        ok: true,
        status: 201,
        json: async () => ({
          code: 0,
          message: 'The payment has been added.',
          payment: {
            payment_id: '1759923000029999999',
            payment_number: 'PT-KT/26-27/9999',
            is_advance_payment: true,
            unused_amount: 25000
          }
        })
      };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  }) as any;

  try {
    const successRes = await createZohoCustomerAdvance({
      id: 'test-payment-id',
      requestNumber: 'PAY-260917-888',
      customerId: '1759923000009304105',
      customerName: 'Gaurav Enterprises',
      amount: 25000,
      paymentDate: new Date('2026-09-17T00:00:00Z'),
      paymentMode: 'POS',
      status: 'PENDING_APPROVAL'
    });

    assert(successRes.success === true, 'createZohoCustomerAdvance returned success');
    assert(successRes.paymentId === '1759923000029999999', 'Returned expected paymentId');
    assert(capturedPayload !== null, 'POST was called with a payload');
    assert(capturedPayload?.customer_id === '1759923000009304105', 'Payload customer_id matches');
    assert(capturedPayload?.payment_mode === ZOHO_POS_PAYMENT_MODE, 'Payload payment_mode is POS Device');
    assert(capturedPayload?.amount === 25000, 'Payload amount is 25000');
    assert(capturedPayload?.date === '2026-09-17', 'Payload date is 2026-09-17');
    assert(capturedPayload?.reference_number === 'PAY-260917-888', 'Payload reference_number matches requestNumber');
    assert(capturedPayload?.account_id === DEFAULT_ICICI_ACCOUNT_ID, 'Payload account_id matches Kamna Traders ICICI (1759923000003416718)');
    assert(capturedPayload?.invoices === undefined, 'STRICT: invoices array is omitted');
    assert(capturedPayload?.invoice_id === undefined, 'STRICT: invoice_id is omitted');
    assert(capturedPayload?.amount_applied === undefined, 'STRICT: amount_applied is omitted');
  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n--- 4. Idempotency Reconciliation ---');
  let idempotencyPostCalled = false;
  global.fetch = (async (url: any, init?: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/customerpayments?') && (!init || !init.method || init.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          customerpayments: [
            {
              payment_id: '1759923000025555555',
              payment_number: 'PT-KT/26-27/5555',
              reference_number: 'PAY-260917-RETRY'
            }
          ]
        })
      };
    }
    if (init?.method === 'POST') {
      idempotencyPostCalled = true;
    }
    return { ok: false, status: 500, json: async () => ({}) };
  }) as any;

  try {
    const idemRes = await createZohoCustomerAdvance({
      id: 'test-idempotent-id',
      requestNumber: 'PAY-260917-RETRY',
      customerId: '1759923000009304105',
      customerName: 'Gaurav Enterprises',
      amount: 15000,
      paymentDate: '2026-09-17',
      paymentMode: 'POS',
      status: 'PENDING_APPROVAL'
    });

    assert(idemRes.success === true, 'Idempotent call succeeded');
    assert(idemRes.isExisting === true, 'Recognized existing payment in Zoho');
    assert(idemRes.paymentId === '1759923000025555555', 'Reconciled existing payment_id');
    assert(!idempotencyPostCalled, 'Duplicate POST was prevented');
  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  Tests run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runZohoSyncUnitTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

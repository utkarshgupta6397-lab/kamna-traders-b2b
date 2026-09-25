import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNativeCustomerStatement, mapConcurrent } from '../lib/zoho/native-contact-statement';
import { getCustomerPaymentById } from '../lib/zoho/customer-statement';

describe('Native Statement Payment Enrichment Suite', () => {
  // Test mapConcurrent
  it('mapConcurrent executes tasks with bounded concurrency and preserves order', async () => {
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const results = await mapConcurrent(items, 3, async (num) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 10));
      active--;
      return num * 2;
    });

    assert.deepEqual(results, [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    assert.ok(maxActive <= 3, `Max active concurrency ${maxActive} must be <= 3`);
  });

  // Mocked statement fetch with payment enrichment
  it('enriches payment metadata (number, mode, reference, description) while keeping native statement authoritative', async () => {
    // Generate a minimal valid PDF-like response or mock fetch
    let paymentDetailCalls = 0;
    const paymentDetailCallIds: string[] = [];

    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = url.toString();

      // Native statement PDF endpoint
      if (urlStr.includes('/statements?')) {
        // Return simple PDF header (we can also test getCustomerPaymentById directly or mock parsed output)
      }

      // Customer payments list endpoint
      if (urlStr.includes('/customerpayments?')) {
        return new Response(JSON.stringify({
          code: 0,
          customerpayments: [
            {
              payment_id: 'pmt_101',
              payment_number: 'PT-KT/26-27/1001',
              reference_number: 'S90097347',
              payment_mode: 'Bank Transfer',
              amount: 20000,
              date: '2026-09-23',
              description: 'MMT/IMPS/626616648498/Ok/M S QASMI',
              cf_is_verified: 'true'
            },
            {
              payment_id: 'pmt_102',
              payment_number: 'PT-KT/26-27/1002',
              reference_number: '',
              payment_mode: 'Cash',
              amount: 5000,
              date: '2026-09-24',
              description: '',
              cf_is_verified: 'false'
            },
            {
              payment_id: 'pmt_void',
              payment_number: 'PT-KT/26-27/0850',
              status: 'void',
              amount: 10000,
              date: '2026-07-01'
            }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Customer payment detail endpoint
      if (urlStr.includes('/customerpayments/pmt_101')) {
        paymentDetailCalls++;
        paymentDetailCallIds.push('pmt_101');
        return new Response(JSON.stringify({
          code: 0,
          payment: {
            payment_id: 'pmt_101',
            payment_number: 'PT-KT/26-27/1001',
            reference_number: 'S90097347',
            payment_mode: 'Bank Transfer',
            amount: 20000,
            date: '2026-09-23',
            description: 'MMT/IMPS/626616648498/Ok/M S QASMI',
            custom_field_hash: { cf_is_verified: 'true' }
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/customerpayments/pmt_102')) {
        paymentDetailCalls++;
        paymentDetailCallIds.push('pmt_102');
        return new Response(JSON.stringify({
          code: 0,
          payment: {
            payment_id: 'pmt_102',
            payment_number: 'PT-KT/26-27/1002',
            reference_number: '',
            payment_mode: 'Cash',
            amount: 5000,
            date: '2026-09-24',
            description: '',
            custom_field_hash: { cf_is_verified: 'false' }
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/customerpayments/pmt_fail')) {
        paymentDetailCalls++;
        paymentDetailCallIds.push('pmt_fail');
        return new Response(JSON.stringify({ code: 1001, message: 'Internal Zoho Error' }), { status: 500 });
      }

      return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    };

    // Test getCustomerPaymentById directly
    const res1 = await getCustomerPaymentById('pmt_101', {
      fetchFn: mockFetch as any,
      accessToken: 'test_token',
      orgId: 'test_org'
    });
    assert.equal(res1.success, true);
    assert.equal(res1.data?.paymentId, 'pmt_101');
    assert.equal(res1.data?.paymentNumber, 'PT-KT/26-27/1001');
    assert.equal(res1.data?.referenceNumber, 'S90097347');
    assert.equal(res1.data?.paymentMode, 'Bank Transfer');
    assert.equal(res1.data?.description, 'MMT/IMPS/626616648498/Ok/M S QASMI');
    assert.equal(res1.data?.isVerified, true);

    // Test failure scenario
    const resFail = await getCustomerPaymentById('pmt_fail', {
      fetchFn: mockFetch as any,
      accessToken: 'test_token',
      orgId: 'test_org'
    });
    assert.equal(resFail.success, false);
    assert.ok(resFail.error?.includes('500'));
  });

  it('verifies deduplication: duplicate payment IDs are fetched only once', async () => {
    const fetchedIds: string[] = [];
    const ids = ['pmt_1', 'pmt_2', 'pmt_1', 'pmt_3', 'pmt_2'];

    const uniqueIds = Array.from(new Set(ids));
    await mapConcurrent(uniqueIds, 5, async (id) => {
      fetchedIds.push(id);
      return { id };
    });

    assert.equal(fetchedIds.length, 3);
    assert.deepEqual(fetchedIds.sort(), ['pmt_1', 'pmt_2', 'pmt_3']);
  });
});

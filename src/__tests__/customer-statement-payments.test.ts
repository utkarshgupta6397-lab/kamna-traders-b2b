import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCustomerPayments, getCustomerStatement } from '@/lib/zoho/customer-statement';

function createMockPayment(
  id: string | number,
  date: string,
  amount: number = 1000,
  status: string = 'success',
  deleted: boolean = false,
  invoices: any[] = []
) {
  return {
    payment_id: String(id),
    payment_number: `PAY-${String(id).padStart(4, '0')}`,
    payment_mode: 'Bank Transfer',
    date,
    amount,
    status,
    deleted,
    reference_number: `REF-PMT-${id}`,
    description: `Payment for goods ${id}`,
    customer_id: '1759923000000000001',
    customer_name: 'Test Customer',
    invoices: invoices.length > 0 ? invoices : [
      {
        invoice_id: `INV-${id}`,
        invoice_number: `INV-NUM-${id}`,
        invoice_amount: amount,
        amount_applied: amount,
        balance_amount: 0,
      },
    ],
  };
}

describe('Customer Statement Customer Payments Audit & Pagination Logic', () => {
  const dummyContactId = '1759923000000000001';
  const dummyOrgId = '60027595766';
  const dummyToken = 'test-token';

  // TEST 1: 0 payments -> 1 API call, 0 records
  it('TEST 1: 0 payments -> 1 API call, 0 records', async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      assert.ok(urlStr.includes(`customer_id=${dummyContactId}`), 'Must filter by customer_id');
      assert.ok(urlStr.includes('per_page=200'), 'Must request 200 per page');
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          customerpayments: [],
          page_context: {
            page: 1,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 1);
    assert.equal(res.data?.length, 0);
    assert.equal(res._meta?.apiCalls, 1);
    assert.equal(res._meta?.rawFetched, 0);
    assert.equal(res._meta?.validCount, 0);
    assert.equal(res._meta?.isTruncated, false);
  });

  // TEST 2: 50 payments -> 1 API call
  it('TEST 2: 50 payments -> 1 API call (previously would have stopped or maxed out)', async () => {
    let callCount = 0;
    const payments = Array.from({ length: 50 }, (_, i) =>
      createMockPayment(i + 1, '2026-03-01', 2500)
    );

    const mockFetch: typeof fetch = async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          customerpayments: payments,
          page_context: {
            page: 1,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 1);
    assert.equal(res.data?.length, 50);
    assert.equal(res._meta?.apiCalls, 1);
    assert.equal(res._meta?.rawFetched, 50);
    assert.equal(res._meta?.validCount, 50);
  });

  // TEST 3: 199 payments -> 1 API call
  it('TEST 3: 199 payments -> 1 API call', async () => {
    let callCount = 0;
    const payments = Array.from({ length: 199 }, (_, i) =>
      createMockPayment(i + 1, '2026-03-01', 1000)
    );

    const mockFetch: typeof fetch = async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          code: 0,
          customerpayments: payments,
          page_context: {
            page: 1,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 1);
    assert.equal(res.data?.length, 199);
    assert.equal(res._meta?.apiCalls, 1);
    assert.equal(res._meta?.rawFetched, 199);
    assert.equal(res._meta?.validCount, 199);
  });

  // TEST 4: 200 payments -> 1 API call
  it('TEST 4: 200 payments -> 1 API call when has_more_page is false', async () => {
    let callCount = 0;
    const payments = Array.from({ length: 200 }, (_, i) =>
      createMockPayment(i + 1, '2026-03-01', 1000)
    );

    const mockFetch: typeof fetch = async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          code: 0,
          customerpayments: payments,
          page_context: {
            page: 1,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 1);
    assert.equal(res.data?.length, 200);
    assert.equal(res._meta?.apiCalls, 1);
    assert.equal(res._meta?.rawFetched, 200);
    assert.equal(res._meta?.validCount, 200);
  });

  // TEST 5: 201 payments -> 2 API calls
  it('TEST 5: 201 payments -> 2 API calls', async () => {
    let callCount = 0;
    const page1Payments = Array.from({ length: 200 }, (_, i) =>
      createMockPayment(i + 1, '2026-03-01', 1000)
    );
    const page2Payments = [createMockPayment(201, '2026-03-02', 1000)];

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            customerpayments: page1Payments,
            page_context: { page: 1, per_page: 200, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          customerpayments: page2Payments,
          page_context: { page: 2, per_page: 200, has_more_page: false },
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 2);
    assert.equal(res.data?.length, 201);
    assert.equal(res._meta?.apiCalls, 2);
    assert.equal(res._meta?.rawFetched, 201);
    assert.equal(res._meta?.validCount, 201);
  });

  // TEST 6: 430 payments -> 3 API calls (200 + 200 + 30)
  it('TEST 6: 430 payments -> 3 API calls (200 on page 1, 200 on page 2, 30 on page 3)', async () => {
    let callCount = 0;
    const page1 = Array.from({ length: 200 }, (_, i) => createMockPayment(i + 1, '2026-03-01'));
    const page2 = Array.from({ length: 200 }, (_, i) => createMockPayment(201 + i, '2026-02-15'));
    const page3 = Array.from({ length: 30 }, (_, i) => createMockPayment(401 + i, '2026-02-01'));

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const p = new URL(String(url)).searchParams.get('page');
      if (p === '1') {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            customerpayments: page1,
            page_context: { page: 1, per_page: 200, has_more_page: true },
          }),
        } as any;
      }
      if (p === '2') {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            customerpayments: page2,
            page_context: { page: 2, per_page: 200, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          customerpayments: page3,
          page_context: { page: 3, per_page: 200, has_more_page: false },
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 3);
    assert.equal(res.data?.length, 430);
    assert.equal(res._meta?.apiCalls, 3);
    assert.equal(res._meta?.rawFetched, 430);
    assert.equal(res._meta?.validCount, 430);
  });

  // TEST 7: Payments contain void/cancelled/deleted records
  it('TEST 7: Payments contain void/cancelled/deleted records -> invalid records excluded exactly as intended', async () => {
    const rawPayments = [
      createMockPayment(1, '2026-03-01', 1000, 'success', false),
      createMockPayment(2, '2026-03-02', 2000, 'void', false), // void status
      createMockPayment(3, '2026-03-03', 3000, 'cancelled', false), // cancelled status
      createMockPayment(4, '2026-03-04', 4000, 'success', true), // deleted === true
      createMockPayment(5, '2026-03-05', 5000, 'failure', false), // failed gateway attempt
      createMockPayment(6, '2026-03-06', 6000, 'success', false), // valid
    ];

    const mockFetch: typeof fetch = async () => ({
      ok: true,
      json: async () => ({
        code: 0,
        customerpayments: rawPayments,
        page_context: { page: 1, per_page: 200, has_more_page: false },
      }),
    } as any);

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
    });

    assert.equal(res.success, true);
    assert.equal(res._meta?.rawFetched, 6);
    assert.equal(res._meta?.validCount, 2);
    assert.equal(res.data?.length, 2);
    assert.deepEqual(
      res.data?.map((p) => p.paymentId),
      ['6', '1'] // sorted newest first
    );
  });

  // TEST 8: Duplicate payment ID appears on page 2
  it('TEST 8: Duplicate payment ID appears on page 2 -> payment appears only once, amount not double counted', async () => {
    let callCount = 0;
    const page1 = [
      createMockPayment(101, '2026-03-05', 5000),
      createMockPayment(102, '2026-03-04', 3000),
    ];
    const page2 = [
      createMockPayment(102, '2026-03-04', 3000), // duplicate on page boundary
      createMockPayment(103, '2026-03-02', 2000),
    ];

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            customerpayments: page1,
            page_context: { page: 1, per_page: 2, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          customerpayments: page2,
          page_context: { page: 2, per_page: 2, has_more_page: false },
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 2,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 2);
    assert.equal(res.data?.length, 3);
    assert.equal(res._meta?.rawFetched, 3);
    assert.deepEqual(
      res.data?.map((p) => p.paymentId),
      ['101', '102', '103']
    );
    const totalAmount = res.data?.reduce((sum, p) => sum + p.amount, 0);
    assert.equal(totalAmount, 10000, 'Deduplication ensures amount 3000 is not counted twice');
  });

  // TEST 9: Page 2 returns API error
  it('TEST 9: Page 2 returns API error -> statement does NOT silently present an incomplete payment history', async () => {
    let callCount = 0;
    const page1 = Array.from({ length: 200 }, (_, i) => createMockPayment(i + 1, '2026-03-01'));

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            customerpayments: page1,
            page_context: { page: 1, per_page: 200, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          code: 500,
          message: 'Zoho Customer Payments API rate limit or internal error',
        }),
      } as any;
    };

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, false);
    assert.match(res.error || '', /Zoho Customer Payments API rate limit or internal error/);
    assert.equal(callCount, 2);
    assert.equal(res._meta?.isTruncated, true);
  });

  // TEST 10: Payment contains multiple invoices in its invoices[] array
  it('TEST 10: Payment contains multiple invoices in its invoices[] array -> represented as ONE customer payment transaction', async () => {
    const multiInvoicePayment = createMockPayment(
      999,
      '2026-03-05',
      15000,
      'success',
      false,
      [
        { invoice_id: 'INV-1', invoice_number: 'INV-001', amount_applied: 5000 },
        { invoice_id: 'INV-2', invoice_number: 'INV-002', amount_applied: 5000 },
        { invoice_id: 'INV-3', invoice_number: 'INV-003', amount_applied: 5000 },
      ]
    );

    const mockFetch: typeof fetch = async () => ({
      ok: true,
      json: async () => ({
        code: 0,
        customerpayments: [multiInvoicePayment],
        page_context: { page: 1, per_page: 200, has_more_page: false },
      }),
    } as any);

    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
    });

    assert.equal(res.success, true);
    assert.equal(res.data?.length, 1, 'Payment must remain ONE atomic payment record');
    assert.equal(res.data?.[0].amount, 15000);
    assert.equal(res.data?.[0].paymentId, '999');
  });

  // TEST 11: Statement balance impact: Opening balance reverse-calculation
  it('TEST 11: Statement balance impact -> complete payment pagination correctly establishes opening balance', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: any) => {
        const urlStr = String(url);

        // Contact
        if (urlStr.includes('/books/v3/contacts/')) {
          return {
            ok: true,
            json: async () => ({
              code: 0,
              contact: {
                contact_id: dummyContactId,
                contact_name: 'Test Customer',
                outstanding_receivable_amount: 10000, // closing net receivable
                unused_credits_receivable_amount: 0,
              },
            }),
          } as any;
        }

        // Invoices: 1 invoice of 25,000 on 2026-03-02
        if (urlStr.includes('/books/v3/invoices')) {
          return {
            ok: true,
            json: async () => ({
              code: 0,
              invoices: [
                {
                  invoice_id: 'INV-1',
                  invoice_number: 'INV-001',
                  date: '2026-03-02',
                  status: 'paid',
                  total: 25000,
                  balance: 0,
                },
              ],
              page_context: { page: 1, per_page: 200, has_more_page: false },
            }),
          } as any;
        }

        // Customer payments: 2 pages (Page 1: 200 payments of 50 each = 10,000; Page 2: 100 payments of 50 each = 5,000; Total = 15,000)
        if (urlStr.includes('/books/v3/customerpayments')) {
          if (urlStr.includes('page=1')) {
            const page1 = Array.from({ length: 200 }, (_, i) =>
              createMockPayment(i + 1, '2026-03-05', 50)
            );
            return {
              ok: true,
              json: async () => ({
                code: 0,
                customerpayments: page1,
                page_context: { page: 1, per_page: 200, has_more_page: true },
              }),
            } as any;
          } else {
            const page2 = Array.from({ length: 100 }, (_, i) =>
              createMockPayment(201 + i, '2026-03-04', 50)
            );
            return {
              ok: true,
              json: async () => ({
                code: 0,
                customerpayments: page2,
                page_context: { page: 2, per_page: 200, has_more_page: false },
              }),
            } as any;
          }
        }

        return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) } as any;
      }) as any;

      process.env.ZOHO_ORGANIZATION_ID = dummyOrgId;
      process.env.ZOHO_BOOKS_ORG_ID = dummyOrgId;

      const res = await getCustomerStatement(dummyContactId);
      assert.equal(res.success, true);
      const data = res.data!;

      // 1 invoice (25,000) + 300 payments (300 * 50 = 15,000)
      // Net effect = +25,000 (invoice) - 15,000 (payments) = +10,000
      // Closing balance = 10,000
      // Opening balance = Closing balance - Net effect = 10,000 - 10,000 = 0
      assert.equal(data.closingBalance, 10000);
      assert.equal(data.openingBalance, 0, 'Opening balance must be 0 after all 300 payments reverse the 25,000 invoice');
      assert.equal(data.telemetry.paymentApiCalls, 2, '2 API calls for 300 payments');
      assert.equal(data.telemetry.rawPaymentsFetched, 300);
      assert.equal(data.telemetry.validPaymentsAfterFilter, 300);
      assert.equal(data.transactionCount, 301, '1 invoice + 300 payments = 301');
      assert.equal(data.isTruncated, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCustomerInvoices } from '@/lib/zoho/customer-statement';

function createMockInvoice(id: string | number, date: string, status: string = 'paid', total: number = 1000) {
  return {
    invoice_id: String(id),
    invoice_number: `INV-${String(id).padStart(4, '0')}`,
    date,
    due_date: date,
    status,
    total,
    balance: 0,
    currency_code: 'INR',
    reference_number: `REF-${id}`,
    salesperson_name: 'Test Salesperson',
  };
}

describe('Customer Statement Invoice Fetching & Pagination Logic', () => {
  const dummyContactId = '1759923000000000001';
  const dummyOrgId = '60027595766';
  const dummyToken = 'test-token';

  // Case 1: Customer has 0 invoices
  it('Case 1: Customer has 0 invoices -> 1 API request, 0 invoices returned', async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          invoices: [],
          page_context: {
            page: 1,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
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

  // Case 2: Customer has fewer than page size (<200)
  it('Case 2: Customer has fewer than page size -> 1 API request, all invoices returned', async () => {
    let callCount = 0;
    const invoices = Array.from({ length: 45 }, (_, i) =>
      createMockInvoice(i + 1, `2026-03-${String((i % 25) + 1).padStart(2, '0')}`)
    );

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          invoices,
          page_context: {
            page: 1,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 1);
    assert.equal(res.data?.length, 45);
    assert.equal(res._meta?.apiCalls, 1);
    assert.equal(res._meta?.rawFetched, 45);
    assert.equal(res._meta?.validCount, 45);
  });

  // Case 3: Customer has exactly page size (200)
  it('Case 3: Customer has exactly page size -> 1 API request when has_more_page=false', async () => {
    let callCount = 0;
    const invoices = Array.from({ length: 200 }, (_, i) =>
      createMockInvoice(i + 1, '2026-02-15')
    );

    const mockFetch: typeof fetch = async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          invoices,
          page_context: {
            page: 1,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
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

  // Case 4: Customer has page size + 1 (201)
  it('Case 4: Customer has page size + 1 -> 2 API requests, all 201 invoices returned', async () => {
    let callCount = 0;
    const page1Invoices = Array.from({ length: 200 }, (_, i) =>
      createMockInvoice(i + 1, '2026-03-01')
    );
    const page2Invoices = [createMockInvoice(201, '2026-03-02')];

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            message: 'success',
            invoices: page1Invoices,
            page_context: {
              page: 1,
              per_page: 200,
              has_more_page: true,
            },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          invoices: page2Invoices,
          page_context: {
            page: 2,
            per_page: 200,
            has_more_page: false,
          },
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
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

  // Case 5: Customer has 150+ / 250+ invoices across multiple pages
  it('Case 5: Customer has 250+ invoices -> paginates sequentially without lost records', async () => {
    let callCount = 0;
    const page1Invoices = Array.from({ length: 200 }, (_, i) =>
      createMockInvoice(i + 1, '2026-03-01')
    );
    const page2Invoices = Array.from({ length: 75 }, (_, i) =>
      createMockInvoice(201 + i, '2026-02-15')
    );

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            message: 'success',
            invoices: page1Invoices,
            page_context: { page: 1, per_page: 200, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          invoices: page2Invoices,
          page_context: { page: 2, per_page: 200, has_more_page: false },
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 2);
    assert.equal(res.data?.length, 275);
    assert.equal(res._meta?.rawFetched, 275);
    assert.equal(res._meta?.validCount, 275);
    assert.equal(res._meta?.apiCalls, 2);
  });

  // Case 6: Some invoices are void
  it('Case 6: Void invoices are cleanly excluded while non-void are retained', async () => {
    const rawInvoices = [
      createMockInvoice(1, '2026-03-01', 'paid'),
      createMockInvoice(2, '2026-03-02', 'void'),
      createMockInvoice(3, '2026-03-03', 'overdue'),
      createMockInvoice(4, '2026-03-04', 'void'),
      createMockInvoice(5, '2026-03-05', 'sent'),
    ];

    const mockFetch: typeof fetch = async () => ({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        invoices: rawInvoices,
        page_context: { page: 1, per_page: 200, has_more_page: false },
      }),
    } as any);

    const res = await getCustomerInvoices(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
    });

    assert.equal(res.success, true);
    assert.equal(res._meta?.rawFetched, 5);
    assert.equal(res._meta?.validCount, 3);
    assert.equal(res.data?.length, 3);
    assert.deepEqual(
      res.data?.map((i) => i.invoiceId),
      ['5', '3', '1'] // sorted newest first
    );
    assert.ok(res.data?.every((i) => i.status !== 'void'));
  });

  // Case 7: Zoho returns an API error on page 2
  it('Case 7: API error on page 2 does NOT return silent partial statement', async () => {
    let callCount = 0;
    const page1Invoices = Array.from({ length: 200 }, (_, i) =>
      createMockInvoice(i + 1, '2026-03-01')
    );

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            message: 'success',
            invoices: page1Invoices,
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
          message: 'Zoho API Gateway Timeout',
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 200,
    });

    assert.equal(res.success, false);
    assert.match(res.error || '', /Zoho API Gateway Timeout/);
    assert.equal(callCount, 2);
    assert.equal(res._meta?.isTruncated, true);
  });

  // Case 8: Duplicate invoice appears across pages
  it('Case 8: Duplicate invoices across pages are deduplicated by invoice_id', async () => {
    let callCount = 0;
    // Invoice 200 appears on both page 1 and page 2 (common with live data insertion)
    const page1Invoices = [
      createMockInvoice(1, '2026-03-03'),
      createMockInvoice(2, '2026-03-02'),
    ];
    const page2Invoices = [
      createMockInvoice(2, '2026-03-02'), // duplicate of previous page
      createMockInvoice(3, '2026-03-01'),
    ];

    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            message: 'success',
            invoices: page1Invoices,
            page_context: { page: 1, per_page: 2, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          invoices: page2Invoices,
          page_context: { page: 2, per_page: 2, has_more_page: false },
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 2,
    });

    assert.equal(res.success, true);
    assert.equal(callCount, 2);
    assert.equal(res.data?.length, 3); // 1, 2, 3 (no duplicate 2)
    assert.equal(res._meta?.rawFetched, 3);
    assert.deepEqual(
      res.data?.map((i) => i.invoiceId),
      ['1', '2', '3']
    );
  });

  // Case 9: Preserve sorting: newest invoices first
  it('Case 9: Retains newest-first sorting across multiple pages', async () => {
    const page1Invoices = [
      createMockInvoice(101, '2026-03-10'),
      createMockInvoice(102, '2026-03-08'),
    ];
    const page2Invoices = [
      createMockInvoice(103, '2026-03-05'),
      createMockInvoice(104, '2026-03-01'),
    ];

    const mockFetch: typeof fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            invoices: page1Invoices,
            page_context: { page: 1, per_page: 2, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          invoices: page2Invoices,
          page_context: { page: 2, per_page: 2, has_more_page: false },
        }),
      } as any;
    };

    const res = await getCustomerInvoices(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 2,
    });

    assert.equal(res.success, true);
    const dates = res.data?.map((i) => i.invoiceDate);
    assert.deepEqual(dates, ['2026-03-10', '2026-03-08', '2026-03-05', '2026-03-01']);
  });

  // Case 10: Customer payments pagination & void filter
  it('Case 10: Customer payments paginate seamlessly and exclude void/cancelled payments', async () => {
    const page1Payments = [
      {
        payment_id: 'PMT-1',
        payment_number: 'PAY-001',
        payment_mode: 'Bank Transfer',
        date: '2026-03-05',
        amount: 5000,
        status: 'success',
      },
      {
        payment_id: 'PMT-2',
        payment_number: 'PAY-002',
        payment_mode: 'Cash',
        date: '2026-03-04',
        amount: 2000,
        status: 'void', // excluded
      },
    ];
    const page2Payments = [
      {
        payment_id: 'PMT-3',
        payment_number: 'PAY-003',
        payment_mode: 'UPI',
        date: '2026-03-02',
        amount: 3000,
        status: 'success',
      },
    ];

    const mockFetch: typeof fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            customerpayments: page1Payments,
            page_context: { page: 1, per_page: 2, has_more_page: true },
          }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          code: 0,
          customerpayments: page2Payments,
          page_context: { page: 2, per_page: 2, has_more_page: false },
        }),
      } as any;
    };

    const { getCustomerPayments } = await import('@/lib/zoho/customer-statement');
    const res = await getCustomerPayments(dummyContactId, {
      fetchFn: mockFetch,
      orgId: dummyOrgId,
      accessToken: dummyToken,
      pageSize: 2,
    });

    assert.equal(res.success, true);
    assert.equal(res.data?.length, 2); // PMT-1 and PMT-3 (PMT-2 is void)
    assert.equal(res._meta?.rawFetched, 3);
    assert.equal(res._meta?.validCount, 2);
    assert.equal(res._meta?.apiCalls, 2);
    assert.equal(res.data?.[0].paymentId, 'PMT-1');
    assert.equal(res.data?.[1].paymentId, 'PMT-3');
  });

  // Case 11: End-to-end getCustomerStatement telemetry and truncation verification
  it('Case 11: End-to-end getCustomerStatement accurately aggregates telemetry and computes complete balance', async () => {
    const { getCustomerStatement } = await import('@/lib/zoho/customer-statement');

    // We mock global.fetch during this test
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: any) => {
        const urlStr = String(url);

        // Contacts endpoint
        if (urlStr.includes('/books/v3/contacts/')) {
          return {
            ok: true,
            json: async () => ({
              code: 0,
              contact: {
                contact_id: dummyContactId,
                contact_name: 'Test Customer',
                outstanding_receivable_amount: 15000,
                unused_credits_receivable_amount: 0,
              },
            }),
          } as any;
        }

        // Invoices endpoint: 2 pages (200 on page 1, 30 on page 2 = 230 invoices)
        if (urlStr.includes('/books/v3/invoices')) {
          if (urlStr.includes('page=1')) {
            const page1 = Array.from({ length: 200 }, (_, i) =>
              createMockInvoice(i + 1, '2026-03-01', 'paid', 100)
            );
            return {
              ok: true,
              json: async () => ({
                code: 0,
                invoices: page1,
                page_context: { page: 1, per_page: 200, has_more_page: true },
              }),
            } as any;
          } else {
            const page2 = Array.from({ length: 30 }, (_, i) =>
              createMockInvoice(201 + i, '2026-03-02', 'paid', 100)
            );
            return {
              ok: true,
              json: async () => ({
                code: 0,
                invoices: page2,
                page_context: { page: 2, per_page: 200, has_more_page: false },
              }),
            } as any;
          }
        }

        // Customer payments endpoint: 1 page (10 payments of 500 each)
        if (urlStr.includes('/books/v3/customerpayments')) {
          const pmts = Array.from({ length: 10 }, (_, i) => ({
            payment_id: `PMT-${i + 1}`,
            payment_number: `PAY-${i + 1}`,
            date: '2026-03-03',
            amount: 500,
            status: 'success',
          }));
          return {
            ok: true,
            json: async () => ({
              code: 0,
              customerpayments: pmts,
              page_context: { page: 1, per_page: 200, has_more_page: false },
            }),
          } as any;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({ message: 'Not found' }),
        } as any;
      }) as any;

      process.env.ZOHO_ORGANIZATION_ID = dummyOrgId;
      process.env.ZOHO_BOOKS_ORG_ID = dummyOrgId;

      const stmtRes = await getCustomerStatement(dummyContactId);
      assert.equal(stmtRes.success, true);
      const stmt = stmtRes.data!;

      // Telemetry asserts
      assert.equal(stmt.telemetry.customerApiCalls, 1);
      assert.equal(stmt.telemetry.invoiceApiCalls, 2, '2 invoice API calls for 230 invoices');
      assert.equal(stmt.telemetry.paymentApiCalls, 1, '1 payment API call for 10 payments');
      assert.equal(stmt.telemetry.totalApiCalls, 4, '1 contact + 2 invoices + 1 payments = 4');
      assert.equal(stmt.telemetry.rawInvoicesFetched, 230, 'Total raw invoices fetched is 230');
      assert.equal(stmt.telemetry.validInvoicesAfterFilter, 230);
      assert.equal(stmt.isTruncated, false, 'Complete fetch must have isTruncated = false');
      assert.equal(stmt.transactionCount, 240, '230 invoices + 10 payments = 240 total transactions');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

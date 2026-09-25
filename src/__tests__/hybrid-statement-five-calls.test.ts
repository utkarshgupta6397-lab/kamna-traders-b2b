import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCustomerStatement } from '../lib/zoho/customer-statement';

describe('Hybrid Statement 5 Zoho Calls Architecture Suite', () => {
  it('NITASHI SOLAR SOLUTIONS (1759923000000103217): makes exactly 5 Zoho Books API calls with complete accounting & metadata parity', async () => {
    const originalFetch = globalThis.fetch;
    const interceptedUrls: string[] = [];

    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as any).url;
      interceptedUrls.push(url);
      return originalFetch(input, init);
    };

    try {
      const res = await getCustomerStatement('1759923000000103217', '2026-03-01', '2026-09-25');
      assert.equal(res.success, true, `Statement fetch must succeed: ${res.error}`);
      const data = res.data!;

      // 1. Exactly 5 Zoho Books API calls
      assert.equal(interceptedUrls.length, 5, `Expected exactly 5 Zoho API calls, but got ${interceptedUrls.length}`);

      // 2. Verified endpoints in call chain
      const hasContact = interceptedUrls.some(u => u.includes('/books/v3/contacts/1759923000000103217') && !u.includes('/statements'));
      const hasCustStatement = interceptedUrls.some(u => u.includes('/books/v3/contacts/1759923000000103217/statements'));
      const hasVendStatement = interceptedUrls.some(u => u.includes('/books/v3/vendors/1759923000000896425/statements'));
      const hasCustPayments = interceptedUrls.some(u => u.includes('/books/v3/customerpayments?') && u.includes('customer_id=1759923000000103217'));
      const hasVendPayments = interceptedUrls.some(u => u.includes('/books/v3/vendorpayments?') && u.includes('vendor_id=1759923000000896425'));

      assert.ok(hasContact, 'Call #1: Contact lookup must be present');
      assert.ok(hasCustStatement, 'Call #2: Native Customer Statement PDF must be present');
      assert.ok(hasVendStatement, 'Call #3: Native Vendor Statement PDF must be present');
      assert.ok(hasCustPayments, 'Call #4: Customer Payments List must be present');
      assert.ok(hasVendPayments, 'Call #5: Vendor Payments List must be present');

      // 3. Negative checks: No invoice list, bills list, journals, or detail calls
      const hasInvoices = interceptedUrls.some(u => u.includes('/books/v3/invoices'));
      const hasBills = interceptedUrls.some(u => u.includes('/books/v3/bills'));
      const hasJournals = interceptedUrls.some(u => u.includes('/books/v3/journals'));
      const hasCustPaymentDetail = interceptedUrls.some(u => /\/customerpayments\/\d+/.test(u));
      const hasVendPaymentDetail = interceptedUrls.some(u => /\/vendorpayments\/\d+/.test(u));

      assert.equal(hasInvoices, false, 'No invoices API calls permitted');
      assert.equal(hasBills, false, 'No bills API calls permitted');
      assert.equal(hasJournals, false, 'No journals API calls permitted');
      assert.equal(hasCustPaymentDetail, false, 'No individual customer payment detail calls permitted');
      assert.equal(hasVendPaymentDetail, false, 'No individual vendor payment detail calls permitted');

      // 4. Financial totals & accounting parity
      assert.equal(data.openingBalance, -32117, 'Opening balance must match ledger truth');
      assert.equal(data.closingBalance, 1731094, 'Closing balance must match ledger truth');
      assert.equal(data.customerNet, 9700294, 'Customer net must match native statement');
      assert.equal(data.vendorNet, 7969200, 'Vendor net must match native vendor statement');
      assert.equal(data.transactions.length, 126, 'Total transactions must remain 126');

      // 5. Payment metadata enrichment from list response
      const payments = data.transactions.filter(t => t.type === 'payment');
      assert.equal(payments.length, 12, 'Must have 12 customer payment transactions');
      for (const p of payments) {
        assert.ok(p.paymentMode, `Payment ${p.referenceNumber} must have payment mode enriched`);
        assert.ok(p.referenceNumber, `Payment must have reference number`);
      }

      const vendorPayments = data.transactions.filter(t => t.type === 'vendor_payment');
      assert.equal(vendorPayments.length, 11, 'Must have 11 vendor payment transactions');
      for (const vp of vendorPayments) {
        assert.ok(vp.paymentMode, `Vendor payment ${vp.referenceNumber} must have payment mode enriched`);
        assert.ok(vp.referenceNumber, `Vendor payment must have reference number`);
      }

      // 6. Vendor Credit Note preserved
      const vendorCredit = data.transactions.find(t => t.type === 'vendor_credit');
      assert.ok(vendorCredit, 'Vendor credit note must be present');
      assert.equal(vendorCredit.amount, 124766);
      assert.equal(vendorCredit.debit, 124766);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

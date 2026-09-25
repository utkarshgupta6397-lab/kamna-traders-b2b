import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCustomerStatement } from '../lib/zoho/customer-statement';

describe('Live Zoho Native Customer Statement Integration', () => {
  it('QASMI ENTERPRISES (1759923000016885255): validates live statement extraction and accounting mapping', async () => {
    const contactId = '1759923000016885255';
    const res = await getCustomerStatement(contactId, '2026-03-01', '2026-09-25');

    assert.equal(res.success, true, `Statement fetch must succeed: ${res.error}`);
    const data = res.data!;

    // 1. Opening balance & closing balance
    assert.equal(data.openingBalance, 0);
    assert.equal(data.closingBalance, 71.76);

    // 2. Transaction counts
    assert.equal(data.transactions.length, 36);

    // 3. Payment Refund is mapped to debit with type payment_refund and no generic zohoUrl
    const refundTx = data.transactions.find(t => t.referenceNumber === 'PT-KT/26-27/3759' && t.debit === 429000);
    assert.ok(refundTx, 'Payment Refund PT-KT/26-27/3759 must exist as a debit transaction');
    assert.equal(refundTx.type, 'payment_refund');
    assert.equal(refundTx.amount, 429000);
    assert.equal(refundTx.debit, 429000);
    assert.equal(refundTx.credit, 0);
    assert.equal(refundTx.netEffect, 429000);
    assert.equal(refundTx.zohoUrl, undefined);
    assert.equal(refundTx.description, 'Payment Refund / PT-KT/26-27/3759');

    // 3b. Verify payments are enriched with metadata (number, mode, reference, notes) and no generic zohoUrl
    const pmtTx = data.transactions.find(t => t.paymentNumber === 'PT-KT/26-27/3729' || t.referenceNumber === 'S90097347');
    assert.ok(pmtTx, 'Payment PT-KT/26-27/3729 must exist');
    assert.equal(pmtTx.type, 'payment');
    assert.equal(pmtTx.paymentNumber, 'PT-KT/26-27/3729');
    assert.equal(pmtTx.paymentReference, 'S90097347');
    assert.equal(pmtTx.paymentMode, 'Bank Transfer');
    assert.ok(pmtTx.notes?.includes('626616648498'), 'Payment notes must contain transaction details');
    assert.equal(pmtTx.amount, 20000);
    assert.equal(pmtTx.credit, 20000);
    assert.equal(pmtTx.debit, 0);
    assert.equal(pmtTx.netEffect, -20000);
    assert.equal(pmtTx.zohoUrl, undefined);

    // 3c. Verify cash payment enrichment
    const cashPmt = data.transactions.find(t => t.paymentNumber === 'PT-KT/26-27/3752');
    assert.ok(cashPmt, 'Cash Payment PT-KT/26-27/3752 must exist');
    assert.equal(cashPmt.paymentMode, 'Cash');
    assert.equal(cashPmt.amount, 10930);
    assert.equal(cashPmt.credit, 10930);
    assert.equal(cashPmt.zohoUrl, undefined);

    // 4. Void payment PT-KT/26-27/0850 is NOT present
    const voidTx = data.transactions.find(t => t.referenceNumber?.includes('0850') || t.paymentNumber?.includes('0850'));
    assert.equal(voidTx, undefined, 'Void payment PT-KT/26-27/0850 must be excluded');

    // 5. Payment Applied rows are not in the main transactions array
    const appliedRows = data.transactions.filter(t => (t as any).isInformational || t.description.toLowerCase().includes('payment applied'));
    assert.equal(appliedRows.length, 0, 'Payment Applied must not be separate financial transactions');

    // 6. Total Debits and Credits
    const totalDebits = data.transactions.filter(t => t.netEffect > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = data.transactions.filter(t => t.netEffect < 0).reduce((sum, t) => sum + t.amount, 0);
    assert.equal(totalDebits, 2107677.00);
    assert.equal(totalCredits, 2107605.24);
  });

  it('URJA ENTERPRISES (1759923000004979057): validates live statement extraction and reconciliation', async () => {
    const contactId = '1759923000004979057';
    const res = await getCustomerStatement(contactId, '2026-03-01', '2026-09-25');

    assert.equal(res.success, true, `Statement fetch must succeed: ${res.error}`);
    const data = res.data!;

    // 1. Opening balance & closing balance
    assert.equal(data.openingBalance, 225192.72);
    assert.equal(data.closingBalance, 214470.72);

    // 2. Transaction counts: 150 invoices + 27 payments = 177 transactions
    assert.equal(data.transactions.length, 177);

    // 3. Debits and Credits
    const totalDebits = data.transactions.filter(t => t.type === 'invoice').reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = data.transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
    assert.equal(totalDebits, 5419848.00);
    assert.equal(totalCredits, 5430570.00);
  });
});

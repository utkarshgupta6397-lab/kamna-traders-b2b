import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseNativeContactStatementPdf,
  parseAmount,
  isAmountStr,
  NativeStatementParseError
} from '../lib/zoho/native-contact-statement-parser';

describe('Native Contact Statement Parser & Helpers', () => {
  describe('Amount parsing helpers', () => {
    it('10. Currency formatting: parses standard comma-separated and rupee-formatted amounts', () => {
      assert.equal(parseAmount('₹ 16,78,677.00'), 1678677);
      assert.equal(parseAmount('₹4,29,000.00'), 429000);
      assert.equal(parseAmount('1,00,000.00'), 100000);
      assert.equal(parseAmount('71.76'), 71.76);
      assert.equal(parseAmount('0.00'), 0);
    });

    it('11. Parenthesized negative values: parses accounting parentheses as negative numbers', () => {
      assert.equal(parseAmount('(4,29,000.00)'), -429000);
      assert.equal(parseAmount('(₹4,29,000.00)'), -429000);
      assert.equal(parseAmount('(100.50)'), -100.5);
      assert.equal(parseAmount('-1,00,000.00'), -100000);
    });

    it('identifies amount strings accurately', () => {
      assert.equal(isAmountStr('₹ 1,00,000.00'), true);
      assert.equal(isAmountStr('(4,29,000.00)'), true);
      assert.equal(isAmountStr('-1,00,000.00'), true);
      assert.equal(isAmountStr('24 Sep 2026'), false);
      assert.equal(isAmountStr('Invoice KT/26-27/0468'), false);
      assert.equal(isAmountStr('Payment Received'), false);
    });
  });

  describe('Real PDF Regression: M/S QASMI ENTERPRISES (Contact ID: 1759923000016885255)', () => {
    const pdfPath = path.resolve(__dirname, '../../scratch/statement-audit/1759923000016885255-native-statement.pdf');
    let parsed: any;

    before(async () => {
      assert.equal(fs.existsSync(pdfPath), true, 'Regression fixture PDF must exist');
      const buf = fs.readFileSync(pdfPath);
      parsed = await parseNativeContactStatementPdf(buf);
    });

    it('1. Opening balance = 0: parsed correctly from native header', () => {
      assert.equal(parsed.accountSummary.openingBalance, 0);
    });

    it('9. Multiple pages: parses across all 5 pages successfully', () => {
      assert.equal(parsed.totalRows, 38);
      const pages = new Set(parsed.rows.map((r: any) => r.page));
      assert.ok(pages.size >= 4);
    });

    it('3 & 4. Invoice & Bill of Supply → Debit mapping', () => {
      const invoices = parsed.rows.filter((r: any) => r.type === 'invoice');
      assert.equal(invoices.length, 13); // 12 invoices + 1 Bill of Supply

      const bos = invoices.find((r: any) => r.reference === 'BOS/26-27/0009');
      assert.ok(bos, 'Bill of Supply BOS/26-27/0009 should be present');
      assert.equal(bos.debit, 800);
      assert.equal(bos.credit, 0);

      const baseInvoiceDebits = invoices.reduce((sum: number, r: any) => sum + r.debit, 0);
      assert.equal(baseInvoiceDebits, 1678677.00);
    });

    it('5. Payment Received → Credit', () => {
      const payments = parsed.rows.filter((r: any) => r.type === 'payment');
      assert.equal(payments.length, 22);
      const totalPayments = payments.reduce((sum: number, r: any) => sum + r.credit, 0);
      assert.equal(totalPayments, 2107605.24);
    });

    it('6. Payment Refund → Debit: parsed as refund with positive debit amount', () => {
      const refunds = parsed.rows.filter((r: any) => r.type === 'refund');
      assert.equal(refunds.length, 1);
      const ref = refunds[0];
      assert.equal(ref.reference, 'PT-KT/26-27/3759');
      assert.equal(ref.amount, 429000);
      assert.equal(ref.debit, 429000);
      assert.equal(ref.credit, 0);
    });

    it('7. Payment Applied → informational only with debit = 0 and credit = 0', () => {
      const appliedRows = parsed.rows.filter((r: any) => r.isInformational);
      assert.equal(appliedRows.length, 1);
      const app = appliedRows[0];
      assert.equal(app.type, 'payment_applied');
      assert.equal(app.debit, 0);
      assert.equal(app.credit, 0);
      assert.ok(app.applicationPairs.length > 0);
      assert.equal(app.applicationPairs[0].invoiceNumber, 'KT/26-27/0468');
      assert.equal(app.applicationPairs[0].amountApplied, 77011);
    });

    it('8. Void payment excluded: void payment PT-KT/26-27/0850 is NOT present in native statement', () => {
      const foundVoid = parsed.rows.some((r: any) => 
        (r.reference && r.reference.includes('0850')) || (r.details && r.details.includes('0850'))
      );
      assert.equal(foundVoid, false);
    });

    it('12. Same-day invoice + payment handled correctly on 2026-04-30', () => {
      const apr30Rows = parsed.rows.filter((r: any) => r.isoDate === '2026-04-30');
      assert.equal(apr30Rows.length, 4);
      assert.equal(apr30Rows[0].type, 'invoice');
      assert.equal(apr30Rows[0].debit, 477011);
    });

    it('13. Running balance and Closing balance match ledger truth', () => {
      assert.equal(parsed.accountSummary.balanceDue, 71.76);
      const lastRow = parsed.rows[parsed.rows.length - 1];
      assert.equal(lastRow.balance, 71.76);
    });

    it('14. Long transaction descriptions and excess payment notes captured', () => {
      const rowWithExcess = parsed.rows.find((r: any) => r.details.includes('in excess payments'));
      assert.ok(rowWithExcess, 'Excess payment details should be captured');
    });

    it('16. Empty debit/credit cells: payment rows have debit 0; invoice rows have credit 0', () => {
      const inv = parsed.rows.find((r: any) => r.type === 'invoice');
      assert.equal(inv.credit, 0);
      const pmt = parsed.rows.find((r: any) => r.type === 'payment');
      assert.equal(pmt.debit, 0);
    });
  });

  describe('Real PDF Regression: URJA ENTERPRISES', () => {
    const pdfPath = path.resolve(__dirname, '../../scratch/statement-audit/native-statement.pdf');
    let parsed: any;

    before(async () => {
      assert.equal(fs.existsSync(pdfPath), true, 'URJA regression fixture PDF must exist');
      const buf = fs.readFileSync(pdfPath);
      parsed = await parseNativeContactStatementPdf(buf);
    });

    it('2. Opening balance > 0: parsed correctly for URJA ENTERPRISES', () => {
      assert.equal(parsed.accountSummary.openingBalance, 225192.72);
      assert.equal(parsed.accountSummary.invoicedAmount, 5419848);
      assert.equal(parsed.accountSummary.amountPaid, 5430570);
      assert.equal(parsed.accountSummary.balanceDue, 214470.72);
    });

    it('15. Multiple Payment Applied rows: parses all 11 informational rows without affecting financial debit/credit', () => {
      const appliedRows = parsed.rows.filter((r: any) => r.isInformational);
      assert.equal(appliedRows.length, 11);
      for (const row of appliedRows) {
        assert.equal(row.debit, 0);
        assert.equal(row.credit, 0);
      }
    });

    it('Parses all 150 invoices and 27 payments accurately across 19 pages', () => {
      const financialRows = parsed.rows.filter((r: any) => !r.isOpeningBalance && !r.isInformational);
      assert.equal(financialRows.length, 177);

      const invoices = financialRows.filter((r: any) => r.type === 'invoice');
      const payments = financialRows.filter((r: any) => r.type === 'payment');
      assert.equal(invoices.length, 150);
      assert.equal(payments.length, 27);

      const totalDebits = invoices.reduce((sum: number, r: any) => sum + r.debit, 0);
      const totalCredits = payments.reduce((sum: number, r: any) => sum + r.credit, 0);
      assert.equal(totalDebits, 5419848);
      assert.equal(totalCredits, 5430570);
    });
  });

  describe('Error handling', () => {
    it('throws NativeStatementParseError on empty or invalid buffer', async () => {
      await assert.rejects(
        async () => {
          await parseNativeContactStatementPdf(Buffer.from('not-a-pdf'));
        },
        NativeStatementParseError
      );
    });
  });
});

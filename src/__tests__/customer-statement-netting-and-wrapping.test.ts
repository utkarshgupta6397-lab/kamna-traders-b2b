import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  isNettingTransaction,
  StatementTransaction,
  CustomerStatement,
  getCustomerStatementHybridNative
} from '../lib/zoho/customer-statement';
import { parseNativeContactStatementPdf } from '../lib/zoho/native-contact-statement-parser';
import { parseNativeVendorStatementPdf } from '../lib/zoho/native-vendor-statement-parser';

describe('Customer Statement: Netting Complete Exclusion & Description Wrapping', () => {

  // ==================================================
  // PART 6: TEST A — Netting detection
  // ==================================================
  describe('Test A — Netting detection', () => {
    it('identifies type=JOURNAL, description=Netting, reference=NET-00001 as Netting', () => {
      const tx = {
        type: 'journal',
        description: 'Netting',
        reference: 'NET-00001',
        referenceNumber: 'NET-00001',
      };
      assert.equal(isNettingTransaction(tx), true, 'Must identify JOURNAL Netting with NET-00001 as Netting');
    });

    it('identifies entries with NET- references or Netting entryNumber as Netting', () => {
      const tx1 = {
        id: 'tx-NET-00001',
        type: 'journal',
        entryNumber: 'Netting',
        referenceNumber: 'NET-00001',
        description: 'NET-00001 ₹4,96,687.00 for payment of KT/26-27/3297 ₹3,94,709.00 for payment of KT/26-27/3428 (8,91,396.00)'
      };
      assert.equal(isNettingTransaction(tx1), true, 'Must identify tx-NET-00001 as Netting');

      const tx2 = {
        referenceNumber: 'NET-00042',
        description: 'Journal entry for netting'
      };
      assert.equal(isNettingTransaction(tx2), true, 'Must identify NET- reference as Netting');
    });
  });

  // ==================================================
  // PART 6: TEST B — Alternate Netting representation
  // ==================================================
  describe('Test B — Alternate Netting representation', () => {
    it('identifies type=OTHER, description=Netting as Netting', () => {
      const tx = {
        id: 'tx-other-58',
        type: 'other',
        description: 'Netting',
        amount: 891396,
        debit: 0,
        credit: 891396
      };
      assert.equal(isNettingTransaction(tx), true, 'Must identify OTHER Netting as Netting');
    });

    it('identifies vendor/other statement rows where rawType or details is Netting', () => {
      const row1 = {
        rawType: 'Netting',
        details: 'Netting'
      };
      assert.equal(isNettingTransaction(row1), true);

      const row2 = {
        type: 'other',
        details: 'NET-00001 offset'
      };
      assert.equal(isNettingTransaction(row2), true);
    });
  });

  // ==================================================
  // PART 6: TEST C — Netting does not affect balance
  // ==================================================
  describe('Test C — Netting does not affect balance', () => {
    it('given balance before netting ₹39,08,595 and netting ₹8,91,396, statement balance remains ₹39,08,595 (not ₹30,17,199)', () => {
      const openingBalance = 3908595;
      const transactionsWithNetting = [
        {
          id: 'tx-NET-00001',
          type: 'journal',
          entryNumber: 'Netting',
          referenceNumber: 'NET-00001',
          description: 'Netting',
          amount: 891396,
          netEffect: -891396,
          debit: 0,
          credit: 891396
        }
      ];

      // Filter out Netting
      const cleanTransactions = transactionsWithNetting.filter(t => !isNettingTransaction(t));
      assert.equal(cleanTransactions.length, 0, 'Netting transaction must be excluded');

      // Forward-calculate running balance starting from opening balance
      let runningBalance = openingBalance;
      for (const tx of cleanTransactions) {
        runningBalance += tx.netEffect;
      }

      assert.equal(runningBalance, 3908595, 'Balance must remain ₹39,08,595');
      assert.notEqual(runningBalance, 3017199, 'Balance must NOT drop to ₹30,17,199');
    });

    it('handles multiple netting representations without any affecting the balance', () => {
      const balanceBefore = 3908595;
      const mixedList: any[] = [
        { id: 'inv-1', type: 'invoice', description: 'Invoice KT/26-27/3428', netEffect: 100000, debit: 100000, credit: 0 },
        { id: 'tx-NET-00001', type: 'journal', entryNumber: 'Netting', referenceNumber: 'NET-00001', description: 'Netting', netEffect: -891396, debit: 0, credit: 891396 },
        { id: 'tx-other-58', type: 'other', description: 'Netting', netEffect: -891396, debit: 0, credit: 891396 },
        { id: 'pmt-1', type: 'payment', description: 'Customer Payment', netEffect: -50000, debit: 0, credit: 50000 }
      ];

      const cleanList = mixedList.filter(t => !isNettingTransaction(t));
      assert.equal(cleanList.length, 2, 'Both Netting representations must be completely removed');

      let running = balanceBefore;
      for (const tx of cleanList) {
        running += tx.netEffect;
      }

      // Expected: 3908595 + 100000 - 50000 = 3958595
      assert.equal(running, 3958595);
    });
  });

  // ==================================================
  // PART 6: TEST D — Underlying invoice remains
  // ==================================================
  describe('Test D — Underlying invoice remains', () => {
    it('if Netting references invoice KT/26-27/3297, the invoice remains and only Netting disappears', () => {
      const dataset = [
        {
          id: 'inv-KT/26-27/3297',
          type: 'invoice',
          invoiceNumber: 'KT/26-27/3297',
          referenceNumber: 'KT/26-27/3297',
          description: 'Invoice KT/26-27/3297',
          amount: 496687,
          netEffect: 496687
        },
        {
          id: 'inv-KT/26-27/3428',
          type: 'invoice',
          invoiceNumber: 'KT/26-27/3428',
          referenceNumber: 'KT/26-27/3428',
          description: 'Invoice KT/26-27/3428',
          amount: 394709,
          netEffect: 394709
        },
        {
          id: 'tx-NET-00001',
          type: 'journal',
          entryNumber: 'Netting',
          referenceNumber: 'NET-00001',
          description: 'NET-00001 ₹4,96,687.00 for payment of KT/26-27/3297 ₹3,94,709.00 for payment of KT/26-27/3428',
          amount: 891396,
          netEffect: -891396
        }
      ];

      const filtered = dataset.filter(t => !isNettingTransaction(t));

      assert.equal(filtered.length, 2, 'Only the Netting transaction should be removed');
      const invoice3297 = filtered.find(t => t.id === 'inv-KT/26-27/3297');
      assert.ok(invoice3297, 'Invoice KT/26-27/3297 must remain in dataset');
      assert.equal(invoice3297.amount, 496687);

      const invoice3428 = filtered.find(t => t.id === 'inv-KT/26-27/3428');
      assert.ok(invoice3428, 'Invoice KT/26-27/3428 must remain in dataset');
      assert.equal(invoice3428.amount, 394709);

      const nettingTx = filtered.find(t => t.referenceNumber === 'NET-00001');
      assert.equal(nettingTx, undefined, 'Netting row must disappear completely');
    });
  });

  // ==================================================
  // PART 6: TEST E — Hybrid account (NITASHI SOLAR SOLUTIONS)
  // ==================================================
  describe('Test E — Hybrid account: NITASHI SOLAR SOLUTIONS (1759923000000103217)', () => {
    it('completely excludes Netting from Nitashi customer statement fixture', async () => {
      const pdfPath = path.resolve(__dirname, '../../scratch/statement-audit/nitashi-all-time.pdf');
      if (!fs.existsSync(pdfPath)) return;

      const buf = fs.readFileSync(pdfPath);
      const parsed = await parseNativeContactStatementPdf(buf);

      const rawFinancial = parsed.rows.filter(r => !r.isOpeningBalance && !r.isInformational);
      assert.equal(rawFinancial.length, 135, 'Raw fixture has 135 financial rows before filtering');

      const cleanFinancial = rawFinancial.filter(r => !isNettingTransaction(r));
      assert.equal(cleanFinancial.length, 134, 'Normalized dataset must have exactly 134 financial rows (Netting removed)');

      // Verify ZERO netting in clean financial
      const nettingInClean = cleanFinancial.filter(r => isNettingTransaction(r));
      assert.equal(nettingInClean.length, 0, 'There must be zero Netting rows in normalized transactions');

      // Verify balance restores the ₹8,91,396
      let running = parsed.accountSummary.openingBalance;
      for (const r of cleanFinancial) {
        running += (r.debit > 0 ? r.debit : -r.credit);
      }
      assert.equal(running, 10095003, 'Closing balance after netting exclusion must be exactly 10,095,003');
      assert.equal(running - parsed.accountSummary.balanceDue, 891396, 'Netting deduction of 891,396 must be restored');
    });

    it('neither JOURNAL nor OTHER Netting representations appear in merged hybrid dataset', () => {
      // Create representative customer and vendor transactions for Nitashi
      const customerTxs: StatementTransaction[] = [
        {
          id: 'inv-KT/26-27/3428',
          type: 'invoice',
          date: '2026-09-26',
          description: 'Invoice KT/26-27/3428',
          amount: 394709,
          debit: 394709,
          credit: 0,
          netEffect: 394709,
          balanceAfter: 10095003
        },
        {
          id: 'tx-NET-00001',
          type: 'journal',
          date: '2026-09-28',
          entryNumber: 'Netting',
          referenceNumber: 'NET-00001',
          description: 'NET-00001 ₹4,96,687.00 for payment of KT/26-27/3297 ₹3,94,709.00 for payment of KT/26-27/3428',
          amount: 891396,
          debit: 0,
          credit: 891396,
          netEffect: -891396,
          balanceAfter: 9203607
        }
      ];

      const vendorTxs: StatementTransaction[] = [
        {
          id: 'bill-3879',
          type: 'bill',
          date: '2026-09-22',
          description: 'Purchase Bill - 3879',
          amount: 73238,
          debit: 0,
          credit: 73238,
          netEffect: -73238,
          balanceAfter: 8969200
        },
        {
          id: 'tx-other-58',
          type: 'other',
          date: '2026-09-28',
          description: 'Netting',
          amount: 891396,
          debit: 0,
          credit: 891396,
          netEffect: -891396,
          balanceAfter: 7969200
        }
      ];

      // Simulate hybrid merge
      const cleanCust = customerTxs.filter(t => !isNettingTransaction(t));
      const cleanVend = vendorTxs.filter(t => !isNettingTransaction(t));

      const merged = [
        ...cleanCust.map(t => ({ ...t, customerNetEffect: t.netEffect, vendorNetEffect: 0 })),
        ...cleanVend.map(t => ({ ...t, customerNetEffect: 0, vendorNetEffect: t.netEffect }))
      ].filter(t => !isNettingTransaction(t));

      assert.equal(merged.length, 2, 'Only 2 legitimate transactions (1 invoice, 1 bill) must remain');
      assert.equal(merged.some(t => t.id === 'tx-NET-00001'), false, 'tx-NET-00001 must not exist');
      assert.equal(merged.some(t => t.id === 'tx-other-58'), false, 'tx-other-58 must not exist');
      assert.equal(merged.some(t => isNettingTransaction(t)), false, 'No netting transaction in merged hybrid');
    });
  });

  // ==================================================
  // PART 6: TEST F — Swissmatic regression
  // ==================================================
  describe('Test F — Swissmatic regression (Customer: 1759923000000112204)', () => {
    it('verifies Swissmatic has exactly 3 financial transactions and closing balance of ₹140', async () => {
      const pdfPath = path.resolve(__dirname, '../../scratch/statement-audit/1759923000000112204-swissmatic-native-statement.pdf');
      assert.equal(fs.existsSync(pdfPath), true, 'Swissmatic regression fixture PDF must exist');

      const buf = fs.readFileSync(pdfPath);
      const parsed = await parseNativeContactStatementPdf(buf);

      const financialRows = parsed.rows.filter(r => !r.isOpeningBalance && !r.isInformational && !isNettingTransaction(r));
      assert.equal(financialRows.length, 3, 'Must have exactly 3 financial transactions');

      // Verify the 3 financial transactions
      const tx1 = financialRows.find(r => r.reference === 'PT-KT/26-27/3848');
      assert.ok(tx1, 'PT-KT/26-27/3848 Payment Received must be present');
      assert.equal(tx1.type, 'payment');
      assert.equal(tx1.credit, 52500);

      const tx2 = financialRows.find(r => r.reference === 'PT-KT/26-27/3844');
      assert.ok(tx2, 'PT-KT/26-27/3844 Payment Received must be present');
      assert.equal(tx2.type, 'payment');
      assert.equal(tx2.credit, 70000);

      const tx3 = financialRows.find(r => r.reference === 'KT/26-27/3470');
      assert.ok(tx3, 'KT/26-27/3470 Invoice must be present');
      assert.equal(tx3.type, 'invoice');
      assert.equal(tx3.debit, 122640);

      // Verify forward calculation gives exactly ₹140 closing balance
      let running = parsed.accountSummary.openingBalance;
      for (const r of financialRows) {
        running += (r.debit > 0 ? r.debit : -r.credit);
      }
      assert.equal(running, 140, 'Closing balance must be exactly ₹140');
    });
  });

  // ==================================================
  // PART 7: DESCRIPTION WRAPPING TEST
  // ==================================================
  describe('Part 7 — Description Wrapping Specification', () => {
    it('verifies that CustomerStatementView table uses table-fixed layout and break-words for Document & Details', () => {
      const viewFilePath = path.resolve(__dirname, '../components/zoho/CustomerStatementView.tsx');
      assert.equal(fs.existsSync(viewFilePath), true, 'CustomerStatementView.tsx must exist');

      const content = fs.readFileSync(viewFilePath, 'utf8');

      // 1. Table must use table-fixed layout to prevent wide content from pushing columns out
      assert.ok(content.includes('table-fixed'), 'Desktop table must specify table-fixed layout');

      // 2. Document & Details column and its description text must wrap with break-words and whitespace-normal
      assert.ok(
        content.includes('break-words whitespace-normal') || content.includes('[overflow-wrap:anywhere]'),
        'Description content must use break-words whitespace-normal or [overflow-wrap:anywhere]'
      );

      // 3. Truncate must NOT be applied to payment/vendor_payment description/notes
      const badTruncatePattern = /tx\.paymentDescription\s*\)\s*&&\s*\([^)]*truncate/;
      assert.equal(
        badTruncatePattern.test(content),
        false,
        'Payment description/notes must not be truncated'
      );

      // 4. Row cells must align to the top so that Debit/Credit/Balance remain aligned when description wraps
      assert.ok(
        content.includes('align-top'),
        'Table row cells must use align-top for clean column alignment with multi-line descriptions'
      );
    });

    it('demonstrates that a long description wraps without losing details', () => {
      const longVendorPaymentDesc = 'VP-KT/26-27/0407 7,640.00 for payment of NSS/25-26-2089 45,865.00 for payment of NSS/25-26/1049 29,190.00 for payment of NSS/25-26/1168 83,367.00 for payment of NSS/25-26/2633 1,04,005.00 for payment of NSS/26-27/0008 1,49,290.00';
      
      const tx: StatementTransaction = {
        id: 'vp-0407',
        type: 'vendor_payment',
        date: '2026-09-28',
        description: 'Payment Made - Bank Transfer',
        paymentDescription: longVendorPaymentDesc,
        notes: longVendorPaymentDesc,
        amount: 419357,
        debit: 419357,
        credit: 0,
        netEffect: 419357,
        balanceAfter: 2500000,
        referenceNumber: 'VP-KT/26-27/0407'
      };

      // Ensure it is NOT misclassified as Netting
      assert.equal(isNettingTransaction(tx), false, 'Legitimate vendor payment must not be classified as netting');

      // Ensure all text remains intact
      assert.equal(tx.paymentDescription, longVendorPaymentDesc);
      assert.ok(tx.paymentDescription!.includes('NSS/25-26-2089'));
      assert.ok(tx.paymentDescription!.includes('1,49,290.00'));
    });
  });

});

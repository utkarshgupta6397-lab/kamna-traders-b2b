import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, isAmountStr } from '../lib/zoho/native-vendor-statement-parser';
import { getCustomerStatement } from '../lib/zoho/customer-statement';
import { getNativeVendorStatement } from '../lib/zoho/native-vendor-statement';

describe('Native Vendor Statement & Hybrid Engine', () => {
  describe('Amount parsing helpers', () => {
    it('parses currency strings with commas and symbols', () => {
      assert.equal(parseAmount('₹ 1,92,796.26'), 192796.26);
      assert.equal(parseAmount('₹95,697.00'), 95697);
      assert.equal(parseAmount('83,816.26'), 83816.26);
      assert.equal(parseAmount('0.00'), 0);
    });

    it('parses negative/parenthesized numbers', () => {
      assert.equal(parseAmount('(1,92,796.26)'), -192796.26);
      assert.equal(parseAmount('-83,816.26'), -83816.26);
      assert.equal(parseAmount('(₹10,000.00)'), -10000);
    });

    it('identifies valid amount strings', () => {
      assert.equal(isAmountStr('₹ 95,697.00'), true);
      assert.equal(isAmountStr('13,283.00'), true);
      assert.equal(isAmountStr('(1,92,796.26)'), true);
      assert.equal(isAmountStr('Purchase Bill'), false);
      assert.equal(isAmountStr('24 Sep 2026'), false);
    });
  });

  describe('Live Vendor Statement: V-TECH BATTERY (1759923000016784751)', () => {
    it('fetches and reconciles native vendor statement with 3 bills totaling ₹1,92,796.26', async () => {
      const res = await getCustomerStatement('1759923000016784751', '2026-03-01', '2026-09-25');
      assert.equal(res.success, true);
      assert.ok(res.data, 'Statement data must be returned');

      const stmt = res.data;
      assert.equal(stmt.customer.contactName, 'V-TECH BATTERY');
      assert.equal(stmt.customer.contactType, 'vendor');
      assert.equal(stmt.closingBalance, 192796.26);
      assert.equal(stmt.openingBalance, 0);

      // Verify transactions
      assert.equal(stmt.transactions.length, 3);

      const bill31 = stmt.transactions.find(t => t.referenceNumber?.includes('31') || t.description?.includes('31'));
      assert.ok(bill31, 'Bill #31 must be present');
      assert.equal(bill31.amount, 95697);
      assert.equal(bill31.credit, 95697);
      assert.equal(bill31.netEffect, -95697);

      const bill260 = stmt.transactions.find(t => t.referenceNumber?.includes('260') || t.description?.includes('260'));
      assert.ok(bill260, 'Bill #260 must be present');
      assert.equal(bill260.amount, 83816.26);
      assert.equal(bill260.credit, 83816.26);
      assert.equal(bill260.netEffect, -83816.26);

      const bill295 = stmt.transactions.find(t => t.referenceNumber?.includes('295') || t.description?.includes('295'));
      assert.ok(bill295, 'Bill #295 must be present');
      assert.equal(bill295.amount, 13283);
      assert.equal(bill295.credit, 13283);
      assert.equal(bill295.netEffect, -13283);

      // Verify running balances
      assert.equal(bill31.balanceAfter, 95697);
      assert.equal(bill260.balanceAfter, 179513.26);
      assert.equal(bill295.balanceAfter, 192796.26);
    });
  });

  describe('Live Hybrid Statement: V-TECH BATTERY (Customer 1759923000002490670)', () => {
    it('seamlessly merges native customer statement and native vendor statement', async () => {
      const res = await getCustomerStatement('1759923000002490670', '2026-03-01', '2026-09-25');
      assert.equal(res.success, true);
      assert.ok(res.data, 'Hybrid statement data must be present');

      const stmt = res.data;
      assert.equal(stmt.isHybrid, true);
      assert.equal(stmt.customer.contactId, '1759923000002490670');
      assert.equal(stmt.customer.associatedVendorId, '1759923000016784751');

      // Verify total transactions: 84 customer transactions + 3 vendor bills = 87
      assert.equal(stmt.transactions.length, 87);

      // Verify all 3 vendor bills are integrated into hybrid ledger
      const vendorBills = stmt.transactions.filter(t => t.type === 'bill');
      assert.equal(vendorBills.length, 3);

      const vBill31 = vendorBills.find(b => b.description.includes('31'));
      assert.ok(vBill31, 'Hybrid statement must include vendor Bill 31');
      assert.equal(vBill31.amount, 95697);
      assert.equal(vBill31.credit, 95697);

      const vBill260 = vendorBills.find(b => b.description.includes('260'));
      assert.ok(vBill260, 'Hybrid statement must include vendor Bill 260');
      assert.equal(vBill260.amount, 83816.26);

      const vBill295 = vendorBills.find(b => b.description.includes('295'));
      assert.ok(vBill295, 'Hybrid statement must include vendor Bill 295');
      assert.equal(vBill295.amount, 13283);

      // Verify net closing balance: customerNet - vendorNet (-121080 - 192796.26 = -313876.26)
      assert.equal(stmt.customerNet, -121080);
      assert.equal(stmt.vendorNet, 192796.26);
      assert.equal(stmt.closingBalance, -313876.26);

      // Verify invoice numbers in customer transactions (not Sales Order numbers)
      const invoice3117 = stmt.transactions.find(t => t.description.includes('KT/26-27/3117'));
      assert.ok(invoice3117, 'Invoice KT/26-27/3117 must be displayed with normalized invoice number');
      assert.ok(!invoice3117.description.includes('SO-'), 'Description must not show SO- number');
    });
  });

  describe('Live Hybrid Statement: NITASHI SOLAR SOLUTIONS (Customer 1759923000000103217)', () => {
    it('correctly handles transaction 187 as a financial Vendor Credit of ₹1,24,766.00', async () => {
      const custId = '1759923000000103217';
      const res = await getCustomerStatement(custId, '2026-03-01', '2026-09-25');

      assert.ok(res.success, `Statement fetch failed: ${res.error}`);
      assert.ok(res.data, 'Statement data must exist');
      const stmt = res.data;

      // Find transaction 187
      const tx187 = stmt.transactions.find(t => (t.referenceNumber === '187' && t.date.includes('2026-09-17')) || t.type === 'vendor_credit');
      assert.ok(tx187, 'Transaction 187 must exist in statement ledger');

      // Assert financial accounting attributes
      assert.equal(tx187.type, 'vendor_credit', 'Transaction 187 must be typed as vendor_credit');
      assert.equal(tx187.amount, 124766, 'Amount must be 124766');
      assert.equal(tx187.debit, 124766, 'Debit must be 124766');
      assert.equal(tx187.credit, 0, 'Credit must be 0');
      assert.equal(tx187.netEffect, 124766, 'Net effect must be +124766');
      assert.equal(tx187.referenceNumber, '187', 'Reference number must be 187');
      assert.ok(tx187.description.includes('NSS/26-27/03732'), 'Description must link to applied bill NSS/26-27/03732');

      // Verify running balance correctly reflects +124766
      const tx187Index = stmt.transactions.findIndex(t => t.id === tx187.id);
      assert.ok(tx187Index > 0, 'Transaction 187 must not be the first transaction');
      const prevTx = stmt.transactions[tx187Index - 1];

      assert.equal(
        tx187.balanceAfter,
        prevTx.balanceAfter + tx187.netEffect,
        'Running balance after transaction 187 must equal balance before + netEffect (+124766)'
      );
      assert.equal(tx187.balanceAfter, -198980, 'Running balance after transaction 187 must be -198980');
    });

    it('verifies complete 126-transaction mathematical running balance chain and monthly reconciliations', async () => {
      const custId = '1759923000000103217';
      const res = await getCustomerStatement(custId, '2026-03-01', '2026-09-25');

      assert.ok(res.success, `Statement fetch failed: ${res.error}`);
      assert.ok(res.data, 'Statement data must exist');
      const stmt = res.data;

      // 1. Opening Balance
      assert.equal(stmt.openingBalance, -32117, 'Opening balance on 2026-03-01 must be -32,117 (₹32,117 advance/credit)');

      // 2. Transaction Count
      assert.equal(stmt.transactions.length, 126, 'NITASHI SOLAR SOLUTIONS must have 126 unified transactions');

      // 3. Continuous Running Balance Chain: every transaction must satisfy balanceAfter = prevBalance + netEffect
      let running = stmt.openingBalance;
      let sumNetEffect = 0;
      for (let i = 0; i < stmt.transactions.length; i++) {
        const tx = stmt.transactions[i];
        const expectedBalance = Math.round((running + tx.netEffect) * 100) / 100;
        assert.equal(
          tx.balanceAfter,
          expectedBalance,
          `Transaction #${i + 1} (${tx.date} ${tx.type} ${tx.referenceNumber || ''}): balanceAfter ${tx.balanceAfter} does not match expected ${expectedBalance}`
        );
        running = tx.balanceAfter;
        sumNetEffect += tx.netEffect;
      }

      // 4. Net sum and final closing balance
      assert.equal(Math.round(sumNetEffect * 100) / 100, 1763211, 'Sum of all net effects must equal +1,763,211');
      assert.equal(stmt.closingBalance, 1731094, 'Closing balance must be 1,731,094 (-32,117 + 1,763,211)');
      assert.equal(running, stmt.closingBalance, 'Last transaction balanceAfter must equal statement closingBalance');

      // 5. Verification of the September 1st transaction (KT/26-27/2906)
      const sep1TxIndex = stmt.transactions.findIndex(t => t.date.startsWith('2026-09-01'));
      assert.ok(sep1TxIndex > 0, 'September 1st transaction must exist');
      const sep1Tx = stmt.transactions[sep1TxIndex];
      const preSepBalance = stmt.transactions[sep1TxIndex - 1].balanceAfter;
      assert.equal(preSepBalance, 1487740, 'Balance immediately preceding September 1st transaction must be 1,487,740');
      assert.equal(sep1Tx.debit, 455654, 'September 1st invoice KT/26-27/2906 debit must be 455,654');
      assert.equal(sep1Tx.balanceAfter, 1943394, 'Running balance after September 1st invoice must be exactly 1,943,394 (1,487,740 + 455,654)');

      // 6. Monthly totals reconciliation
      const expectedMonthly = [
        { month: '2026-03', start: -32117, debits: 604828, credits: 220842, end: 351869 },
        { month: '2026-04', start: 351869, debits: 241964, credits: 410975, end: 182858 },
        { month: '2026-05', start: 182858, debits: 3208497, credits: 2392830, end: 998525 },
        { month: '2026-06', start: 998525, debits: 4721025, credits: 1956525, end: 3763025 },
        { month: '2026-07', start: 3763025, debits: 9751902, credits: 9963663, end: 3551264 },
        { month: '2026-08', start: 3551264, debits: 8570311, credits: 10633835, end: 1487740 },
        { month: '2026-09', start: 1487740, debits: 4787172, credits: 4543818, end: 1731094 },
      ];

      for (const expected of expectedMonthly) {
        const mTxns = stmt.transactions.filter(t => t.date.startsWith(expected.month));
        const mDebits = mTxns.reduce((s, t) => s + (t.debit || 0), 0);
        const mCredits = mTxns.reduce((s, t) => s + (t.credit || 0), 0);
        const mEnd = mTxns[mTxns.length - 1].balanceAfter;

        assert.equal(Math.round(mDebits), expected.debits, `${expected.month} debit total`);
        assert.equal(Math.round(mCredits), expected.credits, `${expected.month} credit total`);
        assert.equal(mEnd, expected.end, `${expected.month} end balance`);
        assert.equal(
          Math.round((expected.start + mDebits - mCredits) * 100) / 100,
          expected.end,
          `${expected.month} mathematical identity: start + debits - credits == end`
        );
      }
    });
  });
});

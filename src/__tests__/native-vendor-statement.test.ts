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
});

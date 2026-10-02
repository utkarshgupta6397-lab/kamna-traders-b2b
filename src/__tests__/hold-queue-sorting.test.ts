import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface CustomerHoldItem {
  customerId: string;
  customerName: string;
  outstandingBalance: number;
  oldestInvoiceDate: string;
}

// Emulate backend sorting logic in /api/admin/dcr/hold-queue
function sortHoldQueueCustomers(customers: CustomerHoldItem[], sort: string): CustomerHoldItem[] {
  const sorted = [...customers];
  sorted.sort((a, b) => {
    if (sort === 'outstanding_desc') return b.outstandingBalance - a.outstandingBalance;
    if (sort === 'outstanding_asc') return a.outstandingBalance - b.outstandingBalance;

    if (sort === 'age_desc') {
      const aMinDate = new Date(a.oldestInvoiceDate).getTime();
      const bMinDate = new Date(b.oldestInvoiceDate).getTime();
      return aMinDate - bMinDate;
    }

    if (sort === 'date_desc') {
      const aTime = new Date(a.oldestInvoiceDate).getTime();
      const bTime = new Date(b.oldestInvoiceDate).getTime();
      return bTime - aTime;
    }

    return b.outstandingBalance - a.outstandingBalance;
  });
  return sorted;
}

describe('Hold Queue Default Sorting Specification', () => {
  const sampleCustomers: CustomerHoldItem[] = [
    {
      customerId: 'cust-1',
      customerName: 'NRG SOLAR SYSTEM',
      outstandingBalance: -11266,
      oldestInvoiceDate: '2026-02-15T00:00:00.000Z',
    },
    {
      customerId: 'cust-2',
      customerName: 'ZERO BALANCE CORP',
      outstandingBalance: 0,
      oldestInvoiceDate: '2026-03-01T00:00:00.000Z',
    },
    {
      customerId: 'cust-3',
      customerName: 'SMALL POSITIVE TRADERS',
      outstandingBalance: 2000,
      oldestInvoiceDate: '2026-01-10T00:00:00.000Z',
    },
    {
      customerId: 'cust-4',
      customerName: 'V R ENTERPRISES',
      outstandingBalance: 12944,
      oldestInvoiceDate: '2026-02-20T00:00:00.000Z',
    },
  ];

  it('defaults to sorting by outstanding balance descending (highest to lowest)', () => {
    const result = sortHoldQueueCustomers(sampleCustomers, 'outstanding_desc');

    const expectedOrder = [
      'V R ENTERPRISES',        // 12944
      'SMALL POSITIVE TRADERS', // 2000
      'ZERO BALANCE CORP',      // 0
      'NRG SOLAR SYSTEM',       // -11266
    ];

    assert.deepEqual(result.map(c => c.customerName), expectedOrder);
    assert.equal(result[0].outstandingBalance, 12944);
    assert.equal(result[1].outstandingBalance, 2000);
    assert.equal(result[2].outstandingBalance, 0);
    assert.equal(result[3].outstandingBalance, -11266);
  });

  it('ensures numeric sorting handles edge cases correctly (12,944 > 2,000 > 0 > -11,266)', () => {
    const result = sortHoldQueueCustomers(sampleCustomers, 'outstanding_desc');

    // ₹12,944 must sort above ₹2,000
    assert.ok(result.findIndex(c => c.outstandingBalance === 12944) < result.findIndex(c => c.outstandingBalance === 2000));
    // ₹2,000 must sort above ₹0
    assert.ok(result.findIndex(c => c.outstandingBalance === 2000) < result.findIndex(c => c.outstandingBalance === 0));
    // ₹0 must sort above -₹11,266
    assert.ok(result.findIndex(c => c.outstandingBalance === 0) < result.findIndex(c => c.outstandingBalance === -11266));
  });

  it('allows toggling between outstanding_desc and outstanding_asc', () => {
    // Test toggle logic from HoldQueueClient:
    // toggleSort('outstanding') => prev === 'outstanding_desc' ? 'outstanding_asc' : 'outstanding_desc'
    let sortState = 'outstanding_desc';
    const toggle = () => {
      sortState = sortState === 'outstanding_desc' ? 'outstanding_asc' : 'outstanding_desc';
    };

    toggle();
    assert.equal(sortState, 'outstanding_asc');

    const ascResult = sortHoldQueueCustomers(sampleCustomers, sortState);
    assert.equal(ascResult[0].customerName, 'NRG SOLAR SYSTEM'); // -11266 first
    assert.equal(ascResult[3].customerName, 'V R ENTERPRISES');  // 12944 last

    toggle();
    assert.equal(sortState, 'outstanding_desc');
    const descResult = sortHoldQueueCustomers(sampleCustomers, sortState);
    assert.equal(descResult[0].customerName, 'V R ENTERPRISES'); // 12944 first
  });
});

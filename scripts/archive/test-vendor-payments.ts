import { getCustomerStatement } from './src/lib/zoho/customer-statement';

async function main() {
  const customerId = '1759923000021105908'; // SUN POWER PHOTOVOLTAIC
  console.log(`Testing getCustomerStatement for ${customerId}...`);
  const result = await getCustomerStatement(customerId);
  
  if (!result.success) {
    console.error('Failed:', result.error);
    return;
  }
  
  const data = result.data;
  console.log('Customer:', data.customer.companyName);
  console.log('Is Hybrid:', data.isHybrid);
  console.log('Outstanding Receivable:', data.outstandingReceivable);
  console.log('Outstanding Payable:', data.outstandingPayable);
  console.log('Closing Balance:', data.closingBalance);
  
  console.log(`\nTransactions (${data.transactions.length}):`);
  
  // Filter only vendor payments just to check if they were fetched
  const vendorPayments = data.transactions.filter(t => t.type === 'vendor_payment');
  console.log(`Found ${vendorPayments.length} vendor_payment transactions:`);
  
  for (const vp of vendorPayments) {
    console.log(`- [${vp.date}] ${vp.description} | Amount: ${vp.amount} | Net Effect: ${vp.netEffect}`);
    if (vp.appliedBills && vp.appliedBills.length > 0) {
      console.log(`    Applied to ${vp.appliedBills.length} bills:`, vp.appliedBills);
    }
  }
  
  // Also print the last 5 transactions to verify chronological ordering and running balance
  console.log('\nLast 5 transactions (newest first):');
  for (const t of data.transactions.slice(0, 5)) {
    console.log(`[${t.date}] ${t.type.padEnd(14)} | Amt: ${String(t.amount).padEnd(8)} | Net: ${String(t.netEffect).padEnd(8)} | Bal: ${t.balanceAfter}`);
  }
}

main().catch(console.error);

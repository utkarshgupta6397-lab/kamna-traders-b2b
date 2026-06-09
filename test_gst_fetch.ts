import { getCustomerById } from './src/lib/zoho/customer-statement';
import { prisma } from './src/lib/db';

async function test() {
  const customerId = '1759923000008474337';
  console.log('Fetching customer:', customerId);
  const result = await getCustomerById(customerId);
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());

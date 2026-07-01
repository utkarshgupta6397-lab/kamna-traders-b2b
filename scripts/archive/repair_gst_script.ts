import { PrismaClient } from '@prisma/client';
import { getZohoTokens } from './src/lib/zoho-auth';
import { getCustomerById } from './src/lib/zoho/customer-statement';

const prisma = new PrismaClient();

async function run() {
  const customers = await prisma.customer.findMany({
    where: { gstNumber: 'NOT_AVAILABLE' }
  });

  console.log(`[REPORT] Found ${customers.length} customers with gstNumber = 'NOT_AVAILABLE'`);

  // Uncomment to run data repair
  /*
  const token = await getZohoTokens();
  if (!token) {
    console.error('Failed to get Zoho token');
    return;
  }

  console.log('Starting data repair...');
  let fixedCount = 0;
  for (const customer of customers) {
    console.log(`Fetching GST for ${customer.id} (${customer.name})...`);
    const result = await getCustomerById(customer.id);
    if (result.success && result.data?.gstNo) {
      const gstNo = result.data.gstNo.trim();
      if (gstNo !== '') {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { gstNumber: gstNo }
        });
        console.log(`[FIXED] Customer ${customer.id} -> ${gstNo}`);
        fixedCount++;
      }
    } else {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { gstNumber: null }
      });
      console.log(`[CLEARED] Customer ${customer.id} lock cleared (No valid GST found in Zoho)`);
    }
  }
  console.log(`Repair complete. Fixed: ${fixedCount}, Total Processed: ${customers.length}`);
  */
}

run().catch(console.error).finally(() => prisma.$disconnect());

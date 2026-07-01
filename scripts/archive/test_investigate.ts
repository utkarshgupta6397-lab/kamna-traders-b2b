import { searchInvoiceByNumber, fetchInvoiceById } from './src/lib/zoho/invoices';
import { ingestZohoInvoice } from './src/lib/dcr-ingestion';
import { prisma } from './src/lib/db';

async function testInvoice() {
  const invoiceNum = 'KT/26-27/1028';
  console.log(`[Test] Searching for invoice ${invoiceNum}`);
  
  try {
    const searchRes = await searchInvoiceByNumber(invoiceNum);
    console.log(`[Test] Search result count: ${searchRes.invoices.length}`);
    
    if (searchRes.invoices.length > 0) {
      const invoice = searchRes.invoices[0];
      console.log(`[Test] Found invoice ID: ${invoice.invoice_id}`);
      
      console.log(`[Test] Starting ingestion...`);
      const ingestRes = await ingestZohoInvoice(invoice.invoice_id, 'SYSTEM_TEST', 'MANUAL');
      console.log(`[Test] Ingestion result:`, ingestRes);
    } else {
      console.log(`[Test] Invoice not found in Zoho!`);
    }
  } catch (error) {
    console.error(`[Test] Error caught:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

testInvoice();

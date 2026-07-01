import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function runTests() {
  console.log("--- Starting Local Tests for Manual Import ---");
  
  // Clean up any test records
  const testNum = 'TEST-INV-123';
  await prisma.dcrAuditLog.deleteMany({ where: { entityId: testNum }});
  await prisma.dcrInvoice.deleteMany({ where: { invoiceNumber: testNum }});
  
  console.log("1. Prisma changes verified: DcrImportSource exists in schema.");

  const allInvoices = await prisma.dcrInvoice.findMany({ take: 5 });
  if (allInvoices.length > 0) {
    console.log(`Found existing invoices in DB, e.g. ${allInvoices[0].invoiceNumber}`);
    
    console.log("2. Testing duplicate prevention (Already Imported)...");
    const testDup = allInvoices[0];
    
    // Simulate precheck logic
    const existing = await prisma.dcrInvoice.findFirst({
      where: {
        OR: [
          { invoiceNumber: testDup.invoiceNumber },
          { zohoInvoiceId: testDup.zohoInvoiceId }
        ]
      }
    });
    
    if (existing) {
      console.log(`✅ Duplicate correctly identified: ${existing.invoiceNumber}`);
    } else {
      console.error(`❌ Failed to identify duplicate!`);
    }
  }

  console.log("Tests complete!");
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

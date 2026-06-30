const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoice = await prisma.dcrInvoice.findFirst({
    where: { invoiceNumber: 'KT/26-27/1470' },
  });

  if (!invoice) {
    console.log("Invoice not found");
    return;
  }

  const allocations = await prisma.dcrSerialAllocation.findMany({
    where: { invoiceId: invoice.id },
    orderBy: { allocatedAt: 'asc' },
    include: {
      invoiceItem: {
        select: { sku: true }
      }
    }
  });

  console.log(`Found ${allocations.length} allocations.`);
  allocations.forEach(a => {
    console.log(`${a.serialNumber} | ${a.invoiceItem?.sku} | ${a.allocatedAt.toISOString()} | allocatedBy: ${a.allocatedBy}`);
  });

  const auditLogs = await prisma.dcrAuditLog.findMany({
    where: { entityId: invoice.id },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\nFound ${auditLogs.length} audit logs for invoice.`);
  auditLogs.forEach(log => {
    console.log(`${log.createdAt.toISOString()} | Action: ${log.action} | User: ${log.userId} | Metadata: ${JSON.stringify(log.metadata)}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

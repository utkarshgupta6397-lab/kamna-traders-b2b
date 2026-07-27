const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const invByNumber = await prisma.dcrInvoice.findFirst({
    where: { invoiceNumber: 'KT/26-27/2062' },
    include: {
      items: {
        include: {
          serialAllocations: {
            include: {
              serial: true
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(invByNumber, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

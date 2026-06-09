import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const q = "";
    const whereClause: any = {};
    const queryArgs: any = {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        allocations: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                customerName: true,
                zohoInvoiceId: true,
                dcrStatus: true
              }
            },
            invoiceItem: {
              select: {
                itemName: true,
                sku: true
              }
            }
          },
          orderBy: { allocatedAt: 'desc' },
          take: 1
        },
        tag: true
      },
      skip: 0,
      take: 50
    };

    const serials = await prisma.dcrSerial.findMany(queryArgs);
    console.log("Success", serials.length);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();

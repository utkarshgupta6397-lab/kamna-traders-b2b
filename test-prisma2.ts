import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const q = "";
    const whereClause: any = {};
    if (q.length >= 3) {
      whereClause.OR = [
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { vendorName: { contains: q, mode: 'insensitive' } },
        {
          allocations: {
            some: {
              invoice: {
                OR: [
                  { invoiceNumber: { contains: q, mode: 'insensitive' } },
                  { customerName: { contains: q, mode: 'insensitive' } },
                ]
              }
            }
          }
        },
        {
          allocations: {
            some: {
              invoiceItem: {
                OR: [
                  { itemName: { contains: q, mode: 'insensitive' } },
                  { sku: { contains: q, mode: 'insensitive' } },
                ]
              }
            }
          }
        },
        {
          tag: {
            tag: { contains: q, mode: 'insensitive' }
          }
        }
      ];
    }
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

    const [serials, total] = await Promise.all([
      prisma.dcrSerial.findMany(queryArgs),
      prisma.dcrSerial.count({ where: whereClause })
    ]);
    console.log("Total:", total, "Serials count:", serials.length);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();

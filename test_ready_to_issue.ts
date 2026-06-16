import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const whereClause: any = {
      invoiceStatus: { not: 'void' },
      serialAllocations: {
        some: {
          serial: {
            status: 'READY_TO_ISSUE'
          }
        }
      }
    };

    console.log("Running query...");
    const [invoices, totalCount, kpiSerialData] = await Promise.all([
      prisma.dcrInvoice.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 50,
        include: {
          items: {
            where: { selectedForDCR: true },
            include: {
              serialAllocations: {
                include: {
                  serial: { select: { id: true, serialNumber: true, status: true, tag: true, vendorDcrStatus: true } }
                },
                orderBy: { allocatedAt: 'asc' }
              }
            }
          }
        }
      }),
      prisma.dcrInvoice.count({ where: whereClause }),
      prisma.dcrSerial.count({ where: { status: 'READY_TO_ISSUE' } })
    ]);

    console.log(`Found ${invoices.length} invoices, totalCount: ${totalCount}, kpi: ${kpiSerialData}`);

    const customerIds = Array.from(new Set(invoices.map(inv => inv.customerId)));
    const localCustomers = await prisma.customer.findMany({
      where: { id: { in: customerIds } }
    });
    const customerGstMap = new Map(localCustomers.map(c => [c.id, c.gstNumber]));

    const formattedInvoices = invoices.map(inv => {
      const skuGroups = inv.items.map(item => {
        const eligibleSerials = item.serialAllocations.filter(alloc => alloc.serial?.status === 'READY_TO_ISSUE');
        return {
          itemId: item.id,
          itemName: item.itemName,
          sku: item.sku,
          quantity: item.quantity,
          serials: item.serialAllocations.map(alloc => {
            const rawTag: any = alloc.serial?.tag;
            const tagString = rawTag ? (typeof rawTag === 'string' ? rawTag : rawTag.tag) : null;
            return {
              allocationId: alloc.id,
              serialNumber: alloc.serialNumber,
              status: alloc.serial?.status,
              serialTag: tagString,
              vendorDcrStatus: alloc.serial?.vendorDcrStatus,
            };
          }),
          allocatedCount: item.serialAllocations.length,
          eligibleCount: eligibleSerials.length,
        };
      });

      const totalAllocated = skuGroups.reduce((s, g) => s + g.allocatedCount, 0);
      const totalEligible = skuGroups.reduce((s, g) => s + g.eligibleCount, 0);

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        zohoInvoiceId: inv.zohoInvoiceId,
        customerId: inv.customerId,
        customerName: inv.customerName,
        customer_gst_no: customerGstMap.get(inv.customerId) || null,
        invoiceDate: inv.invoiceDate,
        invoiceTotal: inv.invoiceTotal,
        dcrStatus: inv.dcrStatus,
        totalSerials: totalEligible,
        totalAllocated,
        totalEligible,
        skuGroups,
      };
    }).filter(inv => inv.totalEligible > 0);

    console.log(`Formatted ${formattedInvoices.length} invoices`);
  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

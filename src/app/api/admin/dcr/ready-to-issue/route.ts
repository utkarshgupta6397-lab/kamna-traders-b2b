import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'));
    const skip = (page - 1) * limit;

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
    
    if (search) {
      whereClause.AND = [
        {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            {
              serialAllocations: {
                some: { serialNumber: { contains: search, mode: 'insensitive' } }
              }
            }
          ]
        }
      ];
    }

    const [invoices, totalCount, kpiSerialData] = await Promise.all([
      prisma.dcrInvoice.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: {
            where: { selectedForDCR: true },
            include: {
              serialAllocations: {
                include: {
                  serial: { select: { id: true, serialNumber: true, status: true } }
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

    // Load local customer records corresponding to the returned invoices' customerId
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
          serials: item.serialAllocations.map(alloc => ({
            allocationId: alloc.id,
            serialNumber: alloc.serialNumber,
            status: alloc.serial?.status,
          })),
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

    return NextResponse.json({ 
      invoices: formattedInvoices, 
      total: totalCount, 
      page, 
      limit,
      kpis: {
        invoicesReady: totalCount,
        serialsReady: kpiSerialData
      }
    });
  } catch (error: any) {
    console.error('[DCR Ready To Issue GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch ready-to-issue list' }, { status: 500 });
  }
}

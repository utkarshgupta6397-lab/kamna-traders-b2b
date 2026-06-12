import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_hold_release && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'));
    const skip = (page - 1) * limit;
    
    const sort = searchParams.get('sort') || 'outstanding_desc';

    // --- Build where clause ---
    const whereClause: any = {
      invoiceStatus: { not: 'void' },
      serialAllocations: {
        some: {
          serial: {
            vendorDcrStatus: 'RECEIVED',
            status: { notIn: ['READY_TO_ISSUE', 'ISSUED'] }
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

    // Fetch ALL matching invoices without DB pagination
    const allInvoices = await prisma.dcrInvoice.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            serialAllocations: {
              include: {
                serial: {
                  select: { id: true, serialNumber: true, status: true, vendorDcrStatus: true, skuId: true }
                }
              },
              orderBy: { allocatedAt: 'asc' }
            }
          }
        }
      }
    });

    // Format all invoices
    const formattedInvoices = allInvoices.map(inv => {
      // Group allocations by SKU (DcrInvoiceItem)
      const skuGroups = inv.items.map(item => {
        const serials = item.serialAllocations.map(alloc => ({
          allocationId: alloc.id,
          serialNumber: alloc.serialNumber,
          status: alloc.serial?.status || 'ALLOCATED',
          vendorDcrStatus: alloc.serial?.vendorDcrStatus || 'NOT_RECEIVED',
          isEligible: alloc.serial?.vendorDcrStatus === 'RECEIVED',
          isReleased: alloc.serial?.status === 'READY_TO_ISSUE' || alloc.serial?.status === 'ISSUED',
        }));

        const eligibleSerials = serials.filter(s => s.isEligible && !s.isReleased);
        const releasedSerials = serials.filter(s => s.isReleased);

        return {
          itemId: item.id,
          itemName: item.itemName,
          sku: item.sku,
          quantity: item.quantity,
          selectedForDCR: item.selectedForDCR,
          totalSerials: serials.length,
          eligibleSerials: eligibleSerials.length,
          releasedSerials: releasedSerials.length,
          serials,
        };
      });

      const totalSerials = skuGroups.reduce((s, g) => s + g.totalSerials, 0);
      const totalEligible = skuGroups.reduce((s, g) => s + g.eligibleSerials, 0);
      const totalReleased = skuGroups.reduce((s, g) => s + g.releasedSerials, 0);
      const releasePercentage = totalEligible > 0 ? Math.round((totalReleased / totalEligible) * 100) : 0;
      const outstandingBalance = inv.outstandingAmount || 0;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        zohoInvoiceId: inv.zohoInvoiceId,
        customerName: inv.customerName,
        customerId: inv.customerId,
        invoiceDate: inv.invoiceDate,
        invoiceTotal: inv.invoiceTotal,
        dcrStatus: inv.dcrStatus,
        outstandingBalance,
        outstandingUpdatedAt: inv.outstandingUpdatedAt,
        totalSerials,
        totalEligible,
        totalReleased,
        releasePercentage,
        skuGroups,
      };
    });

    // Group by customer
    const customerMap = new Map<string, any>();
    for (const inv of formattedInvoices) {
      if (!customerMap.has(inv.customerId)) {
        customerMap.set(inv.customerId, {
          customerId: inv.customerId,
          customerName: inv.customerName,
          customerGstNo: null,
          outstandingBalance: 0,
          totalInvoices: 0,
          totalSerials: 0,
          serialsOnHold: 0,
          serialsIssued: 0,
          serialsDcrPending: 0,
          oldestInvoiceDate: null,
          invoices: []
        });
      }
      
      const cust = customerMap.get(inv.customerId);
      cust.invoices.push(inv);
      cust.totalInvoices += 1;
      
      // Calculate serial stats
      for (const group of inv.skuGroups) {
        cust.totalSerials += group.totalSerials;
        for (const serial of group.serials) {
          if (serial.status === 'ISSUED') {
            cust.serialsIssued += 1;
          } else if (serial.status === 'HOLD' || serial.status !== 'READY_TO_ISSUE') {
            // Include ALLOCATED etc as "Hold" logically for this page
            cust.serialsOnHold += 1;
          }
          if (serial.vendorDcrStatus !== 'RECEIVED') {
            cust.serialsDcrPending += 1;
          }
        }
      }
    }

    const customers = Array.from(customerMap.values());

    // Load local customer records to get GST and accurately set customer-level outstanding balance if available
    // But since the outstanding logic across held invoices wants a sum, we'll keep the sum of pending balances across held invoices.
    // Wait, the user asked for: "Outstanding Balance: Sum of pending balances across all held invoices."
    // So we just sum the outstandingBalance of the held invoices we just formatted.
    
    const localCustomers = await prisma.customer.findMany({
      where: { id: { in: customers.map(c => c.customerId) } },
      select: { id: true, gstNumber: true }
    });
    const customerDbMap = new Map(localCustomers.map(c => [c.id, c]));
    
    // We get the accurate customer-wide outstanding balance from the DB balance if preferred, 
    // but the spec specifically says: "Outstanding Balance: Sum of pending balances across all held invoices."
    for (const c of customers) {
      c.customerGstNo = customerDbMap.get(c.customerId)?.gstNumber || null;
      c.outstandingBalance = c.invoices.reduce((sum: number, inv: any) => sum + inv.outstandingBalance, 0);
      c.oldestInvoiceDate = new Date(Math.min(...c.invoices.map((i: any) => new Date(i.invoiceDate).getTime()))).toISOString();
    }

    // Sort customers
    customers.sort((a, b) => {
      if (sort === 'outstanding_desc') return b.outstandingBalance - a.outstandingBalance;
      if (sort === 'outstanding_asc') return a.outstandingBalance - b.outstandingBalance;
      
      if (sort === 'age_desc') {
        const aMinDate = new Date(a.oldestInvoiceDate).getTime();
        const bMinDate = new Date(b.oldestInvoiceDate).getTime();
        return aMinDate - bMinDate; // smallest timestamp (oldest) first
      }
      
      if (sort === 'date_desc') {
        const aMaxDate = Math.max(...a.invoices.map((i: any) => new Date(i.invoiceDate).getTime()));
        const bMaxDate = Math.max(...b.invoices.map((i: any) => new Date(i.invoiceDate).getTime()));
        return bMaxDate - aMaxDate; // largest timestamp (newest) first
      }

      return b.outstandingBalance - a.outstandingBalance;
    });

    const totalCount = customers.length;
    const paginatedCustomers = customers.slice(skip, skip + limit);

    // --- KPIs ---
    const kpiWhereClause: any = {
      invoiceStatus: { not: 'void' },
      serialAllocations: {
        some: {
          serial: {
            vendorDcrStatus: 'RECEIVED',
            status: { notIn: ['READY_TO_ISSUE', 'ISSUED'] }
          }
        }
      }
    };

    const [invoicesOnHoldCount, readyToIssueCount, holdSerialData] = await Promise.all([
      prisma.dcrInvoice.count({ where: kpiWhereClause }),
      prisma.dcrInvoice.count({ where: { dcrStatus: 'READY_TO_ISSUE', invoiceStatus: { not: 'void' } } }),
      prisma.dcrSerialAllocation.findMany({
        where: {
          serial: {
            vendorDcrStatus: 'RECEIVED',
            status: { notIn: ['READY_TO_ISSUE', 'ISSUED'] }
          }
        },
        select: { id: true }
      })
    ]);

    const serialsOnHoldCount = holdSerialData.length;
    const outstandingValueOnHold = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);

    let zohoApiCallsToday = 0;
    try {
      const { getZohoApiUsage } = await import('@/lib/zoho-api-meter');
      zohoApiCallsToday = getZohoApiUsage().today;
    } catch(e) {
      console.error('Could not get Zoho API Usage:', e);
    }

    return NextResponse.json({
      customers: paginatedCustomers,
      total: totalCount,
      page,
      limit,
      kpis: {
        customersOnHold: totalCount,
        invoicesOnHold: invoicesOnHoldCount,
        serialsOnHold: serialsOnHoldCount,
        readyToIssue: readyToIssueCount,
        outstandingValueOnHold,
        zohoApiCallsToday,
      }
    });
  } catch (error: any) {
    console.error('[DCR Hold Queue GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch hold queue' }, { status: 500 });
  }
}

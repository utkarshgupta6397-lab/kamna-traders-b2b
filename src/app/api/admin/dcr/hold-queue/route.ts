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

    // --- Fetch outstanding balance cache (informational only) ---
    let outstandingByCustomer: Record<string, number> = {};
    try {
      const cache = await prisma.invoiceSummaryCache.findUnique({ where: { id: 'singleton' } });
      if (cache?.rows) {
        const rows = cache.rows as any[];
        rows.forEach((row: any) => {
          if (row.customerId && row.amountPending != null) {
            // Sum pending amounts per customerId in case of multiple rows
            outstandingByCustomer[row.customerId] = (outstandingByCustomer[row.customerId] || 0) + (row.amountPending || 0);
          }
        });
      }
    } catch (_) {
      // Cache unavailable — proceed without outstanding balance data
    }

    // --- Build where clause ---
    const whereClause: any = {
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

    const [invoices, totalCount] = await Promise.all([
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
                  serial: {
                    select: { id: true, serialNumber: true, status: true, vendorDcrStatus: true, skuId: true }
                  }
                },
                orderBy: { allocatedAt: 'asc' }
              }
            }
          }
        }
      }),
      prisma.dcrInvoice.count({ where: whereClause })
    ]);

    // --- Format invoices ---
    const formattedInvoices = invoices.map(inv => {
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

        const eligibleSerials = serials.filter(s => s.isEligible);
        const releasedSerials = serials.filter(s => s.isReleased);

        return {
          itemId: item.id,
          itemName: item.itemName,
          sku: item.sku,
          quantity: item.quantity,
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
      const outstandingBalance = outstandingByCustomer[inv.customerId] || 0;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerId: inv.customerId,
        invoiceDate: inv.invoiceDate,
        invoiceTotal: inv.invoiceTotal,
        dcrStatus: inv.dcrStatus,
        outstandingBalance,
        totalSerials,
        totalEligible,
        totalReleased,
        releasePercentage,
        skuGroups,
      };
    });

    // --- KPIs ---
    const kpiWhereClause = {
      serialAllocations: {
        some: {
          serial: {
            vendorDcrStatus: 'RECEIVED',
            status: { notIn: ['READY_TO_ISSUE', 'ISSUED'] }
          }
        }
      }
    };

    const [invoicesOnHold, readyToIssueCount, holdSerialData] = await Promise.all([
      prisma.dcrInvoice.count({ where: kpiWhereClause }),
      prisma.dcrInvoice.count({ where: { dcrStatus: 'READY_TO_ISSUE' } }),
      prisma.dcrSerialAllocation.findMany({
        where: {
          serial: {
            vendorDcrStatus: 'RECEIVED',
            status: { notIn: ['READY_TO_ISSUE', 'ISSUED'] }
          }
        },
        select: { id: true, serial: { select: { status: true } } }
      })
    ]);

    const serialsOnHold = holdSerialData.length;
    const outstandingValueOnHold = formattedInvoices.reduce((s, inv) => s + inv.outstandingBalance, 0);

    return NextResponse.json({
      invoices: formattedInvoices,
      total: totalCount,
      page,
      limit,
      kpis: {
        invoicesOnHold,
        serialsOnHold,
        readyToIssue: readyToIssueCount,
        outstandingValueOnHold,
      }
    });
  } catch (error: any) {
    console.error('[DCR Hold Queue GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch hold queue' }, { status: 500 });
  }
}

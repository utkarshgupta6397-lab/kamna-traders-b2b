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
    const view = searchParams.get('view') || 'active'; // 'active' | 'completed'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const sort = searchParams.get('sort') || 'newest'; // 'newest' | 'oldest'
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (view === 'active') {
      whereClause.dcrStatus = { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] };
    } else {
      // Completed queue includes READY_FOR_DCR and beyond
      whereClause.dcrStatus = { in: ['READY_FOR_DCR', 'READY_TO_ISSUE', 'ISSUED'] };
    }

    if (search) {
      whereClause.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy: any = {};
    if (sort === 'oldest') {
      orderBy.invoiceDate = 'asc';
    } else {
      orderBy.invoiceDate = 'desc';
    }

    // Fetch invoices
    const [invoices, totalCount] = await Promise.all([
      prisma.dcrInvoice.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        include: {
          items: {
            where: { selectedForDCR: true },
            include: {
              serialAllocations: true
            }
          },
          serialAllocations: true,
        }
      }),
      prisma.dcrInvoice.count({
        where: whereClause,
      })
    ]);

    // Format invoices to include required, allocated, balance quantities
    const formattedInvoices = invoices.map(inv => {
      const dcrItems = inv.items.map(item => {
        const required = item.quantity;
        const allocated = item.serialAllocations.length;
        const balance = Math.max(0, required - allocated);
        return {
          id: item.id,
          itemName: item.itemName,
          sku: item.sku,
          required,
          allocated,
          balance,
        };
      });

      const totalRequired = dcrItems.reduce((acc, i) => acc + i.required, 0);
      const totalAllocated = dcrItems.reduce((acc, i) => acc + i.allocated, 0);
      const totalBalance = Math.max(0, totalRequired - totalAllocated);

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        invoiceDate: inv.invoiceDate,
        dcrStatus: inv.dcrStatus,
        dcrItems,
        totalRequired,
        totalAllocated,
        totalBalance,
      };
    });

    // --- Calculate KPIs ---
    // 1. Invoices Waiting: invoices currently in PENDING_SERIALS or PARTIALLY_ALLOCATED status
    const invoicesWaiting = await prisma.dcrInvoice.count({
      where: { dcrStatus: { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] } }
    });

    // 2. Total Serials Pending: sum of remaining quantities for all active invoices
    const pendingInvoicesWithItems = await prisma.dcrInvoice.findMany({
      where: { dcrStatus: { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] } },
      include: {
        items: {
          where: { selectedForDCR: true },
          include: {
            serialAllocations: true
          }
        }
      }
    });

    let totalSerialsPending = 0;
    pendingInvoicesWithItems.forEach(inv => {
      inv.items.forEach(item => {
        const required = item.quantity;
        const allocated = item.serialAllocations.length;
        totalSerialsPending += Math.max(0, required - allocated);
      });
    });

    // 3. Partially Allocated: Count of invoices in PARTIALLY_ALLOCATED status
    const partiallyAllocated = await prisma.dcrInvoice.count({
      where: { dcrStatus: 'PARTIALLY_ALLOCATED' }
    });

    // 4. Completed Today: Count of invoices that transitioned to READY_FOR_DCR today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const completedToday = await prisma.dcrInvoice.count({
      where: {
        dcrStatus: { in: ['READY_FOR_DCR', 'READY_TO_ISSUE', 'ISSUED'] },
        updatedAt: { gte: startOfToday }
      }
    });

    return NextResponse.json({
      invoices: formattedInvoices,
      total: totalCount,
      page,
      limit,
      kpis: {
        invoicesWaiting,
        totalSerialsPending,
        partiallyAllocated,
        completedToday
      }
    });
  } catch (error: any) {
    console.error('[DCR Pending Serials List GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch pending serials list' }, { status: 500 });
  }
}

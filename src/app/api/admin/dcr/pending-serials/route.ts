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

    const chip = searchParams.get('chip') || 'all';

    const whereClause: any = { invoiceStatus: { not: 'void' } };

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

    // Fetch ALL matching invoices to perform in-memory sort/filter
    const allInvoices = await prisma.dcrInvoice.findMany({
      where: whereClause,
      include: {
        items: {
          where: { selectedForDCR: true },
          include: {
            serialAllocations: true
          }
        },
        serialAllocations: true,
      }
    });

    // Format and calculate fields
    let formattedInvoices = allInvoices.map(inv => {
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
      const remainingSerials = Math.max(0, totalRequired - totalAllocated);
      const allocationProgress = totalRequired === 0 ? 100 : Math.round((totalAllocated / totalRequired) * 100);

      return {
        id: inv.id,
        zohoInvoiceId: inv.zohoInvoiceId,
        customerId: inv.customerId,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        invoiceDate: inv.invoiceDate,
        invoiceValue: inv.invoiceTotal || 0,
        dcrStatus: inv.dcrStatus,
        dcrItems,
        dcrItemCount: dcrItems.length,
        totalRequired,
        totalAllocated,
        remainingSerials,
        allocationProgress,
        totalBalance: remainingSerials
      };
    });

    // Apply Chip Filters
    if (chip === 'partially_allocated') {
      formattedInvoices = formattedInvoices.filter(i => i.totalAllocated > 0);
    } else if (chip === 'unallocated') {
      formattedInvoices = formattedInvoices.filter(i => i.totalAllocated === 0);
    } else if (chip === 'nearly_complete') {
      formattedInvoices = formattedInvoices.filter(i => i.allocationProgress >= 80);
    }

    // Apply Sorting
    // If chip === 'largest_pending', force PENDING_DESC sort override
    const activeSort = chip === 'largest_pending' ? 'PENDING_DESC' : sort.toUpperCase();

    formattedInvoices.sort((a, b) => {
      switch (activeSort) {
        case 'NEWEST':
          return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'OLDEST':
          return new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
        case 'PENDING_DESC':
          return b.remainingSerials - a.remainingSerials || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'PENDING_ASC':
          return a.remainingSerials - b.remainingSerials || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'VALUE_DESC':
          return b.invoiceValue - a.invoiceValue || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'VALUE_ASC':
          return a.invoiceValue - b.invoiceValue || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'PROGRESS_DESC':
          return b.allocationProgress - a.allocationProgress || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'PROGRESS_ASC':
          return a.allocationProgress - b.allocationProgress || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'DCR_ITEMS_DESC':
          return b.dcrItemCount - a.dcrItemCount || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'DCR_ITEMS_ASC':
          return a.dcrItemCount - b.dcrItemCount || new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        case 'CUSTOMER_ASC':
          return a.customerName.localeCompare(b.customerName);
        case 'CUSTOMER_DESC':
          return b.customerName.localeCompare(a.customerName);
        default:
          return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
      }
    });

    const totalCount = formattedInvoices.length;
    
    // Apply Pagination
    formattedInvoices = formattedInvoices.slice(skip, skip + limit);

    // --- Calculate KPIs ---
    // 1. Invoices Waiting: invoices currently in PENDING_SERIALS or PARTIALLY_ALLOCATED status
    const invoicesWaiting = await prisma.dcrInvoice.count({
      where: { dcrStatus: { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] }, invoiceStatus: { not: 'void' } }
    });

    // 2. Total Serials Pending: sum of remaining quantities for all active invoices
    const pendingInvoicesWithItems = await prisma.dcrInvoice.findMany({
      where: { dcrStatus: { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] }, invoiceStatus: { not: 'void' } },
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
      where: { dcrStatus: 'PARTIALLY_ALLOCATED', invoiceStatus: { not: 'void' } }
    });

    // 4. Completed Today: Count of invoices that transitioned to READY_FOR_DCR today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const completedToday = await prisma.dcrInvoice.count({
      where: {
        dcrStatus: { in: ['READY_FOR_DCR', 'READY_TO_ISSUE', 'ISSUED'] },
        invoiceStatus: { not: 'void' },
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

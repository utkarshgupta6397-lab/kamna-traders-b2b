import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Post-Dispatch access required.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'all'; // all | pending | verification | archived
  const search = (searchParams.get('search') || '').trim();

  try {
    const where: any = {};

    // Tab filter
    if (tab === 'archived') {
      where.erpStatus = 'Archived';
    } else if (tab === 'verification') {
      where.erpStatus = 'Active';
      where.workflows = {
        some: {
          status: 'AWAITING_VERIFICATION',
        },
      };
    } else if (tab === 'pending') {
      where.erpStatus = 'Active';
      where.workflows = {
        some: {
          status: { in: ['PENDING', 'REWORK_REQUIRED'] },
        },
      };
    } else {
      // 'all' tab shows all active invoices by default, or all if searching
      if (!search) {
        where.erpStatus = 'Active';
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { salesOrderNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const invoices = await prisma.postDispatchInvoice.findMany({
      where,
      include: {
        workflows: {
          include: {
            submissions: {
              orderBy: { submissionNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { zohoCreatedTime: 'desc' },
      take: 100,
    });

    const now = new Date();

    const formatted = invoices.map((inv) => {
      // Invoice timer starts strictly from zohoCreatedTime
      const startTime = new Date(inv.zohoCreatedTime).getTime();
      const endTime = inv.timerStoppedAt ? new Date(inv.timerStoppedAt).getTime() : now.getTime();
      const elapsedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

      const receivingWf = inv.workflows.find((w) => w.workflowType === 'RECEIVING');
      const checkedWf = inv.workflows.find((w) => w.workflowType === 'CHECKED');
      const inventoryWf = inv.workflows.find((w) => w.workflowType === 'INVENTORY_DEDUCTION');

      // Calculate workflow completion count
      const completedCount = inv.workflows.filter((w) => w.status === 'COMPLETED').length;

      // Check if invoice is actionable in Post Dispatch
      // Draft invoices MUST be imported and visible, but NOT actionable.
      // Invoice becomes actionable only when Zoho status = Sent.
      const isActionable = inv.zohoStatus.toLowerCase() === 'sent' && inv.erpStatus === 'Active';

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        total: inv.total,
        currencyCode: inv.currencyCode,
        salesOrderId: inv.salesOrderId,
        salesOrderNumber: inv.salesOrderNumber,
        zohoStatus: inv.zohoStatus,
        erpStatus: inv.erpStatus,
        erpSubStatus: inv.erpSubStatus,
        isActionable,
        eInvoice: {
          generated: inv.eInvoiceGenerated,
          irn: inv.eInvoiceIrn,
          ackNo: inv.eInvoiceAckNo,
          ackDate: inv.eInvoiceAckDate,
          status: inv.eInvoiceStatus,
        },
        timer: {
          startedAt: inv.zohoCreatedTime,
          stoppedAt: inv.timerStoppedAt,
          elapsedSeconds,
          isStopped: !!inv.timerStoppedAt,
        },
        workflowSummary: {
          total: 3,
          completedCount,
          receivingStatus: receivingWf?.status || 'PENDING',
          checkedStatus: checkedWf?.status || 'PENDING',
          inventoryStatus: inventoryWf?.status || 'PENDING',
        },
      };
    });

    return NextResponse.json({ invoices: formatted });
  } catch (error: any) {
    console.error('[PostDispatch Invoices API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

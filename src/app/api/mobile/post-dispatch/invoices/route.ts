import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { isConsumerCustomer } from '@/lib/post-dispatch-sync';

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
  const tab = searchParams.get('tab') || 'all'; // all | pending | verification | archived | all_pending | receiving_pending | check_pending | inventory_pending | einvoice_pending
  const search = (searchParams.get('search') || '').trim();
  const statusFilter = (searchParams.get('status') || '').trim();
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const where: any = {};

    // Tab filter
    if (tab === 'archived') {
      where.erpStatus = 'Archived';
    } else if (tab === 'receiving_pending') {
      where.erpStatus = 'Active';
      where.workflows = {
        some: {
          workflowType: 'RECEIVING',
          status: { not: 'COMPLETED' },
        },
      };
    } else if (tab === 'check_pending') {
      where.erpStatus = 'Active';
      where.workflows = {
        some: {
          workflowType: 'CHECKED',
          status: { not: 'COMPLETED' },
        },
      };
    } else if (tab === 'inventory_pending') {
      where.erpStatus = 'Active';
      where.workflows = {
        some: {
          workflowType: 'INVENTORY_DEDUCTION',
          status: { not: 'COMPLETED' },
        },
      };
    } else if (tab === 'einvoice_pending') {
      where.erpStatus = 'Active';
      where.eInvoiceGenerated = false;
      where.zohoStatus = { notIn: ['void', 'draft'] };
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
    } else if (tab === 'all_pending') {
      where.erpStatus = 'Active';
    } else {
      // 'all' tab shows all active invoices by default, or all if searching/filtering
      if (!search && !statusFilter && !startDate && !endDate) {
        where.erpStatus = 'Active';
      }
    }

    // Zoho Status filter
    if (statusFilter && statusFilter.toLowerCase() !== 'all') {
      where.zohoStatus = { equals: statusFilter, mode: 'insensitive' };
    }

    // Date range filter on zohoCreatedTime (Invoice Created At)
    if (startDate || endDate) {
      where.zohoCreatedTime = {};
      if (startDate) {
        where.zohoCreatedTime.gte = new Date(startDate);
      }
      if (endDate) {
        where.zohoCreatedTime.lte = new Date(endDate);
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
      take: 200,
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

      // Check consumer customer type
      const detailsJson = inv.zohoDetailsJson as any;
      const isConsumer = detailsJson?.gst_treatment
        ? isConsumerCustomer({ gstTreatment: detailsJson.gst_treatment })
        : false;
      const warehouseName = (detailsJson?.location_name as string) || null;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        zohoInvoiceId: inv.zohoInvoiceId,
        customerId: inv.customerId,
        customerName: inv.customerName,
        warehouseName,
        total: inv.total,
        currencyCode: inv.currencyCode,
        salesOrderId: inv.salesOrderId,
        salesOrderNumber: inv.salesOrderNumber,
        zohoStatus: inv.zohoStatus,
        erpStatus: inv.erpStatus,
        erpSubStatus: inv.erpSubStatus,
        isActionable,
        isConsumer,
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

    // Special post-processing for E-Invoice pending tab:
    // Exclude consumer invoices as they are never eligible for E-Invoicing
    const resultInvoices = tab === 'einvoice_pending'
      ? formatted.filter((inv) => !inv.isConsumer)
      : formatted;

    return NextResponse.json({ invoices: resultInvoices });
  } catch (error: any) {
    console.error('[PostDispatch Invoices API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';
import { isConsumerCustomer } from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Server-side authorization check: Admin OR dispatch_force_archive
  const canForceArchive = session.role === 'ADMIN' || Boolean(session.dispatch_force_archive);
  if (!canForceArchive) {
    return NextResponse.json(
      { error: 'Forbidden. dispatch_force_archive permission required.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
  }

  try {
    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id },
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
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.erpStatus === 'Archived' && invoice.erpSubStatus === 'Force Archived') {
      return NextResponse.json(
        { error: 'Invoice is already force-archived.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = (body?.reason || '').trim() || 'Manual administrative override';

    const previousErpStatus = invoice.erpStatus;
    const previousSubStatus = invoice.erpSubStatus;
    const now = new Date();

    // Atomic transaction: Move invoice to Archived with Force Archived sub-status without completing workflows
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.postDispatchInvoice.update({
        where: { id: invoice.id },
        data: {
          erpStatus: 'Archived',
          erpSubStatus: 'Force Archived',
          timerStoppedAt: invoice.timerStoppedAt || now,
        },
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
      });

      // Immutable audit log
      await recordPostDispatchHistory(tx, {
        invoiceId: invoice.id,
        eventType: 'INVOICE_FORCE_ARCHIVED',
        userId: session.userId || session.id,
        userName: session.name || 'Admin',
        metadata: {
          previousErpStatus,
          previousSubStatus,
          reason,
          forceArchivedAt: now.toISOString(),
        },
      });

      return inv;
    });

    const detailsJson = updated.zohoDetailsJson as any;
    const isConsumer = detailsJson?.gst_treatment
      ? isConsumerCustomer({ gstTreatment: detailsJson.gst_treatment })
      : false;
    const warehouseName = (detailsJson?.location_name as string) || null;

    let gstin: string | null = null;
    if (detailsJson?.gst_no && String(detailsJson.gst_no).trim()) {
      gstin = String(detailsJson.gst_no).trim();
    } else if (detailsJson?.shipping_gst_no && String(detailsJson.shipping_gst_no).trim()) {
      gstin = String(detailsJson.shipping_gst_no).trim();
    }

    const startTime = new Date(updated.zohoCreatedTime).getTime();
    const endTime = updated.timerStoppedAt ? new Date(updated.timerStoppedAt).getTime() : now.getTime();
    const elapsedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

    const receivingWf = updated.workflows.find((w) => w.workflowType === 'RECEIVING');
    const checkedWf = updated.workflows.find((w) => w.workflowType === 'CHECKED');
    const inventoryWf = updated.workflows.find((w) => w.workflowType === 'INVENTORY_DEDUCTION');
    const completedCount = updated.workflows.filter((w) => w.status === 'COMPLETED').length;

    const formattedInvoice = {
      id: updated.id,
      invoiceNumber: updated.invoiceNumber,
      zohoInvoiceId: updated.zohoInvoiceId,
      customerId: updated.customerId,
      customerName: updated.customerName,
      gstin,
      warehouseName,
      total: updated.total,
      currencyCode: updated.currencyCode,
      salesOrderId: updated.salesOrderId,
      salesOrderNumber: updated.salesOrderNumber,
      zohoStatus: updated.zohoStatus,
      erpStatus: updated.erpStatus,
      erpSubStatus: updated.erpSubStatus,
      isActionable: false,
      isConsumer,
      eInvoice: {
        generated: updated.eInvoiceGenerated,
        irn: updated.eInvoiceIrn,
        ackNo: updated.eInvoiceAckNo,
        ackDate: updated.eInvoiceAckDate,
        status: updated.eInvoiceStatus,
      },
      timer: {
        startedAt: updated.zohoCreatedTime.toISOString(),
        stoppedAt: updated.timerStoppedAt ? updated.timerStoppedAt.toISOString() : null,
        elapsedSeconds,
        isStopped: true,
      },
      workflowSummary: {
        total: 3,
        completedCount,
        receivingStatus: receivingWf?.status || 'PENDING',
        checkedStatus: checkedWf?.status || 'PENDING',
        inventoryStatus: inventoryWf?.status || 'PENDING',
      },
    };

    return NextResponse.json({
      success: true,
      message: 'Invoice force-archived successfully',
      invoice: formattedInvoice,
    });
  } catch (error: any) {
    console.error('[Force Archive API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to force archive invoice' },
      { status: 500 }
    );
  }
}

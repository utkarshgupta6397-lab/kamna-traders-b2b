import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';
import { logZohoApiCall, isConsumerCustomer, ZohoLineItem } from '@/lib/post-dispatch-sync';
import { Prisma } from '@prisma/client';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing Zoho organization ID');

    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Missing Zoho access token');

    // Exactly 1 targeted Zoho API request for this invoice
    await logZohoApiCall({
      endpoint: `/books/v3/invoices/${invoice.zohoInvoiceId}`,
      module: 'post_dispatch_detail',
      userId: session.userId || session.id,
    });

    const res = await fetch(
      `${API_BASE_URL}/books/v3/invoices/${invoice.zohoInvoiceId}?organization_id=${orgId}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Zoho API returned status ${res.status}`);
    }

    const data = await res.json();
    const zohoDetail = data.invoice;
    if (!zohoDetail) throw new Error('Invalid response structure from Zoho Books');

    const newZohoStatus = String(zohoDetail.status || '').toLowerCase();
    const oldZohoStatus = invoice.zohoStatus.toLowerCase();
    const isVoid = newZohoStatus === 'void';
    const wasVoid = invoice.erpSubStatus === 'Void' || oldZohoStatus === 'void';

    let newErpStatus = invoice.erpStatus;
    let newErpSubStatus = invoice.erpSubStatus;
    let newTimerStoppedAt = invoice.timerStoppedAt;

    if (isVoid && !wasVoid) {
      newErpStatus = 'Archived';
      newErpSubStatus = 'Void';
      newTimerStoppedAt = new Date();
    } else if (!isVoid && wasVoid) {
      newErpStatus = 'Active';
      newErpSubStatus = null;
      newTimerStoppedAt = null;
    }

    // Check E-Invoice info in full detail
    const einvoiceObj = zohoDetail.e_invoice_details || zohoDetail.einvoice_details || null;
    const statusLower = (einvoiceObj?.status || '').toLowerCase();
    const eInvoiceIrn = zohoDetail.irn || einvoiceObj?.irn || einvoiceObj?.inv_ref_num || invoice.eInvoiceIrn;
    const eInvoiceAckNo = zohoDetail.ack_no || einvoiceObj?.ack_no || einvoiceObj?.ack_number || invoice.eInvoiceAckNo;
    const eInvoiceAckDate = zohoDetail.ack_date || einvoiceObj?.ack_date || invoice.eInvoiceAckDate;
    const eInvoiceGenerated = Boolean(
      eInvoiceIrn || statusLower === 'pushed' || statusLower === 'generated' || invoice.eInvoiceGenerated
    );
    const eInvoiceStatus = einvoiceObj?.formatted_status || einvoiceObj?.status || (eInvoiceGenerated ? 'Pushed' : invoice.eInvoiceStatus);

    const rawLines = (zohoDetail.line_items || []) as ZohoLineItem[];

    // Atomic update
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update lines if present
      if (rawLines.length > 0) {
        await tx.postDispatchInvoiceLine.deleteMany({
          where: { invoiceId: invoice.id },
        });

        await tx.postDispatchInvoiceLine.createMany({
          data: rawLines.map((li) => ({
            invoiceId: invoice.id,
            zohoLineItemId: li.line_item_id ? String(li.line_item_id) : null,
            itemId: li.item_id ? String(li.item_id) : null,
            itemName: li.name || li.item_name || 'Item',
            description: li.description || null,
            quantity: Number(li.quantity || 0),
            rate: Number(li.rate || 0),
            amount: Number(li.item_total || li.amount || 0),
            hsnCode: li.hsn_or_sac ? String(li.hsn_or_sac) : null,
            taxPercent: Number(li.tax_percentage || 0),
          })),
        });
      }

      // 2. Update postDispatchInvoice
      const inv = await tx.postDispatchInvoice.update({
        where: { id: invoice.id },
        data: {
          zohoStatus: zohoDetail.status || invoice.zohoStatus,
          total: Number(zohoDetail.total || invoice.total),
          erpStatus: newErpStatus,
          erpSubStatus: newErpSubStatus,
          timerStoppedAt: newTimerStoppedAt,
          lastZohoSync: new Date(),
          zohoDetailsJson: zohoDetail as unknown as Prisma.InputJsonObject,
          eInvoiceGenerated,
          eInvoiceIrn,
          eInvoiceAckNo,
          eInvoiceAckDate,
          eInvoiceStatus,
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

      // 3. Record history if status changed
      if (oldZohoStatus !== newZohoStatus) {
        await recordPostDispatchHistory(tx, {
          invoiceId: invoice.id,
          eventType: 'INVOICE_STATUS_UPDATED',
          userId: session.userId || session.id,
          userName: session.name || 'Staff User',
          metadata: {
            from: invoice.zohoStatus,
            to: zohoDetail.status,
            trigger: 'MANUAL_DRAFT_REFRESH',
          },
        });
      }

      if (isVoid && !wasVoid) {
        await recordPostDispatchHistory(tx, {
          invoiceId: invoice.id,
          eventType: 'INVOICE_VOID',
          userId: session.userId || session.id,
          userName: session.name || 'Staff User',
          metadata: { reason: 'Zoho status updated to Void' },
        });
      }

      return inv;
    });

    const now = new Date();
    const startTime = new Date(updated.zohoCreatedTime).getTime();
    const endTime = updated.timerStoppedAt ? new Date(updated.timerStoppedAt).getTime() : now.getTime();
    const elapsedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

    const isActionable = updated.zohoStatus.toLowerCase() === 'sent' && updated.erpStatus === 'Active';
    const isConsumer = zohoDetail.gst_treatment
      ? isConsumerCustomer({ gstTreatment: zohoDetail.gst_treatment })
      : false;
    const warehouseName = (zohoDetail.location_name as string) || null;

    let gstin: string | null = null;
    if (zohoDetail.gst_no && String(zohoDetail.gst_no).trim()) {
      gstin = String(zohoDetail.gst_no).trim();
    } else if (zohoDetail.shipping_gst_no && String(zohoDetail.shipping_gst_no).trim()) {
      gstin = String(zohoDetail.shipping_gst_no).trim();
    }

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
      isActionable,
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
        isStopped: Boolean(updated.timerStoppedAt),
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
      message: `Status updated to ${updated.zohoStatus}`,
      invoice: formattedInvoice,
    });
  } catch (error: any) {
    console.error('[Individual Invoice Status Refresh API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh invoice status' },
      { status: 500 }
    );
  }
}

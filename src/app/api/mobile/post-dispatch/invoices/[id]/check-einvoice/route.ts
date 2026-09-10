import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';
import {
  logZohoApiCall,
  isConsumerCustomer,
} from '@/lib/post-dispatch-sync';

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
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Consumer eligibility check
    const detailsJson = invoice.zohoDetailsJson as any;
    if (detailsJson?.gst_treatment && isConsumerCustomer({ gstTreatment: detailsJson.gst_treatment })) {
      return NextResponse.json(
        { error: 'Consumer customer invoices are not eligible for E-Invoicing.' },
        { status: 400 }
      );
    }

    // Don't check void or draft
    if (invoice.zohoStatus.toLowerCase() === 'void' || invoice.erpStatus === 'Archived') {
      return NextResponse.json(
        { error: 'Void or archived invoices cannot be checked for E-Invoice.' },
        { status: 400 }
      );
    }

    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing Zoho organization ID');

    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Missing Zoho access token');

    // Exactly 1 E-Invoice Zoho API Call
    await logZohoApiCall({
      endpoint: `/books/v3/invoices/${invoice.zohoInvoiceId}`,
      module: 'post_dispatch_einvoice',
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
    const zohoInv = data.invoice;
    if (!zohoInv) throw new Error('Invalid response structure from Zoho Books');

    const einvoiceObj = zohoInv.e_invoice_details || zohoInv.einvoice_details || null;
    const statusLower = (einvoiceObj?.status || '').toLowerCase();
    const eInvoiceIrn = zohoInv.irn || einvoiceObj?.irn || einvoiceObj?.inv_ref_num || null;
    const eInvoiceAckNo = zohoInv.ack_no || einvoiceObj?.ack_no || einvoiceObj?.ack_number || null;
    const eInvoiceAckDate = zohoInv.ack_date || einvoiceObj?.ack_date || null;
    const eInvoiceGenerated = Boolean(
      eInvoiceIrn || statusLower === 'pushed' || statusLower === 'generated'
    );
    const eInvoiceStatus = einvoiceObj?.formatted_status || einvoiceObj?.status || (eInvoiceGenerated ? 'Pushed' : null);

    const updated = await prisma.postDispatchInvoice.update({
      where: { id: invoice.id },
      data: {
        eInvoiceGenerated,
        eInvoiceIrn,
        eInvoiceAckNo,
        eInvoiceAckDate,
        eInvoiceStatus,
        lastZohoSync: new Date(),
      },
    });

    if (eInvoiceGenerated && !invoice.eInvoiceGenerated) {
      await recordPostDispatchHistory(prisma, {
        invoiceId: invoice.id,
        eventType: 'EINVOICE_STATUS_UPDATED',
        userId: session.userId || session.id,
        userName: session.name || 'Staff User',
        metadata: {
          irn: eInvoiceIrn,
          ackNo: eInvoiceAckNo,
          ackDate: eInvoiceAckDate,
          singleCheck: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      eInvoice: {
        generated: updated.eInvoiceGenerated,
        irn: updated.eInvoiceIrn,
        ackNo: updated.eInvoiceAckNo,
        ackDate: updated.eInvoiceAckDate,
        status: updated.eInvoiceStatus,
      },
      message: eInvoiceGenerated
        ? 'E-Invoice confirmed generated.'
        : 'E-Invoice is not yet generated in Zoho Books.',
    });
  } catch (error: any) {
    console.error('[Individual E-Invoice Check API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check E-Invoice status' },
      { status: 500 }
    );
  }
}

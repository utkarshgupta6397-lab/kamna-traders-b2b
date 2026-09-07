import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { fetchInvoicesByCustomerId, searchInvoiceByNumber, fetchInvoiceById } from '@/lib/zoho/invoices';
import { canCompleteDispatchStep, dispatchForbiddenResponse } from '@/lib/dispatch-auth';

export const dynamic = 'force-dynamic';

interface ZohoInvoiceItem {
  invoice_id?: string;
  invoiceId?: string;
  invoice_number?: string;
  invoiceNumber?: string;
  date?: string;
  invoiceDate?: string;
  total?: number | string;
  balance?: number | string;
  status?: string;
  customer_name?: string;
  customerName?: string;
  customer_id?: string;
  customerId?: string;
  salesorder_id?: string;
  salesorder_number?: string;
  reference_number?: string | null;
  referenceNumber?: string | null;
  salesorders?: Array<{
    salesorder_id?: string;
    salesorder_number?: string;
  }>;
}

interface ZohoDetailsJson {
  customer_id?: string;
  customer_name?: string;
  invoices?: ZohoInvoiceItem[];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('search')?.trim();

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const details = (order.zohoDetailsJson || {}) as ZohoDetailsJson;
    const customerId = order.customerId || details.customer_id;
    const customerName = order.customerName || details.customer_name || 'Customer';
    const soInvoices: ZohoInvoiceItem[] = Array.isArray(details.invoices) ? details.invoices : [];

    // Query all existing mapped invoices across other workflows
    const allMappedWorkflows = await prisma.preDispatchWorkflow.findMany({
      where: {
        dispatchOrderId: { not: order.id },
        OR: [
          { mappedInvoiceId: { not: null } },
          { mappedInvoiceNumber: { not: null } }
        ]
      },
      select: { mappedInvoiceId: true, mappedInvoiceNumber: true }
    });

    const mappedIds = new Set(allMappedWorkflows.map(w => w.mappedInvoiceId).filter(Boolean));
    const mappedNumbers = new Set(
      allMappedWorkflows.map(w => w.mappedInvoiceNumber?.trim().toLowerCase()).filter(Boolean)
    );

    const checkIsAttached = (inv: ZohoInvoiceItem): boolean => {
      const invId = inv.invoice_id || inv.invoiceId;
      const invNum = (inv.invoice_number || inv.invoiceNumber || '').trim().toLowerCase();
      const soNum = (order.salesorderNumber || '').trim().toLowerCase();
      const zohoSoId = order.zohoSalesorderId;

      if (invId && soInvoices.some((i) => i.invoice_id === invId)) return true;
      if (invNum && soInvoices.some((i) => (i.invoice_number || '').trim().toLowerCase() === invNum)) return true;
      if (inv.salesorder_id && inv.salesorder_id === zohoSoId) return true;
      if (inv.salesorder_number && inv.salesorder_number.toLowerCase() === soNum) return true;
      if (inv.reference_number && (inv.reference_number.toLowerCase() === soNum || inv.reference_number === zohoSoId)) return true;
      if (Array.isArray(inv.salesorders) && inv.salesorders.some((s) => s.salesorder_id === zohoSoId || (s.salesorder_number && s.salesorder_number.toLowerCase() === soNum))) return true;
      if (order.preDispatchWorkflow?.mappedInvoiceNumber && order.preDispatchWorkflow.mappedInvoiceNumber.trim().toLowerCase() === invNum) return true;
      if (order.preDispatchWorkflow?.mappedInvoiceId && order.preDispatchWorkflow.mappedInvoiceId === invId) return true;

      return false;
    };

    // If a search query is provided, execute broad search across Zoho Books
    if (searchQuery) {
      const searchRes = await searchInvoiceByNumber(searchQuery);
      const rawMatches: ZohoInvoiceItem[] = searchRes.invoices || [];

      const formattedResults = rawMatches.map((inv) => {
        const isAttached = checkIsAttached(inv);
        const isMappedToOtherOrder =
          (inv.invoice_id && mappedIds.has(inv.invoice_id)) ||
          (inv.invoice_number && mappedNumbers.has(inv.invoice_number.trim().toLowerCase()));

        return {
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.date,
          total: Number(inv.total) || 0,
          balance: Number(inv.balance) || 0,
          status: inv.status,
          customerName: inv.customer_name || 'Unknown',
          customerId: inv.customer_id || null,
          referenceNumber: inv.reference_number || null,
          isAttached,
          isAlreadyMappedToAnotherOrder: Boolean(isMappedToOtherOrder),
        };
      });

      return NextResponse.json({
        success: true,
        searchResults: formattedResults,
      });
    }

    // Default primary flow: 7-day recent unmapped invoices for SAME customer
    if (!customerId) {
      return NextResponse.json({
        success: true,
        customerId: null,
        customerName,
        startDate: null,
        endDate: null,
        invoices: []
      });
    }

    const now = new Date();
    const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDate = formatDateStr(past7Days);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const endDate = formatDateStr(tomorrow);

    const zohoRes = await fetchInvoicesByCustomerId(customerId, startDate, endDate);
    const rawInvoices: ZohoInvoiceItem[] = [...(zohoRes.invoices || [])];

    // Ensure any invoices attached to this Sales Order are included even if older than 7 days
    if (Array.isArray(soInvoices) && soInvoices.length > 0) {
      for (const att of soInvoices) {
        const alreadyInList = rawInvoices.some(
          i => (att.invoice_id && i.invoice_id === att.invoice_id) ||
               (att.invoice_number && i.invoice_number === att.invoice_number)
        );
        if (!alreadyInList && att.invoice_id) {
          try {
            const detail = await fetchInvoiceById(att.invoice_id);
            if (detail.invoice) rawInvoices.push(detail.invoice);
          } catch {
            rawInvoices.push({
              invoice_id: att.invoice_id,
              invoice_number: att.invoice_number,
              date: att.date || formatDateStr(now),
              total: att.total,
              balance: att.balance,
              status: att.status || 'sent',
              customer_id: customerId,
              customer_name: customerName,
              reference_number: att.reference_number || order.salesorderNumber,
            });
          }
        }
      }
    }

    const eligibleInvoices: Array<{
      invoiceId?: string;
      invoiceNumber?: string;
      invoiceDate?: string;
      total: number;
      balance: number;
      status?: string;
      customerName: string;
      customerId: string;
      referenceNumber: string | null;
      isAttached: boolean;
    }> = [];

    for (const inv of rawInvoices) {
      // Exclude void invoices
      if (inv.status === 'void') continue;

      // Ensure invoices belong to the SAME customer
      if (inv.customer_id && String(inv.customer_id) !== String(customerId)) continue;

      const isAttachedToThisSo = checkIsAttached(inv);

      // Exclude invoices mapped to another order in our database
      const isMappedToOtherOrderInDb =
        (inv.invoice_id && mappedIds.has(inv.invoice_id)) ||
        (inv.invoice_number && mappedNumbers.has(inv.invoice_number.trim().toLowerCase()));

      if (isMappedToOtherOrderInDb) continue;

      // If attached to a different sales order in Zoho Books, exclude from primary list
      if (!isAttachedToThisSo) {
        if (inv.salesorder_id && inv.salesorder_id !== order.zohoSalesorderId) {
          continue;
        }
        if (Array.isArray(inv.salesorders) && inv.salesorders.length > 0) {
          const matchesThisSo = inv.salesorders.some(
            (s) => s.salesorder_id === order.zohoSalesorderId || (s.salesorder_number && s.salesorder_number === order.salesorderNumber)
          );
          if (!matchesThisSo) continue;
        }
        if (inv.reference_number && typeof inv.reference_number === 'string') {
          const ref = inv.reference_number.trim();
          if (ref.startsWith('SO-') && ref !== order.salesorderNumber && ref !== order.zohoSalesorderId) {
            continue;
          }
        }
      }

      // Enforce 7-day window for non-attached invoices
      if (!isAttachedToThisSo && inv.date) {
        if (inv.date < startDate) {
          continue;
        }
      }

      eligibleInvoices.push({
        invoiceId: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.date,
        total: Number(inv.total) || 0,
        balance: Number(inv.balance) || 0,
        status: inv.status,
        customerName: inv.customer_name || customerName,
        customerId: inv.customer_id || customerId,
        referenceNumber: inv.reference_number || null,
        isAttached: isAttachedToThisSo,
      });
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduplicated = eligibleInvoices.filter(inv => {
      const key = inv.invoiceId || inv.invoiceNumber || '';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort descending by invoice date, newest first
    deduplicated.sort((a, b) => {
      const dateCompare = (b.invoiceDate || '').localeCompare(a.invoiceDate || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
    });

    return NextResponse.json({
      success: true,
      customerId,
      customerName,
      startDate,
      endDate: formatDateStr(now),
      invoices: deduplicated,
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Invoice Confirmation GET Error]', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canCompleteDispatchStep(session, 'invoice-confirmation')) {
    return NextResponse.json(dispatchForbiddenResponse('Invoice Confirmation'), { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { invoiceNumber, invoiceId, mappingMethod } = body;

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 });
    }

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order || !order.preDispatchWorkflow) {
      return NextResponse.json({ error: 'Order/Workflow not found' }, { status: 404 });
    }

    const wf = order.preDispatchWorkflow;

    if (wf.readyForInvoiceStatus !== 'COMPLETED') {
      return NextResponse.json({ error: 'Ready For Invoice must be completed first' }, { status: 400 });
    }

    const confirmedAt = new Date();

    const [updatedWf, updatedOrder] = await prisma.$transaction([
      prisma.preDispatchWorkflow.update({
        where: { id: wf.id },
        data: {
          invoiceConfirmStatus: 'COMPLETED',
          mappedInvoiceNumber: invoiceNumber,
          mappedInvoiceId: invoiceId || null,
          mappingMethod: mappingMethod || 'MANUAL',
          invoiceConfirmBy: session.userId,
          invoiceConfirmAt: confirmedAt,
          currentStep: 5,
          overallStatus: 'PRE_DISPATCH_COMPLETED'
        }
      }),
      prisma.dispatchIncomingOrder.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          updatedAt: confirmedAt
        }
      })
    ]);

    // Broadcast update so all active dispatch queue tables reflect archived status and stop timers
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, {
      ...updatedOrder,
      preDispatchWorkflow: updatedWf
    });

    return NextResponse.json({ success: true, data: updatedWf, order: updatedOrder });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Invoice Confirmation Error]', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}


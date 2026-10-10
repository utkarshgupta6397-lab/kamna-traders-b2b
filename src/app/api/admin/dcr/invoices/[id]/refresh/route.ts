import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchInvoiceById } from '@/lib/zoho/invoices';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await prisma.dcrInvoice.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Force live fetch from Zoho Books
    console.log(`[DCR Refresh] Fetching Zoho Invoice ID: ${invoice.zohoInvoiceId}`);
    const { invoice: zohoInvoice, apiCallsUsed } = await fetchInvoiceById(invoice.zohoInvoiceId);

    if (apiCallsUsed > 0) {
      await prisma.zohoApiLog.create({
        data: {
          endpoint: 'FETCH_INVOICE_DETAILS',
          module: 'DCR',
          userId: session.userId || 'SYSTEM_REVIEW',
        },
      });
    }

    if (!zohoInvoice) {
      return NextResponse.json({ error: 'Failed to fetch invoice from Zoho Books' }, { status: 500 });
    }

    console.log(`[DCR Refresh] Zoho Books API Raw Line Items:`, JSON.stringify(zohoInvoice.line_items, null, 2));

    let updatedCount = 0;
    if (zohoInvoice.line_items) {
      const ops: any[] = [];
      for (const zItem of zohoInvoice.line_items) {
        const matchingDbItem = invoice.items.find(
          item => item.itemId === zItem.item_id && item.source === 'ZOHO'
        );

        let rate = zItem.rate ?? zItem.bcy_rate ?? null;
        const amount = zItem.item_total ?? (rate ? rate * zItem.quantity : 0);
        if (rate === null || rate === 0) {
          rate = (amount && zItem.quantity) ? amount / zItem.quantity : 0;
        }
        const description = zItem.description ?? zItem.item_description ?? zItem.sales_description ?? null;

        if (matchingDbItem) {
          console.log(`[DCR Refresh] Matching item: ${matchingDbItem.itemName} (${matchingDbItem.id}). Rate: ${rate}, Amount: ${amount}`);
          updatedCount++;
          ops.push(
            prisma.dcrInvoiceItem.update({
              where: { id: matchingDbItem.id },
              data: {
                rate,
                amount,
                description,
                quantity: zItem.quantity,
                itemName: zItem.name,
              },
            })
          );
        } else {
          console.log(`[DCR Refresh] Creating new DB item for Zoho item_id: ${zItem.item_id}`);
          updatedCount++;
          ops.push(
            prisma.dcrInvoiceItem.create({
              data: {
                dcrInvoiceId: invoice.id,
                itemId: zItem.item_id,
                itemName: zItem.name,
                sku: zItem.sku || null,
                quantity: zItem.quantity,
                rate: rate ?? 0,
                amount,
                description,
                source: 'ZOHO',
              },
            })
          );
        }
      }

      // Update header details
      const updateHeader: any = {};
      if (zohoInvoice.location_id && !invoice.locationId) {
        updateHeader.locationId = zohoInvoice.location_id;
      }
      if ((zohoInvoice.location_name || zohoInvoice.branch_name) && !invoice.locationName) {
        updateHeader.locationName = zohoInvoice.location_name || zohoInvoice.branch_name;
      }
      if (typeof zohoInvoice.balance === 'number' && invoice.outstandingAmount !== zohoInvoice.balance) {
        updateHeader.outstandingAmount = zohoInvoice.balance;
        updateHeader.outstandingUpdatedAt = new Date();
      }
      if (Object.keys(updateHeader).length > 0) {
        ops.push(
          prisma.dcrInvoice.update({
            where: { id: invoice.id },
            data: updateHeader,
          })
        );
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }
    }

    // Fetch the updated invoice from DB
    const updatedInvoice = await prisma.dcrInvoice.findUnique({
      where: { id },
      include: {
        items: true,
        serialAllocations: true,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount,
      invoice: updatedInvoice,
    });
  } catch (error: any) {
    console.error('[DCR Invoice Refresh POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh invoice' }, { status: 500 });
  }
}

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
    const { invoice: zohoInvoice } = await fetchInvoiceById(invoice.zohoInvoiceId);

    if (!zohoInvoice) {
      return NextResponse.json({ error: 'Failed to fetch invoice from Zoho Books' }, { status: 500 });
    }

    console.log(`[DCR Refresh] Zoho Books API Raw Line Items:`, JSON.stringify(zohoInvoice.line_items, null, 2));

    let updatedCount = 0;
    if (zohoInvoice.line_items) {
      await prisma.$transaction(
        zohoInvoice.line_items.map((zItem: any) => {
          const matchingDbItem = invoice.items.find(
            item => item.itemId === zItem.item_id && item.source === 'ZOHO'
          );

          if (matchingDbItem) {
            const rate = zItem.rate ?? zItem.bcy_rate ?? 0;
            const amount = zItem.item_total ?? (rate * zItem.quantity);
            const description = zItem.description ?? zItem.item_description ?? zItem.sales_description ?? null;

            console.log(`[DCR Refresh] Matching item: ${matchingDbItem.itemName} (${matchingDbItem.id}). Rate: ${rate}, Amount: ${amount}`);
            updatedCount++;

            return prisma.dcrInvoiceItem.update({
              where: { id: matchingDbItem.id },
              data: {
                rate,
                amount,
                description,
                quantity: zItem.quantity,
                itemName: zItem.name,
              },
            });
          } else {
            console.log(`[DCR Refresh] No matching DB item found for Zoho item_id: ${zItem.item_id}`);
          }
          return null;
        }).filter(Boolean) as any
      );
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

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
        serialAllocations: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Dynamic enrichment check: if Zoho items are missing price/value, fetch live details and update local database
    const needsEnrichment = invoice.items.some(item => item.source === 'ZOHO' && (item.rate === null || item.amount === null));
    if (needsEnrichment) {
      try {
        const { fetchInvoiceById } = await import('@/lib/zoho/invoices');
        const { invoice: zohoInvoice } = await fetchInvoiceById(invoice.zohoInvoiceId);
        if (zohoInvoice && zohoInvoice.line_items) {
          await prisma.$transaction(
            zohoInvoice.line_items.map((zItem: any) => {
              const matchingDbItem = invoice.items.find(item => item.itemId === zItem.item_id && item.source === 'ZOHO');
              if (matchingDbItem) {
                let rate = zItem.rate ?? zItem.bcy_rate ?? null;
                const amount = zItem.item_total ?? (rate ? rate * zItem.quantity : 0);
                if (rate === null || rate === 0) {
                  rate = (amount && zItem.quantity) ? amount / zItem.quantity : 0;
                }
                const description = zItem.description ?? zItem.item_description ?? zItem.sales_description ?? null;
                return prisma.dcrInvoiceItem.update({
                  where: { id: matchingDbItem.id },
                  data: {
                    rate,
                    amount,
                    description,
                  },
                });
              }
              return null;
            }).filter(Boolean) as any
          );

          // Reload from DB
          const enrichedInvoice = await prisma.dcrInvoice.findUnique({
            where: { id },
            include: {
              items: true,
              serialAllocations: true,
            },
          });
          return NextResponse.json({ invoice: enrichedInvoice });
        }
      } catch (err) {
        console.error('[GET Invoice Details] Failed to enrich items from Zoho:', err);
      }
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('[DCR Invoice Details GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice details' }, { status: 500 });
  }
}

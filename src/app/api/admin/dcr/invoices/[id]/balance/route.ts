import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { fetchInvoiceById } from '@/lib/zoho/invoices';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let invoice;
    if (id.startsWith('cm')) {
      invoice = await prisma.dcrInvoice.findUnique({
        where: { id },
        select: { zohoInvoiceId: true }
      });
    } else {
      invoice = await prisma.dcrInvoice.findUnique({
        where: { zohoInvoiceId: id },
        select: { zohoInvoiceId: true }
      });
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const { invoice: zohoInvoice, error } = await fetchInvoiceById(invoice.zohoInvoiceId);

    if (error || !zohoInvoice) {
      return NextResponse.json({ error: 'Failed to fetch invoice from Zoho' }, { status: 502 });
    }

    const balance = Number(zohoInvoice.balance_due !== undefined ? zohoInvoice.balance_due : (zohoInvoice.balance !== undefined ? zohoInvoice.balance : (zohoInvoice.balance_amount || 0)));

    return NextResponse.json({ balance });

  } catch (error: any) {
    console.error('[DCR Invoice Balance GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice balance' }, { status: 500 });
  }
}

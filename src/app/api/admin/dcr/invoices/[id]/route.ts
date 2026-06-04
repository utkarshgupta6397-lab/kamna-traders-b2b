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
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('[DCR Invoice Details GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice details' }, { status: 500 });
  }
}

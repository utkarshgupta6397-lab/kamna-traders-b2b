import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: itemId } = await params;
    const body = await req.json();
    const { quantity } = body;

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    const item = await prisma.dcrInvoiceItem.findUnique({
      where: { id: itemId },
      include: { serialAllocations: true }
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (quantity < item.serialAllocations.length) {
      return NextResponse.json({ error: 'Cannot reduce quantity below allocated serial count' }, { status: 400 });
    }

    const updated = await prisma.dcrInvoiceItem.update({
      where: { id: itemId },
      data: { quantity }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

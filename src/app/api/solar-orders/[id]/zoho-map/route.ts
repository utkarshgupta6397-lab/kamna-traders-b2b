import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { contact_id, contact_name } = body;

    if (!contact_id || !contact_name) {
      return NextResponse.json({ error: 'Missing contact mapping data' }, { status: 400 });
    }

    const order = await prisma.solarOrder.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.zohoBooksCustomerId) {
       return NextResponse.json({ error: 'Customer is already mapped' }, { status: 400 });
    }

    const updated = await prisma.solarOrder.update({
      where: { id },
      data: {
        zohoBooksCustomerId: contact_id,
        zohoBooksCustomerName: contact_name
      }
    });

    return NextResponse.json({ success: true, order: updated });

  } catch (error) {
    console.error('[Zoho Map Customer Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { enrichSalesOrder } from '@/lib/enrich-so';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.dispatch_view)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Await params as per Next.js 15+ constraints (AGENTS.md rule)
    const { id } = await params;

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const requestId = Math.random().toString(36).substring(2, 9);
    
    // Explicitly await the enrichment in manual mode to return the result
    const updated = await enrichSalesOrder(order.zohoSalesorderId, order.id, requestId);

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('[Manual Fetch]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch details from Zoho Books' },
      { status: 500 }
    );
  }
}

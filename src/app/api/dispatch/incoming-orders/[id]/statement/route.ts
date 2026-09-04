import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerStatement } from '@/lib/zoho/customer-statement';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id }
    });

    if (!order || !order.customerId) {
      return NextResponse.json({ error: 'Order or customer ID not found' }, { status: 404 });
    }

    const minDate = '2026-03-01';
    const result = await getCustomerStatement(order.customerId.trim(), minDate);
    if (!result.success) {
      return NextResponse.json({ error: result.error, raw: result.raw }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

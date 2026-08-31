import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (session.role !== 'ADMIN' && !session.dispatch_view) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const orders = await prisma.dispatchIncomingOrder.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error: any) {
    console.error('[Incoming Queue API]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

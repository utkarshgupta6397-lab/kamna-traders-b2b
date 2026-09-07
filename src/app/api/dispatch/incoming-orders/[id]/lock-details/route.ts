import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!session.dispatch_view && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      select: {
        zohoLockStatus: true,
        zohoLockValue: true,
        zohoLockAttemptedAt: true,
        zohoLockVerifiedAt: true,
        zohoLockRequestJson: true,
        zohoLockPutResponseJson: true,
        zohoLockVerificationResponseJson: true,
        zohoLockHttpStatus: true,
        zohoLockError: true,
        salesorderNumber: true,
        zohoSalesorderId: true
      }
    });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err: any) {
    console.error('[API Lock Details Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

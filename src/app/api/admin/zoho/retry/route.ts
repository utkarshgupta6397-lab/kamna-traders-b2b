import { prisma } from '@/lib/db';
import { syncDispatchToZoho } from '@/lib/zoho-auth';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { cartId } = await request.json();
    if (!cartId) {
      return NextResponse.json({ error: 'Missing cartId' }, { status: 400 });
    }

    console.log(`[ZOHO][RETRY][${cartId}] Triggered by admin`);

    // Reset state before retry
    await prisma.cart.update({
      where: { id: cartId },
      data: {
        zohoSyncStatus: 'PENDING',
        zohoSyncStep: 'INITIATED',
        zohoSyncError: null
      }
    });

    // We don't await here to return immediately to the UI, 
    // but the syncDispatchToZoho internally handles all persistence.
    // However, for admin retry, it's often better to await to show immediate result.
    const result = await syncDispatchToZoho(cartId);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[ZohoRetry] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

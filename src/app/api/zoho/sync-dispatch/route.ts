import { prisma } from '@/lib/db';
import { syncDispatchToZoho, addZohoTrace } from '@/lib/zoho-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { cartId } = await request.json();
    console.log(`[ZOHO_DEBUG] POST request received for cartId: ${cartId}`);

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    await addZohoTrace(cartId, 'SYNC_ROUTE_STARTED');
    console.log(`[ZOHO] Background sync started for cart: ${cartId}`);
    
    // syncDispatchToZoho handles duplicate prevention internally
    const result = await syncDispatchToZoho(cartId);

    return NextResponse.json({ 
      success: result.success,
      salesorder_number: result.response?.salesorder?.salesorder_number || null 
    });

  } catch (error: any) {
    console.error('[ZOHO] Background sync route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

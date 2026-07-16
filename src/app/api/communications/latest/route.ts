import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const orderId = searchParams.get('orderId') || undefined;
    const invoiceId = searchParams.get('invoiceId') || undefined;

    if (!customerId && !orderId && !invoiceId) {
      return NextResponse.json({ success: false, error: 'Missing filter parameter' }, { status: 400 });
    }

    const message = await GatewayClient.getLatestCommunication({
      customerId,
      orderId,
      invoiceId
    });

    return NextResponse.json({
      success: true,
      message
    });
  } catch (error: any) {
    console.error('[API /communications/latest] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

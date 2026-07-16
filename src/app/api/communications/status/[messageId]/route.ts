import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function GET(request: Request, context: { params: Promise<{ messageId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = await context.params;

    if (!messageId) {
      return NextResponse.json({ success: false, error: 'Missing messageId' }, { status: 400 });
    }

    const message = await GatewayClient.getCommunicationStatus(messageId);

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message
    });
  } catch (error: any) {
    console.error('[API /communications/[messageId]] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

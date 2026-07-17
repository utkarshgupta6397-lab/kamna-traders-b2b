import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const health = await GatewayClient.health();

    await prisma.gatewayConfiguration.updateMany({
      where: { id: 'singleton' },
      data: {
        connectionStatus: health.success ? 'CONNECTED' : 'FAILED',
        lastConnectionTest: new Date()
      }
    });

    if (!health.success) {
      return NextResponse.json({ success: false, error: health.error || 'Connection failed' });
    }

    return NextResponse.json({ 
      success: true, 
      latency: health.latency,
      version: health.version,
      environment: health.environment
    });
  } catch (error: any) {
    console.error('[Gateway Test Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

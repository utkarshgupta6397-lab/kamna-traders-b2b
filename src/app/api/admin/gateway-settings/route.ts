import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await prisma.gatewayConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    return NextResponse.json({ config: config || null });
  } catch (error: any) {
    console.error('[GatewaySettings GET Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { gatewayUrl, apiToken } = body;

    if (!gatewayUrl || !apiToken) {
      return NextResponse.json({ error: 'gatewayUrl and apiToken are required' }, { status: 400 });
    }

    const config = await prisma.gatewayConfiguration.upsert({
      where: { id: 'singleton' },
      update: {
        gatewayUrl,
        apiToken,
        connectionStatus: 'NOT_TESTED',
      },
      create: {
        id: 'singleton',
        gatewayUrl,
        apiToken,
        connectionStatus: 'NOT_TESTED',
      }
    });

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('[GatewaySettings POST Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

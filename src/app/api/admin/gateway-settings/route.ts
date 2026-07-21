import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';

function maskApiKey(key: string) {
  if (!key) return '';
  if (key.length <= 13) return '*'.repeat(key.length);
  return key.substring(0, 13) + '*'.repeat(Math.max(10, key.length - 13));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await prisma.gatewayConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    if (config) {
      // Mask the API token before sending to client
      config.apiToken = maskApiKey(config.apiToken);
    }

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

    if (!gatewayUrl) {
      return NextResponse.json({ error: 'gatewayUrl is required' }, { status: 400 });
    }

    let normalizedGatewayUrl = gatewayUrl;
    try {
      const urlObj = new URL(gatewayUrl);
      if (urlObj.pathname !== '/' && urlObj.pathname !== '') {
        return NextResponse.json({ error: 'Gateway URL must be the server root (e.g., https://events.kamnatraders.com) without endpoint paths.' }, { status: 400 });
      }
      normalizedGatewayUrl = urlObj.origin;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid Gateway URL format.' }, { status: 400 });
    }

    const existingConfig = await prisma.gatewayConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    // If the provided apiToken includes '*', it's the masked version, so we keep the existing token.
    // Otherwise, we use the newly provided apiToken.
    let finalApiToken = apiToken;
    if (apiToken && apiToken.includes('*') && existingConfig) {
      finalApiToken = existingConfig.apiToken;
    } else if (!apiToken && !existingConfig) {
       return NextResponse.json({ error: 'apiToken is required' }, { status: 400 });
    }

    const config = await prisma.gatewayConfiguration.upsert({
      where: { id: 'singleton' },
      update: {
        gatewayUrl: normalizedGatewayUrl,
        ...(finalApiToken ? { apiToken: finalApiToken } : {}),
        connectionStatus: 'NOT_TESTED',
      },
      create: {
        id: 'singleton',
        gatewayUrl: normalizedGatewayUrl,
        apiToken: finalApiToken,
        connectionStatus: 'NOT_TESTED',
      }
    });
    
    GatewayClient.clearCache();

    // Mask before returning
    config.apiToken = maskApiKey(config.apiToken);

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('[GatewaySettings POST Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

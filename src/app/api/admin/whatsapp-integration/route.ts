import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { encryptString } from '@/lib/encryption';

const MASKED_TOKEN_PLACEHOLDER = '••••••••••••••••••••••••••••••••••••••••';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.whatsapp_integration) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    if (!config) {
      return NextResponse.json({ data: null });
    }

    // Never return the real token to the client
    const safeConfig = {
      ...config,
      integrationEnabled: Boolean(config.integrationEnabled),
      encryptedAccessToken: config.encryptedAccessToken ? MASKED_TOKEN_PLACEHOLDER : '',
    };

    console.log('[API GET /admin/whatsapp-integration] Database value:', config.testPhoneNumber);
    console.log('[API GET /admin/whatsapp-integration] Returning:', safeConfig.testPhoneNumber);

    return NextResponse.json({ data: safeConfig });

  } catch (error) {
    console.error('[WhatsAppIntegration API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.whatsapp_integration) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      appId, 
      encryptedAccessToken: incomingToken, 
      phoneNumberId, 
      businessAccountId, 
      apiVersion, 
      webhookVerifyToken, 
      integrationEnabled,
      testPhoneNumber
    } = body;

    if (!appId || !phoneNumberId || !businessAccountId || !apiVersion || !webhookVerifyToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let formattedApiVersion = apiVersion;
    if (formattedApiVersion && !formattedApiVersion.includes('.')) {
      formattedApiVersion = `${formattedApiVersion}.0`;
    }

    const existing = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    let finalToken = '';

    if (incomingToken && incomingToken !== MASKED_TOKEN_PLACEHOLDER) {
      // New access token provided in plain text, encrypt it
      finalToken = encryptString(incomingToken);
    } else if (existing) {
      // Retain existing encrypted token
      finalToken = existing.encryptedAccessToken;
    } else {
      return NextResponse.json({ error: 'Access token is required for initial setup' }, { status: 400 });
    }

    const upsertData = {
      appId,
      encryptedAccessToken: finalToken,
      phoneNumberId,
      businessAccountId,
      apiVersion: formattedApiVersion,
      webhookVerifyToken,
      integrationEnabled: integrationEnabled === true,
      testPhoneNumber: testPhoneNumber || null,
    };

    const updated = await prisma.whatsAppConfiguration.upsert({
      where: { id: 'singleton' },
      update: upsertData,
      create: {
        id: 'singleton',
        ...upsertData,
      }
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error) {
    console.error('[WhatsAppIntegration API] POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

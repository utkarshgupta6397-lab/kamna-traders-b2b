import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.communications_templates) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { variables, mediaBase64 } = await request.json();

    // 1. Fetch template from local DB
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    // 2. Fetch test recipient number (using singleton config)
    const config = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' }
    });
    
    // Fallback to the hardcoded test recipient if config is missing
    const testRecipient = config?.testPhoneNumber || '+918744832318';

    // 3. Delegate to Kamna Event Gateway
    const response = await GatewayClient.sendCommunication({
      channel: 'whatsapp',
      recipient: testRecipient,
      template: template.name,
      variables: variables || {},
      metadata: {
        templateId: template.id,
        // Include mediaBase64 in metadata if needed, though Gateway might not support direct base64 media yet.
        // We'll pass it for forwards compatibility.
        mediaBase64: mediaBase64
      },
      requestedBy: session.userId,
      source: 'kamna-erp-template-test'
    });

    if (!response.success) {
      return NextResponse.json({ success: false, error: response.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      messageId: response.messageId,
      eventId: response.eventId 
    });

  } catch (error: any) {
    console.error('[Template Test API Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

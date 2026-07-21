import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';
import { CommunicationService } from '@/lib/services/CommunicationService';

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
    // Clean recipient string (digits only)
    const normalizedRecipient = testRecipient.replace(/\D/g, '');
    
    // Convert numeric dictionary to positional array for Gateway
    const variablesArray = variables ? Object.values(variables) : [];

    const response = await GatewayClient.sendCommunication({
      channel: 'whatsapp',
      recipient: normalizedRecipient,
      template: template.name,
      language: template.language || 'en',
      variables: variablesArray,
      metadata: {
        templateId: template.id,
        mediaBase64: mediaBase64
      },
      requestedBy: session.userId,
      source: 'kamna-erp-template-test'
    });

    // Ensure we create an ERP communication log regardless of success/failure
    try {
      await CommunicationService.createCommunication({
        customerId: 'SYSTEM_TEST',
        customerName: 'System Tester',
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        type: 'SYSTEM_ALERT',
        body: `Template Test: ${template.name}`,
        toAddress: normalizedRecipient,
        templateId: template.id,
        templateName: template.name,
        templateLanguage: template.language || 'en',
        variablesJson: variablesArray,
        providerName: 'KamnaGateway',
        providerMessageId: response.messageId || response.eventId,
        providerResponse: response,
        createdById: session.userId,
      }, response.success ? 'API_ACCEPTED' : 'FAILED');
    } catch (logErr) {
      console.error('[Template Test Route] Failed to create communication log:', logErr);
    }

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

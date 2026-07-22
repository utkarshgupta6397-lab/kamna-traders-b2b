import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';
import { CommunicationService } from '@/lib/services/CommunicationService';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipient, template, language, variables } = body;

    if (!recipient || !template) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const payload = {
      channel: 'whatsapp' as const,
      recipient,
      template,
      language: language || 'en',
      variables: variables || [],
      source: 'erp',
      requestedBy: session.name || session.userId || 'Unknown',
      metadata: {}
    };

    const response = await GatewayClient.sendCommunication(payload);

    // Ensure we create an ERP communication log regardless of success/failure
    try {
      await CommunicationService.createCommunication({
        customerId: 'SYSTEM_TEST',
        customerName: 'System Tester',
        channel: 'WHATSAPP',
        direction: 'OUTGOING',
        type: 'GENERAL',
        body: `Test Template: ${template}`,
        toAddress: recipient,
        templateName: template,
        variablesJson: variables,
        providerName: 'KamnaGateway',
        providerMessageId: response.messageId || response.eventId,
        providerResponse: response,
        createdById: session.userId,
      }, response.success ? 'API_ACCEPTED' : 'FAILED');
    } catch (logErr) {
      console.error('[Gateway Test Route] Failed to create communication log:', logErr);
    }

    if (response.success && response.messageId) {
      // Store in DB as requested in Phase 26A: gatewayMessageId, providerMessageId, providerStatus, createdAt
      await prisma.gatewayMessageLog.create({
        data: {
          gatewayMessageId: response.messageId, // Our messageId acts as gatewayMessageId
          providerMessageId: response.eventId || null,
          providerStatus: 'PENDING',
        }
      });
      return NextResponse.json({ success: true, messageId: response.messageId });
    } else {
      // Map error to friendly message
      let friendlyError = 'Failed to send message via Gateway';
      if (response.error?.includes('Unauthorized')) friendlyError = 'Gateway Unauthorized. Check API Token.';
      else if (response.error?.includes('Validation error')) friendlyError = `Invalid variables or payload: ${response.error}`;
      else if (response.error?.includes('timed out')) friendlyError = 'Gateway timeout';
      else if (response.error) friendlyError = `Gateway Error: ${response.error}`;

      return NextResponse.json({ success: false, error: friendlyError }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Gateway Test Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

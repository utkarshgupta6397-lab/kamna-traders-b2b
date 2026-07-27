import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { DcrCertificateGenerator } from '@/lib/services/DcrCertificateGenerator';
import { GatewayClient } from '@/lib/services/GatewayClient';
import { CommunicationService } from '@/lib/services/CommunicationService';
import { CommunicationChannel, CommunicationDirection, CommunicationType, CommunicationStatus } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId, serialNumbers, notifyUser } = await req.json();

    if (!invoiceId || !serialNumbers || !Array.isArray(serialNumbers)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 1. Fetch Invoice & Customer
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const customer = invoice.customer;
    
    // Check if user skipped
    if (!notifyUser) {
      await CommunicationService.createCommunication({
        customerId: customer.id,
        customerName: customer.name,
        invoiceId: invoice.id,
        channel: CommunicationChannel.WHATSAPP,
        direction: CommunicationDirection.OUTGOING,
        type: CommunicationType.DCR,
        body: 'DCR Issued WhatsApp Notification skipped by user.',
        templateName: 'dcr_issued_v2',
        providerName: 'KamnaGateway',
        createdById: session.userId,
      }, CommunicationStatus.FAILED).then(c => 
        CommunicationService.updateStatus(c.id, CommunicationStatus.FAILED, 'Skipped by user')
      );
      
      return NextResponse.json({ success: true, skipped: true, reason: 'User skipped notification' });
    }

    // 2. Phone Number Validation
    let phone = customer.phone?.replace(/[^0-9]/g, '') || '';
    
    // If it's a 10 digit number, prepend 91. If it's 12 digits starting with 91, it's fine.
    if (phone.length === 10) {
      phone = `91${phone}`;
    } else if (phone.length !== 12 || !phone.startsWith('91')) {
      // Invalid phone
      await CommunicationService.createCommunication({
        customerId: customer.id,
        customerName: customer.name,
        invoiceId: invoice.id,
        channel: CommunicationChannel.WHATSAPP,
        direction: CommunicationDirection.OUTGOING,
        type: CommunicationType.DCR,
        body: 'Failed to send DCR WhatsApp Notification. Invalid or missing customer phone.',
        templateName: 'dcr_issued_v2',
        providerName: 'KamnaGateway',
        createdById: session.userId,
      }, CommunicationStatus.FAILED).then(c => 
        CommunicationService.updateStatus(c.id, CommunicationStatus.FAILED, 'Invalid or missing customer phone')
      );

      return NextResponse.json({ success: true, skipped: true, reason: 'Invalid phone number' });
    }

    // 3. Generate Image
    let base64Image = '';
    try {
      const imageResponse = DcrCertificateGenerator.generate({
        invoiceNumber: invoice.invoiceNumber,
        customerName: customer.name,
        issueDate: new Date(),
        serials: serialNumbers
      });

      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Image = buffer.toString('base64');
    } catch (err) {
      console.error('[DCR Notify] Image generation failed:', err);
      // We will continue without image if it fails, or maybe fail the request?
      // Requirement: "Image generation failure -> Do not rollback DCR."
    }

    // 4. Send via Gateway
    const formattedPhone = `+${phone}`;
    const payload = {
      channel: 'whatsapp' as const,
      recipient: formattedPhone,
      template: 'dcr_issued_v2',
      language: 'en_US',
      variables: [
        invoice.invoiceNumber,
        serialNumbers.join(', '), // Comma separated issued serial numbers
        serialNumbers.length.toString() // Total issued serial count
      ],
      metadata: {
        source: 'ERP DCR Issue',
        invoiceNumber: invoice.invoiceNumber,
        customerId: customer.id,
        mediaBase64: base64Image || undefined
      },
      requestedBy: session.userId,
      source: 'erp-dcr-issue'
    };

    const response = await GatewayClient.sendCommunication(payload);

    // 5. Log in Communication table
    try {
      await CommunicationService.createCommunication({
        customerId: customer.id,
        customerName: customer.name,
        invoiceId: invoice.id,
        channel: CommunicationChannel.WHATSAPP,
        direction: CommunicationDirection.OUTGOING,
        type: CommunicationType.DCR,
        body: `DCR Issued. Invoice: ${invoice.invoiceNumber}, Serials: ${serialNumbers.join(', ')}`,
        toAddress: formattedPhone,
        templateName: 'dcr_issued_v2',
        variablesJson: payload.variables,
        providerName: 'KamnaGateway',
        providerMessageId: response.messageId || response.eventId,
        providerResponse: response,
        createdById: session.userId,
        metadata: {
          imageGenerated: !!base64Image,
          gatewayRequestId: response.eventId
        }
      }, response.success ? CommunicationStatus.API_ACCEPTED : CommunicationStatus.FAILED);
    } catch (logErr) {
      console.error('[DCR Notify] Failed to create communication log:', logErr);
    }

    if (!response.success) {
      return NextResponse.json({ success: false, error: response.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: response.messageId });
  } catch (error: any) {
    console.error('[DCR Notify] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

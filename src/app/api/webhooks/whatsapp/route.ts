import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const config = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    const expectedToken = config?.webhookVerifyToken || 'NOT_SET';
    
    console.log('\n====================================');
    console.log('VERIFY REQUEST RECEIVED');
    console.log('====================================');
    console.log(`Challenge             : ${challenge}`);
    console.log(`Verify Token Received : ${token}`);
    console.log(`Verify Token Expected : ${expectedToken}`);

    if (mode === 'subscribe' && token) {
      if (config && token === config.webhookVerifyToken) {
        console.log(`Verification Status   : SUCCESS`);
        console.log('====================================\n');
        return new NextResponse(challenge, { status: 200 });
      } else {
        console.log(`Verification Status   : FAILURE (Token mismatch)`);
        console.log('====================================\n');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    if (mode || token || challenge) {
      console.log(`Verification Status   : FAILURE (Bad Request)`);
      console.log('====================================\n');
      return new NextResponse('Bad Request', { status: 400 });
    }

    // Case 2: Normal browser GET request for quick testing
    return NextResponse.json({
      status: "ok",
      service: "WhatsApp Webhook",
      environment: process.env.NODE_ENV || 'development',
      publicUrl: process.env.CLOUDFLARE_PUBLIC_URL || null,
      time: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error('[Meta Webhook] GET Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    
    console.log("================================================");
    console.log("META WEBHOOK RECEIVED (RAW)");
    console.log(new Date().toISOString());
    console.log(request.method);
    console.log(rawBody);
    console.log("================================================");

    const headersList = await headers();
    const headersObj: Record<string, string> = {};
    headersList.forEach((v, k) => {
      headersObj[k] = v;
    });

    const signature = headersObj['x-hub-signature-256'] || null;
    const ip = headersObj['x-forwarded-for'] || null;

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch(e) {
      console.error('[Meta Webhook] JSON parse error');
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }

    // Extract metrics for logging
    let eventType = 'Unknown';
    let statusesCount = 0;
    let messagesCount = 0;

    if (body?.object === 'whatsapp_business_account' && body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value) {
              if (change.value.statuses) {
                eventType = 'Status Update';
                statusesCount += change.value.statuses.length;
              }
              if (change.value.messages) {
                eventType = 'Incoming Message';
                messagesCount += change.value.messages.length;
              }
            }
          }
        }
      }
    }

    console.log('\n====================================');
    console.log('META WEBHOOK RECEIVED');
    console.log('====================================');
    console.log(`Timestamp       : ${new Date().toISOString()}`);
    console.log(`IP              : ${ip || 'Unknown'}`);
    console.log(`Event Type      : ${eventType}`);
    console.log(`Statuses Count  : ${statusesCount}`);
    console.log(`Messages Count  : ${messagesCount}`);
    console.log(`Headers         :\n${JSON.stringify(headersObj, null, 2)}`);
    console.log(`Raw JSON        :\n${JSON.stringify(body, null, 2)}`);
    console.log('====================================\n');

    // STEP 1: Log incoming request BEFORE parsing
    const incomingLog = await prisma.incomingWebhook.create({
      data: {
        provider: 'META',
        headers: headersObj,
        body: body,
        signature,
        ipAddress: ip,
        processed: false
      }
    });

    if (body.object === 'whatsapp_business_account' && body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            // STEP 2: Strict parsing. Only handle statuses
            if (change.field === 'messages' && change.value) {
              if (change.value.statuses) {
                for (const statusObj of change.value.statuses) {
                  await processMessageStatus(statusObj, incomingLog.id);
                }
              } else if (change.value.messages) {
                // Ignore incoming messages as per requirements
                await prisma.incomingWebhook.update({
                  where: { id: incomingLog.id },
                  data: {
                    processed: true,
                    processingResult: 'IGNORED_MESSAGE_OBJECT'
                  }
                });
              }
            }
          }
        }
      }
    }

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    console.error('[Meta Webhook] POST Error:', error);
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  }
}

async function processMessageStatus(statusObj: any, incomingWebhookId: string) {
  const wamid = statusObj.id;
  const status = statusObj.status;

  console.log(`\n--- Status Update Event ---`);
  console.log(`Status         : ${status}`);
  console.log(`Recipient      : ${statusObj.recipient_id || 'Unknown'}`);
  console.log(`WAMID          : ${wamid}`);
  console.log(`Conversation ID: ${statusObj.conversation?.id || 'None'}`);
  console.log(`Pricing        : ${statusObj.pricing?.category || 'None'}`);

  let timestampVal = parseInt(statusObj.timestamp);
  if (timestampVal < 10000000000) {
    timestampVal *= 1000;
  }
  const timestamp = statusObj.timestamp ? new Date(timestampVal) : new Date();

  // STEP 3: Explicit message matching using only wamid
  const communication = await prisma.communication.findFirst({
    where: { providerMessageId: wamid }
  });

  if (!communication) {
    console.warn("NO MATCH FOUND");
    await prisma.incomingWebhook.update({
      where: { id: incomingWebhookId },
      data: {
        processed: true,
        processingResult: 'FAILED_NO_MATCH',
        matchedMessageId: wamid
      }
    });
    return;
  }

  // STEP 8: Match found
  console.log("MATCH FOUND", communication.id);

  let updateData: any = {};
  
  if (status === 'sent') {
    if (communication.apiAcceptedAt && timestamp < communication.apiAcceptedAt) {
      console.warn(`[Meta Webhook] Warning: 'sent' timestamp (${timestamp}) is earlier than 'apiAcceptedAt' (${communication.apiAcceptedAt})`);
    }
    updateData.status = 'SENT';
    updateData.sentAt = timestamp;
  } else if (status === 'delivered') {
    if (communication.sentAt && timestamp < communication.sentAt) {
      console.warn(`[Meta Webhook] Warning: 'delivered' timestamp (${timestamp}) is earlier than 'sentAt' (${communication.sentAt})`);
    }
    updateData.status = 'DELIVERED';
    updateData.deliveredAt = timestamp;
  } else if (status === 'read') {
    if (communication.deliveredAt && timestamp < communication.deliveredAt) {
      console.warn(`[Meta Webhook] Warning: 'read' timestamp (${timestamp}) is earlier than 'deliveredAt' (${communication.deliveredAt})`);
    }
    updateData.status = 'READ';
    updateData.readAt = timestamp;
  } else if (status === 'failed') {
    updateData.status = 'FAILED';
    updateData.failedAt = timestamp;
    if (statusObj.errors && statusObj.errors.length > 0) {
      updateData.errorCode = String(statusObj.errors[0].code);
      updateData.errorMessage = statusObj.errors[0].title || statusObj.errors[0].message || 'Unknown error';
    }
  }

  // STEP 5: Update CommunicationLog fields
  if (statusObj.pricing) {
    updateData.pricingCategory = statusObj.pricing.category;
  }

  if (statusObj.conversation) {
    updateData.conversationId = statusObj.conversation.id;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.communication.update({
      where: { id: communication.id },
      data: updateData
    });
  }

  // STEP 4: Persist lifecycle to Timeline (never overwrite)
  await prisma.communicationTimeline.create({
    data: {
      communicationId: communication.id,
      status: status,
      timestamp: timestamp,
      providerResponse: statusObj
    }
  });

  await prisma.incomingWebhook.update({
    where: { id: incomingWebhookId },
    data: {
      processed: true,
      processingResult: 'SUCCESS',
      matchedMessageId: wamid
    }
  });
}

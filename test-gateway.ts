import { PrismaClient } from '@prisma/client';
import { GatewayClient } from './src/lib/services/GatewayClient';

const prisma = new PrismaClient();

async function run() {
  try {
    const template = await prisma.whatsAppTemplate.findFirst();
    if (!template) throw new Error("No template found");
    const config = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' }
    });
    
    const testRecipient = config?.testPhoneNumber || '+918744832318';

    const payload = {
      channel: 'whatsapp' as const,
      recipient: testRecipient,
      template: template.name,
      variables: { "invoice_number": "KT/26-27/1234" },
      metadata: {
        templateId: template.id,
      },
      requestedBy: 'test-user',
      source: 'kamna-erp-template-test'
    };
    console.log("SENDING PAYLOAD:", JSON.stringify(payload, null, 2));

    const response = await GatewayClient.sendCommunication(payload);
    
    console.log("Response:", response);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();

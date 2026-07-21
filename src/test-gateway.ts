import { PrismaClient } from '@prisma/client';
import { GatewayClient } from './lib/services/GatewayClient';

const prisma = new PrismaClient();

async function run() {
  try {
    const template = await prisma.whatsAppTemplate.findFirst();
    if (!template) throw new Error("No template found");
    const config = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' }
    });
    
    const testRecipient = config?.testPhoneNumber || '+918744832318';
    
    const normalizedRecipient = testRecipient.replace(/\D/g, '');
    const variables = { "invoice_number": "KT/26-27/1234" };
    const variablesArray = Object.values(variables);

    const payload = {
      channel: 'whatsapp' as const,
      recipient: normalizedRecipient,
      template: template.name,
      language: template.language || 'en',
      variables: variablesArray,
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

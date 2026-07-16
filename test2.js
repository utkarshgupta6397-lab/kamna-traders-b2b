const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const upsertData = {
      appId: "test",
      encryptedAccessToken: "test",
      phoneNumberId: "test",
      businessAccountId: "test",
      apiVersion: "test",
      webhookVerifyToken: "test",
      integrationEnabled: true,
  };
  
  const updated = await prisma.whatsAppConfiguration.upsert({
      where: { id: 'singleton' },
      update: upsertData,
      create: {
        id: 'singleton',
        ...upsertData,
      }
  });
  
  console.log("Upserted:", updated.integrationEnabled);
  
  const fetched = await prisma.whatsAppConfiguration.findUnique({ where: { id: 'singleton' } });
  console.log("Fetched:", fetched.integrationEnabled);
}
main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.whatsAppConfiguration.update({
    where: { id: 'singleton' },
    data: { integrationEnabled: true }
  });
  const c1 = await prisma.whatsAppConfiguration.findUnique({ where: { id: 'singleton'} });
  console.log("After forced update to true:", c1.integrationEnabled);
}
main().catch(console.error).finally(() => prisma.$disconnect());

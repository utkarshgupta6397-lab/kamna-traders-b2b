const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const config = await prisma.whatsAppConfiguration.findUnique({ where: { id: 'singleton' } });
  console.log(JSON.stringify(config, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

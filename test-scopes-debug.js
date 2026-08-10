const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const token = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  console.log(JSON.stringify(token, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

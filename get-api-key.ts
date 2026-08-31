import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.integrationConfig.findUnique({
    where: { key: 'INCOMING_SO_API_KEY' }
  });
  console.log('API_KEY:', config?.value || process.env.INCOMING_SO_API_KEY);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

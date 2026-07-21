import { prisma } from './src/lib/db';

async function main() {
  const config = await prisma.gatewayConfiguration.findUnique({ where: { id: 'singleton' } });
  console.log(config);
}

main().catch(console.error);

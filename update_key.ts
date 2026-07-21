import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const config = await prisma.gatewayConfiguration.findUnique({
    where: { id: 'singleton' }
  });
  
  if (config) {
    await prisma.gatewayConfiguration.update({
      where: { id: 'singleton' },
      data: { apiToken: 'kgw_DSTlg-FK_gs1RKWBfMz7-PDGGnzZjgrHsbeYKBYbSPmsV9LK' }
    });
    console.log('Updated API Key successfully. Previous URL was:', config.gatewayUrl);
  } else {
    // If not found, create it with a placeholder URL
    await prisma.gatewayConfiguration.create({
      data: {
        id: 'singleton',
        gatewayUrl: 'https://events.kamnatraders.com',
        apiToken: 'kgw_DSTlg-FK_gs1RKWBfMz7-PDGGnzZjgrHsbeYKBYbSPmsV9LK',
        connectionStatus: 'NOT_TESTED'
      }
    });
    console.log('Created new config with API key');
  }
  await prisma.$disconnect();
}

main().catch(console.error);

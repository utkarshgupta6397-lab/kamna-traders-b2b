require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const logs = await prisma.masterDataHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  for (const log of logs) {
    console.log(`Action: ${log.action}, Entity: ${log.entityType}`);
    console.log(`Prev: ${log.previousValue}`);
    console.log(`New: ${log.newValue}`);
    console.log('---');
  }
}

check().then(() => process.exit(0));

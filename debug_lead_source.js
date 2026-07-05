const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const orders = await prisma.solarOrder.findMany({ select: { leadSource: true } });
  const unique = [...new Set(orders.map(o => o.leadSource))];
  console.log("Unique leadSources:", unique);
}
run();

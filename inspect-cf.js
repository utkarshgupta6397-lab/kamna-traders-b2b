const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  const order = await prisma.dispatchIncomingOrder.findFirst({
    where: { zohoDetailsJson: { not: null } }
  });
  if (order && order.zohoDetailsJson) {
    console.log(JSON.stringify(order.zohoDetailsJson.custom_fields, null, 2));
  } else {
    console.log("No order found with zohoDetailsJson");
  }
}
inspect().finally(() => prisma.$disconnect());

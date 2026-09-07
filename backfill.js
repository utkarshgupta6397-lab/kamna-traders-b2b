const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  const orders = await prisma.dispatchIncomingOrder.findMany({
    where: { zohoDetailsJson: { not: null } }
  });

  console.log(`Found ${orders.length} orders to backfill`);

  for (const order of orders) {
    if (order.zohoDetailsJson) {
      const so = order.zohoDetailsJson;
      const uniqueRows = Array.isArray(so.line_items) ? so.line_items.length : 0;
      
      await prisma.dispatchIncomingOrder.update({
        where: { id: order.id },
        data: {
          customerId: so.customer_id || null,
          customerGst: so.gst_no || so.gst_number || "",
          totalUniqueRows: uniqueRows
        }
      });
    }
  }
  console.log('Backfill complete!');
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

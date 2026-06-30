import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Solar Orders Migration...');

  // 1. Fetch all existing orders sorted by creation date
  const orders = await prisma.solarOrder.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${orders.length} orders to migrate.`);

  // 2. Group orders by YearMonth and assign new sequence
  const updates: any[] = [];
  const sequenceMap: Record<string, number> = {};

  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    const currentYear = orderDate.getFullYear().toString().slice(2);
    const currentMonth = (orderDate.getMonth() + 1).toString().padStart(2, '0');
    const yearMonthStr = `${currentYear}${currentMonth}`;

    if (!sequenceMap[yearMonthStr]) {
      sequenceMap[yearMonthStr] = 0;
    }

    sequenceMap[yearMonthStr] += 1;
    const newSequence = sequenceMap[yearMonthStr];
    
    // Format: OD-YYMM-NNN
    const newOrderNumber = `OD-${yearMonthStr}-${newSequence.toString().padStart(3, '0')}`;
    
    updates.push(
      prisma.solarOrder.update({
        where: { id: order.id },
        data: { orderNumber: newOrderNumber },
      })
    );
  }

  // 3. Update the Sequence table
  for (const [yearMonthStr, finalSequence] of Object.entries(sequenceMap)) {
    updates.push(
      prisma.solarOrderSequence.upsert({
        where: { year: yearMonthStr },
        update: { sequence: finalSequence },
        create: { year: yearMonthStr, sequence: finalSequence },
      })
    );
  }

  // 4. Execute all updates in a transaction
  console.log(`Executing ${updates.length} operations in transaction...`);
  await prisma.$transaction(updates);

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const fields = Object.keys(prisma.cart.fields || {});
    console.log('Cart Fields:', fields);
    if (fields.includes('zohoExecutionTrace')) {
      console.log('SUCCESS: zohoExecutionTrace found in Prisma Client');
    } else {
      console.log('FAILURE: zohoExecutionTrace MISSING in Prisma Client');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

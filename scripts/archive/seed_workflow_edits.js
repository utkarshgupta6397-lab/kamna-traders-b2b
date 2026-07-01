const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Set all existing users to false
  await prisma.user.updateMany({
    data: {
      workflow_edits: false,
    },
  });

  // Set Admins to true
  await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
    },
    data: {
      workflow_edits: true,
    },
  });

  console.log('Migration complete: workflow_edits populated.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

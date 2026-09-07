import { prisma } from '../src/lib/db';

async function migrateDispatchPermissions() {
  console.log('[Migration] Migrating existing dispatch users...');

  // Find all users who currently have dispatch_view = true
  const usersWithDispatch = await prisma.user.findMany({
    where: { dispatch_view: true },
    select: { id: true, name: true, role: true }
  });

  console.log(`[Migration] Found ${usersWithDispatch.length} users with dispatch_view enabled.`);

  for (const user of usersWithDispatch) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        dispatch_rate_review: true,
        dispatch_payment_verification: true,
        dispatch_truck_details: true,
        dispatch_ready_for_invoice: true,
        dispatch_invoice_confirmation: true,
        dispatch_workflow_override: true,
      }
    });
    console.log(`[Migration] Updated permissions for user: ${user.name} (${user.id})`);
  }

  console.log('[Migration] Migration complete!');
}

migrateDispatchPermissions()
  .catch((err) => {
    console.error('[Migration Error]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

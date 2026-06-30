const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPermissions() {
  await prisma.user.updateMany({
    data: {
      solar_orders_view: true,
      solar_orders_create: true,
      solar_orders_edit: true,
      solar_orders_approve: true,
      solar_orders_delete: true,
      solar_documentation_view: true,
      solar_documentation_edit: true,
      solar_documentation_approve: true,
      solar_installation_view: true,
      solar_installation_complete: true,
      solar_upload_documents: true,
      solar_view_financials: true,
      solar_manage_workflow: true,
    }
  });
  console.log("All users granted full Solar Orders permissions for exploration.");
}

fixPermissions().then(() => process.exit(0));

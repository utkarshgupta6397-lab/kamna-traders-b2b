import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        mobile: true,
        role: true,
        canManageCarts: true,
        canAdjustInventory: true,
        canRunSkuSync: true,
        canManageZoneMappings: true,
        canManageUnlimitedSkus: true,
        canManageTransfers: true,
        canDeleteTransfers: true,
        accountsAccess: true, // Keep for backward compatibility if needed, or UI might throw error
        accounts_customer_statement: true,
        accounts_transactions: true,
        accounts_summary_view: true,
        stock_alerts_manage: true,
        accounts_recovery_manage: true,
        release_statement_queue: true,
        dcr_management: true,
        dcr_serial_mapping_override: true,
        dcr_hold_release: true,
        solar_orders_view: true,
        solar_orders_create: true,
        solar_orders_edit: true,
        solar_orders_edit_draft: true,
        solar_orders_submit: true,
        solar_orders_approve: true,
        solar_orders_reject: true,
        solar_orders_delete: true,
        solar_orders_view_rejected: true,
        solar_documentation_view: true,
        solar_documentation_edit: true,
        solar_documentation_approve: true,
        solar_installation_view: true,
        solar_installation_complete: true,
        solar_upload_documents: true,
        solar_view_financials: true,
        solar_manage_workflow: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[API] GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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
        accounts_reports_salesman: true,
        stock_alerts_manage: true,
        accounts_recovery_manage: true,
        release_statement_queue: true,
        dcr_management: true,
        dcr_serial_mapping_override: true,
        dcr_hold_release: true,
        solar_orders_view: true,
        solar_orders_create: true,
        solar_orders_approval: true,
        solar_orders_docs_progress: true,
        solar_orders_master_edit: true,
        workflow_edits: true,
        communications_view: true,
        communications_templates: true,
        whatsapp_integration: true,
        holdQueueReviewEnabled: true,
        holdQueueReviewLimit: true,
        catalog_brands_create: true,
        catalog_brands_modify: true,
        catalog_brands_approve: true,
        catalog_manufacturers_create: true,
        catalog_manufacturers_modify: true,
        catalog_manufacturers_approve: true,
        catalog_categories_create: true,
        catalog_categories_modify: true,
        catalog_categories_approve: true,
        catalog_attributes_create: true,
        catalog_attributes_modify: true,
        catalog_attributes_approve: true,
        catalog_taxrates_create: true,
        catalog_taxrates_modify: true,
        catalog_taxrates_approve: true,
        catalog_units_create: true,
        catalog_units_modify: true,
        catalog_units_approve: true,
        catalog_hsncodes_create: true,
        catalog_hsncodes_modify: true,
        catalog_hsncodes_approve: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[API] GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

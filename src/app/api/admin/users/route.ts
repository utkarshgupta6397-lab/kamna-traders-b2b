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
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[API] GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

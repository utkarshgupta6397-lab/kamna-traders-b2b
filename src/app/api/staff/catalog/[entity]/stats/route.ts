import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ENTITY_REGISTRY, MasterEntityKey, getPrismaDelegate } from '@/lib/master-data-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entity } = await params;
  const meta = ENTITY_REGISTRY[entity as MasterEntityKey];
  if (!meta) {
    return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
  }

  try {
    const delegate = getPrismaDelegate(entity as MasterEntityKey);

    let total = 0, draft = 0, pending = 0, approved = 0, inactive = 0, archived = 0;

    try {
      [total, draft, pending, approved, inactive, archived] = await Promise.all([
        delegate.count(),
        delegate.count({ where: { status: 'Draft' } }),
        delegate.count({ where: { status: 'Approval Pending' } }),
        delegate.count({ where: { status: 'Approved' } }),
        delegate.count({ where: { status: 'Inactive' } }),
        delegate.count({ where: { status: 'Archived' } }),
      ]);
    } catch {
      total = await delegate.count().catch(() => 0);
      approved = total;
    }

    return NextResponse.json({
      total,
      draft,
      pending,
      approved,
      inactive,
      archived,
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/${entity}/stats error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

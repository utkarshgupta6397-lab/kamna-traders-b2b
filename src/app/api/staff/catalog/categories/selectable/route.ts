import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { CategoryService } from '@/lib/services/CategoryService';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const selectable = await CategoryService.getSelectableTree();
    return NextResponse.json({ records: selectable, total: selectable.length, page: 1, limit: selectable.length });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/categories/selectable error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

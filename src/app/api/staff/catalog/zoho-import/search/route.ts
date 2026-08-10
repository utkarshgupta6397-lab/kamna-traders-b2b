import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ZohoBooksImportService } from '@/lib/services/import/ZohoBooksImportService';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field');
    const term = searchParams.get('term');

    if (!field || !term) {
      return NextResponse.json({ error: 'Missing field or term' }, { status: 400 });
    }

    const items = await ZohoBooksImportService.searchItems(field, term);
    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('[Zoho Import Search]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

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
    const remoteId = searchParams.get('remoteId');

    if (!remoteId) {
      return NextResponse.json({ error: 'Missing remoteId' }, { status: 400 });
    }

    const preview = await ZohoBooksImportService.previewItem(remoteId);
    return NextResponse.json(preview);
  } catch (error: any) {
    console.error('[Zoho Import Preview]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

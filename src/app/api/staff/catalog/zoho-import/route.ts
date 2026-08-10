import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ZohoBooksImportService } from '@/lib/services/import/ZohoBooksImportService';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { remoteId } = await request.json();

    if (!remoteId) {
      return NextResponse.json({ error: 'Missing remoteId' }, { status: 400 });
    }

    const result = await ZohoBooksImportService.importItem(remoteId, session.userId);
    
    if (result.success === false) {
      return NextResponse.json(result, { status: result.status || 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Zoho Import Execution]', error);
    return NextResponse.json({ 
      success: false, 
      step: 'Endpoint Execution', 
      error: error.message || 'Internal server error',
      stack: error.stack 
    }, { status: 500 });
  }
}

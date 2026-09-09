import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { getOrFetchInvoiceDetail } from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Post-Dispatch access required.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const forceRefresh = Boolean(body?.forceRefresh);

    const result = await getOrFetchInvoiceDetail({
      invoiceId: id,
      forceRefresh,
      userId: session.userId || session.id,
      userName: session.name || 'Staff',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to retrieve invoice inventory detail' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      source: result.source,
      lines: result.lines,
      invoice: result.invoice,
    });
  } catch (err: any) {
    console.error('[ReviewInventory API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve inventory details' },
      { status: 500 }
    );
  }
}

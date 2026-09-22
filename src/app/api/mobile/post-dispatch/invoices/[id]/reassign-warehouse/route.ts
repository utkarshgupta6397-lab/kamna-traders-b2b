import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { reassignPostDispatchWarehouse } from '@/lib/post-dispatch-warehouse-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Strict server-side authorization check: Admin OR dispatch_force_archive
  const canForceArchive = session.role === 'ADMIN' || Boolean(session.dispatch_force_archive);
  if (!canForceArchive || !hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. dispatch_force_archive permission required to reassign warehouse.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Invoice ID is required.' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetWarehouseId = (body?.targetWarehouseId || body?.warehouseId || '').trim();
    const rawReason = body?.reason;
    const expectedCurrentWarehouse = body?.expectedCurrentWarehouse;

    // Validate reason: mandatory, trimmed, non-empty
    if (!rawReason || typeof rawReason !== 'string' || !rawReason.trim()) {
      return NextResponse.json(
        { error: 'Reason for warehouse reassignment is mandatory.' },
        { status: 400 }
      );
    }

    if (!targetWarehouseId) {
      return NextResponse.json(
        { error: 'Target warehouse ID is required.' },
        { status: 400 }
      );
    }

    const userId = (session.userId as string) || (session.id as string) || 'unknown';
    const userName = (session.name as string) || 'Staff';

    const result = await reassignPostDispatchWarehouse({
      invoiceId: id,
      targetWarehouseId,
      reason: rawReason,
      expectedCurrentWarehouse,
      userId,
      userName,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.code === 'CONCURRENCY_CONFLICT') {
      return NextResponse.json(
        {
          error: error.message,
          conflict: true,
          currentWarehouse: error.currentWarehouse,
        },
        { status: 409 }
      );
    }

    if (error?.message === 'Invoice not found.') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (
      error?.message === 'Target warehouse is invalid, inactive, or not allowed.' ||
      error?.message === 'Reason for warehouse reassignment is mandatory.' ||
      error?.message === 'Target warehouse ID is required.'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('[Reassign Warehouse API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to reassign dispatch warehouse.' },
      { status: 500 }
    );
  }
}

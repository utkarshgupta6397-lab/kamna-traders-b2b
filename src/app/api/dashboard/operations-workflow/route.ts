import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getOperationsWorkflowSummary,
  getOperationsCellInvoices,
  OperationsPendingState,
} from '@/lib/operations-workflow-summary';
import { hasPostDispatchAccess, canViewStockApproval } from '@/lib/post-dispatch-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authorize staff: ADMIN, post dispatch access, stock approval view, transfers, or dispatch view
  const isAuthorized =
    session.role === 'ADMIN' ||
    hasPostDispatchAccess(session) ||
    canViewStockApproval(session) ||
    Boolean(session.canManageTransfers) ||
    Boolean(session.dispatch_view);

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Forbidden. Operations or Post-Dispatch access required.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const isDetail = searchParams.get('detail') === 'true';

  try {
    if (isDetail) {
      const warehouse = searchParams.get('warehouse') || '';
      const bucketKey = searchParams.get('bucketKey') || '';
      const state = (searchParams.get('state') || '').toUpperCase() as OperationsPendingState;

      if (!warehouse || !bucketKey || !['RECEIVING', 'CHECK', 'INVENTORY'].includes(state)) {
        return NextResponse.json(
          { error: 'Missing or invalid parameters: warehouse, bucketKey, state required' },
          { status: 400 }
        );
      }

      const cellData = await getOperationsCellInvoices({
        warehouse,
        bucketKey,
        state: state as 'RECEIVING' | 'CHECK' | 'INVENTORY',
      });

      return NextResponse.json({
        success: true,
        data: cellData,
      });
    }

    const summary = await getOperationsWorkflowSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('[Operations Workflow API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch operations workflow data' },
      { status: 500 }
    );
  }
}

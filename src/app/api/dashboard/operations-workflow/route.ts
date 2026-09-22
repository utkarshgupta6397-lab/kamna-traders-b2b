import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getOperationsWorkflowSummary,
  getOperationsCellInvoices,
  OperationsStage,
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
      const warehouse = searchParams.get('warehouse') || 'ALL';
      const bucketKey = searchParams.get('bucketKey') || 'ALL';
      const stageRaw = (searchParams.get('stage') || 'TOTAL').toUpperCase();
      const validStages: OperationsStage[] = ['RECEIVING', 'CHECK', 'INVENTORY', 'TOTAL'];
      const stage: OperationsStage = validStages.includes(stageRaw as OperationsStage)
        ? (stageRaw as OperationsStage)
        : 'TOTAL';

      const cellData = await getOperationsCellInvoices({
        warehouse,
        bucketKey,
        stage,
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

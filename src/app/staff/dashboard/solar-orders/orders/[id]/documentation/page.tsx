import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import DocumentationTabClient from './DocumentationTabClient';

export default async function DocumentationTab({ params }: { params: { id: string } }) {
  const { id } = await params;
  const session = await getSession();
  
  const steps = await prisma.solarWorkflowStep.findMany({
    where: { solarOrderId: id, workflowType: 'DOCUMENTATION' },
    orderBy: { stepIndex: 'asc' },
    include: { completedBy: { select: { name: true } } }
  });

  const order = await prisma.solarOrder.findUnique({
    where: { id },
  });

  const canProgress = session?.role === 'ADMIN' || session?.solar_orders_view;
  const canApprove = session?.role === 'ADMIN' || session?.solar_orders_approval;
  const canMasterEdit = session?.role === 'ADMIN' || session?.solar_orders_master_edit;
  const canManageWorkflowEdits = session?.role === 'ADMIN' || session?.workflow_edits;

  if (steps.length === 0 || !order) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm text-center py-12">
        <h2 className="text-xl font-bold text-[#1A2766] mb-2">Workflow Not Initialized</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          The documentation workflow will begin once the order is approved and moves to EXECUTION.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DocumentationTabClient order={order} steps={steps} canProgress={!!canProgress} canApprove={!!canApprove} canMasterEdit={!!canMasterEdit} canManageWorkflowEdits={!!canManageWorkflowEdits} />
    </div>
  );
}

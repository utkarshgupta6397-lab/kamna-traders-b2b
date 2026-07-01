import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import InstallationTabClient from './InstallationTabClient';

export default async function InstallationTab({ params }: { params: { id: string } }) {
  const { id } = await params;
  const session = await getSession();
  
  const order = await prisma.solarOrder.findUnique({
    where: { id },
    include: {
      workflowSteps: true
    }
  });

  const steps = order?.workflowSteps.filter(s => s.workflowType === 'INSTALLATION').sort((a, b) => a.stepIndex - b.stepIndex) || [];
  
  // They unified the permission to solar_orders_docs_progress earlier
  const canEdit = session?.role === 'ADMIN' || !!session?.solar_orders_docs_progress;
  const canMasterEdit = session?.role === 'ADMIN' || !!session?.solar_orders_master_edit;
  const canManageWorkflowEdits = session?.role === 'ADMIN' || !!session?.workflow_edits;

  if (steps.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm text-center py-12">
        <h2 className="text-xl font-bold text-[#1A2766] mb-2">Workflow Not Initialized</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          The installation workflow will begin once the order is approved and moves to EXECUTION.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900">Installation Checklist</h2>
        <p className="text-sm text-gray-500">Step {steps.filter(s => s.status === 'COMPLETED').length} of {steps.length} completed</p>
      </div>
      <InstallationTabClient 
        orderId={id} 
        steps={steps as any} 
        canEdit={canEdit}
        canApprove={false}
        canMasterEdit={canMasterEdit}
        canManageWorkflowEdits={canManageWorkflowEdits}
        debugInfo={{
          orderStatus: order?.status || 'UNKNOWN',
          hasPermission: canEdit
        }}
      />
    </div>
  );
}

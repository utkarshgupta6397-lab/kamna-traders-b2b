import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import QueueTable from '../QueueTable';

export default async function InstallationQueue() {
  const session = await getSession();

  const isAdmin = session?.role === 'ADMIN';
  const canViewInstallQueue = isAdmin || !!session?.solar_installation_view;

  if (!canViewInstallQueue) {
    redirect('/staff/dashboard/solar-orders');
  }

  // Fetch all installation workflow steps that are currently active (PENDING, IN_PROGRESS, BLOCKED)
  const activeSteps = await prisma.solarWorkflowStep.findMany({
    where: {
      workflowType: 'INSTALLATION',
      status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
      solarOrder: { status: 'EXECUTION' } // Only for active orders
    },
    orderBy: [
      { updatedAt: 'asc' } // Oldest first
    ],
    include: {
      solarOrder: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          systemSize: true,
          systemType: true,
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A2766]">Installation Queue</h1>
          <p className="text-sm text-gray-500">Orders currently requiring physical installation</p>
        </div>
      </div>

      <QueueTable items={activeSteps} queueType="INSTALLATION" />
    </div>
  );
}

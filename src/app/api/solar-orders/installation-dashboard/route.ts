import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { INSTALLATION_STEPS, WORKFLOW_CONFIG, resolveWorkflowState } from '@/lib/solar-workflow-config';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.role === 'ADMIN';
    const isStaff = session.role === 'STAFF';
    // User mentioned "Use the same permissions as Documentation."
    // And from layout: const canViewInstallQueue = isAdmin || !!session.solar_installation_view;
    const canViewInstallQueue = isAdmin || isStaff || !!session.solar_documentation_view || !!session.solar_installation_view;

    if (!canViewInstallQueue) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const assignedTo = searchParams.get('assignedTo');
    const installationStage = searchParams.get('installationStage');

    const where: any = { 
      status: { notIn: ['CANCELLED', 'REJECTED'] } 
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { applicationNumber: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (assignedTo && assignedTo !== 'All') {
      if (assignedTo === 'Unassigned') {
        where.salesmanId = null;
        where.callingExecutiveId = null;
        where.subVendorId = null;
      } else {
        where.OR = [
          ...(where.OR || []),
          { salesmanId: assignedTo },
          { callingExecutiveId: assignedTo },
          { subVendorId: assignedTo }
        ];
      }
    }

    const orders = await prisma.solarOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        orderDate: true,
        totalOrderAmount: true,
        status: true,
        salesman: { select: { name: true } },
        callingExecutive: { select: { name: true } },
        workflowSteps: {
          where: { workflowType: 'INSTALLATION' },
          select: {
            stepKey: true,
            status: true,
            completedAt: true,
            updatedAt: true,
            startedAt: true,
            notes: true,
            completedBy: { select: { name: true } },
            metadata: true
          },
          orderBy: { stepIndex: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date().getTime();
    const columnCounters: Record<string, number> = {};
    INSTALLATION_STEPS.forEach(step => columnCounters[step] = 0);

    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalPendingReview = 0;
    let totalOverdue = 0;

    const transformedItems = orders.map(order => {
      const state = resolveWorkflowState(order.workflowSteps, 'INSTALLATION');

      if (state.isCompleted) {
        return null; // Exclude fully completed workflows from the dashboard
      }

      for (const stepName of INSTALLATION_STEPS) {
        const step = state.stepsMap[stepName];
        if (step.status !== 'COMPLETED') {
           if (step.status === 'PENDING' || step.status === 'IN_PROGRESS' || step.status === 'BLOCKED') {
             columnCounters[stepName] = (columnCounters[stepName] || 0) + 1;
           }
           if (stepName.includes('Review') && step.status === 'PENDING') {
             totalPendingReview++;
           }
        }
      }

      totalInProgress++;
      if (state.isOverdue) totalOverdue++;

      const assignedExecutive = order.callingExecutive?.name || order.salesman?.name || 'Unassigned';

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        totalOrderAmount: order.totalOrderAmount,
        assignedExecutive,
        workflowPercentage: state.progressPercentage,
        completedSteps: state.completedSteps,
        totalSteps: state.totalSteps,
        currentStage: state.currentStage,
        isOverdue: state.isOverdue,
        stepsMap: state.stepsMap
      };
    }).filter(Boolean);

    const validItems = transformedItems.filter((item): item is NonNullable<typeof item> => item !== null);
    
    let filteredItems = validItems;
    if (installationStage && installationStage !== 'All') {
      filteredItems = filteredItems.filter(item => item.currentStage === installationStage);
    }

    const summary = {
      total: validItems.length,
      completed: totalCompleted,
      inProgress: totalInProgress,
      pendingReview: totalPendingReview,
      overdue: totalOverdue,
      averageCompletionTime: "N/A"
    };

    return NextResponse.json({
      summary,
      columnCounters,
      items: filteredItems,
      allSteps: INSTALLATION_STEPS
    });

  } catch (error: any) {
    console.error('Error fetching installation dashboard:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch installation data' }, { status: 500 });
  }
}

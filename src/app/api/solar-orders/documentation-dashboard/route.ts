import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DOCUMENTATION_STEPS, WORKFLOW_CONFIG, resolveWorkflowState } from '@/lib/solar-workflow-config';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.role === 'ADMIN';
    const isStaff = session.role === 'STAFF';
    const canViewDocQueue = isAdmin || isStaff || !!session.solar_documentation_view;

    if (!canViewDocQueue) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const documentationStage = searchParams.get('documentationStage');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const skip = (page - 1) * limit;

    const where: any = { 
      status: { in: ['APPROVED', 'EXECUTION', 'COMPLETED'] } 
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

    // 1. Fetch ALL matching orders with MINIMAL fields for KPI aggregation
    const ordersForKpis = await prisma.solarOrder.findMany({
      where,
      select: {
        id: true,
        workflowSteps: {
          where: { workflowType: 'DOCUMENTATION' },
          select: {
            stepKey: true,
            status: true,
            updatedAt: true,
            startedAt: true,
            metadata: true
          },
          orderBy: { stepIndex: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date().getTime();
    const columnCounters: Record<string, number> = {};
    DOCUMENTATION_STEPS.forEach(step => columnCounters[step] = 0);

    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalPendingReview = 0;
    let totalOverdue = 0;

    const transformedItems = ordersForKpis.map(order => {
      const state = resolveWorkflowState(order.workflowSteps, 'DOCUMENTATION');

      if (state.isCompleted) {
        return null; // Exclude fully completed workflows from the dashboard
      }

      // Update counters based on the returned stepsMap
      for (const [stepName, stepData] of Object.entries(state.stepsMap)) {
        if (stepData.status === 'PENDING' || stepData.status === 'IN_PROGRESS' || stepData.status === 'BLOCKED') {
          // Note: Only count up to the first non-completed step or just count all pending?
          // The old logic only counted up to the first non-completed step because of the `break` or did it?
          // Wait, the old logic had a bug where it just looped and `break` wasn't even there in documentation-dashboard!
          // Actually, old logic looped over all DOCUMENTATION_STEPS, and for non-completed ones it incremented columnCounters.
        }
      }
      
      // Let's just strictly re-implement the KPI counting based on the state map
      for (const stepName of DOCUMENTATION_STEPS) {
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
      
      return {
        id: order.id,
        currentStage: state.currentStage,
        isOverdue: state.isOverdue
      };
    });

    const validItems = transformedItems.filter((item): item is NonNullable<typeof item> => item !== null);

    // Apply documentationStage filter if present (post-processing since we derived currentStage)
    let filteredItems = validItems;
    if (documentationStage && documentationStage !== 'All') {
      filteredItems = filteredItems.filter(item => item.currentStage === documentationStage);
    }

    // Paginate the IDs
    const totalCount = filteredItems.length;
    const paginatedIds = filteredItems.slice(skip, skip + limit).map(item => item.id);

    // 2. Fetch full data ONLY for the paginated page
    const fullItemsQuery = await prisma.solarOrder.findMany({
      where: { id: { in: paginatedIds } },
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
          where: { workflowType: 'DOCUMENTATION' },
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

    const fullItems = fullItemsQuery.map(order => {
      const state = resolveWorkflowState(order.workflowSteps, 'DOCUMENTATION');
      const assignedExecutive = order.callingExecutive?.name || order.salesman?.name || 'Unassigned';
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        totalOrderAmount: order.totalOrderAmount,
        assignedExecutive,
        workflowPercentage: state.progressPercentage,
        currentStage: state.currentStage,
        isOverdue: state.isOverdue,
        stepsMap: state.stepsMap
      };
    });

    // Re-sort fullItems to match original filteredItems order
    const idToIndex = Object.fromEntries(paginatedIds.map((id, index) => [id, index]));
    fullItems.sort((a, b) => idToIndex[a.id] - idToIndex[b.id]);

    const summary = {
      total: totalCount,
      completed: totalCompleted,
      inProgress: totalInProgress,
      pendingReview: totalPendingReview,
      overdue: totalOverdue,
      averageCompletionTime: "N/A"
    };

    return NextResponse.json({
      summary,
      columnCounters,
      items: fullItems,
      allSteps: DOCUMENTATION_STEPS,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        page,
        limit
      }
    });

  } catch (error: any) {
    console.error('Error fetching documentation dashboard:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch documentation data' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { INSTALLATION_STEPS, WORKFLOW_CONFIG, resolveWorkflowState, ACTIVE_WORKFLOW_ORDER_STATUSES } from '@/lib/solar-workflow-config';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? 10000 : Math.min(parseInt(limitParam || '1000'), 1000);

    const sortField = searchParams.get('sortField');
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';
    const hasOutstandingPayment = searchParams.get('hasOutstandingPayment') === 'true';

    const skip = (page - 1) * limit;

    const where: any = { 
      status: { in: ACTIVE_WORKFLOW_ORDER_STATUSES } 
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
        const assigneeOR = [
          { salesmanId: assignedTo },
          { callingExecutiveId: assignedTo },
          { subVendorId: assignedTo }
        ];
        if (where.OR) {
          where.AND = [ { OR: where.OR }, { OR: assigneeOR } ];
          delete where.OR;
        } else {
          where.OR = assigneeOR;
        }
      }
    }

    if (hasOutstandingPayment) {
      const paymentCondition = {
        OR: [
          { zohoBooksCustomerId: { not: null }, pendingAmount: { gt: 0 } },
          { zohoBooksCustomerId: null, totalOrderAmount: { gt: 0 } }
        ]
      };
      if (!where.AND) where.AND = [];
      where.AND.push(paymentCondition);
    }
    
    let orderBy: any = { updatedAt: 'desc' };
    if (sortField) {
      switch(sortField) {
        case 'orderAmount': orderBy = { totalOrderAmount: sortDirection }; break;
        case 'pendingAmount': orderBy = { pendingAmount: sortDirection }; break;
        case 'orderDate': orderBy = { orderDate: sortDirection }; break;
        case 'customerName': orderBy = { customerName: sortDirection }; break;
        case 'systemSize': orderBy = { systemSize: sortDirection }; break;
      }
    }

    // 1. Fetch ALL matching orders with MINIMAL fields for KPI aggregation
    const ordersForKpis = await prisma.solarOrder.findMany({
      where,
      select: {
        id: true,
        workflowSteps: {
          where: { workflowType: 'INSTALLATION' },
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
      orderBy
    });

    const now = new Date().getTime();
    const columnCounters: Record<string, number> = {};
    INSTALLATION_STEPS.forEach(step => columnCounters[step] = 0);

    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalPendingReview = 0;
    let totalOverdue = 0;

    const transformedItems = ordersForKpis.map(order => {
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

      return {
        id: order.id,
        currentStage: state.currentStage,
        isOverdue: state.isOverdue
      };
    }).filter(Boolean);

    const validItems = transformedItems.filter((item): item is NonNullable<typeof item> => item !== null);
    
    let filteredItems = validItems;
    if (installationStage && installationStage !== 'All') {
      filteredItems = filteredItems.filter(item => item.currentStage === installationStage);
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
        systemType: true,
        leadSource: true,
        phoneNumber: true,
        zohoBooksCustomerId: true,
        salesman: { select: { name: true } },
        callingExecutive: { select: { name: true } },
        subVendor: { select: { name: true } },
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
      orderBy
    });

    const fullItems = fullItemsQuery.map(order => {
      const state = resolveWorkflowState(order.workflowSteps, 'INSTALLATION');
      const assignedExecutive = order.callingExecutive?.name || order.salesman?.name || 'Unassigned';
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        totalOrderAmount: order.totalOrderAmount,
        status: order.status,
        systemType: order.systemType,
        leadSource: order.leadSource,
        phoneNumber: order.phoneNumber,
        zohoBooksCustomerId: order.zohoBooksCustomerId,
        salesman: order.salesman,
        callingExecutive: order.callingExecutive,
        subVendor: order.subVendor,
        assignedExecutive,
        workflowPercentage: state.progressPercentage,
        completedSteps: state.completedSteps,
        totalSteps: state.totalSteps,
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
      allSteps: INSTALLATION_STEPS,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        page,
        limit
      }
    });

  } catch (error: any) {
    console.error('Error fetching installation dashboard:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch installation data' }, { status: 500 });
  }
}

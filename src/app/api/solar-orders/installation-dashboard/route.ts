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
    const { buildSolarOrdersWhereClause } = await import('@/lib/solar-filters');
    const where = buildSolarOrdersWhereClause(searchParams);

    // Default to active workflows unless a specific status is provided
    const statusParam = searchParams.get('status');
    const search = searchParams.get('search');
    
    if (!statusParam || statusParam === 'All') {
      where.status = { in: ACTIVE_WORKFLOW_ORDER_STATUSES };
    }

    const installationStage = searchParams.get('installationStage');
    const page = parseInt(searchParams.get('page') || '1');
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? 10000 : Math.min(parseInt(limitParam || '1000'), 1000);

    const sortField = searchParams.get('sortField');
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    let orderBy: any = { orderDate: 'asc' };
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
        customerName: true,
        orderDate: true,
        totalOrderAmount: true,
        pendingAmount: true,
        zohoBooksCustomerId: true,
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

      const isZohoLinked = !!order.zohoBooksCustomerId;
      const actualPendingAmount = isZohoLinked ? order.pendingAmount : order.totalOrderAmount;
      const paidAmount = order.totalOrderAmount - actualPendingAmount;
      const paymentPercentage = order.totalOrderAmount > 0 ? (paidAmount / order.totalOrderAmount) * 100 : 0;

      return {
        id: order.id,
        currentStage: state.currentStage,
        isOverdue: state.isOverdue,
        workflowPercentage: state.progressPercentage,
        customerName: order.customerName,
        orderDate: order.orderDate ? new Date(order.orderDate).getTime() : 0,
        paidAmount,
        paymentPercentage,
        totalOrderAmount: order.totalOrderAmount
      };
    }).filter(Boolean);

    const validItems = transformedItems.filter((item): item is NonNullable<typeof item> => item !== null);
    
    let filteredItems = validItems;
    if (installationStage && installationStage !== 'All') {
      filteredItems = filteredItems.filter(item => item.currentStage === installationStage);
    }

    // In-memory sorting for computed fields or specific columns
    if (sortField) {
      filteredItems.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;
        
        switch (sortField) {
          case 'customerName':
            valA = a.customerName.toLowerCase();
            valB = b.customerName.toLowerCase();
            break;
          case 'orderDate':
            valA = a.orderDate;
            valB = b.orderDate;
            break;
          case 'paymentPercentage':
            valA = a.paymentPercentage;
            valB = b.paymentPercentage;
            break;
          case 'totalOrderAmount':
            valA = a.totalOrderAmount;
            valB = b.totalOrderAmount;
            break;
          case 'workflowPercentage':
            valA = a.workflowPercentage;
            valB = b.workflowPercentage;
            break;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
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
        pendingAmount: true,
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
      const isZohoLinked = !!order.zohoBooksCustomerId;
      const actualPendingAmount = isZohoLinked ? order.pendingAmount : order.totalOrderAmount;
      const paidAmount = order.totalOrderAmount - actualPendingAmount;
      const paymentPercentage = order.totalOrderAmount > 0 ? (paidAmount / order.totalOrderAmount) * 100 : 0;

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
        stepsMap: state.stepsMap,
        paidAmount,
        paymentPercentage
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

    const { computeFacets, computeStatusCounts } = await import('@/lib/solar-facets');
    const [filterOptions, statusCounts] = await Promise.all([
      computeFacets(where),
      computeStatusCounts(search, ACTIVE_WORKFLOW_ORDER_STATUSES)
    ]);

    return NextResponse.json({
      summary,
      columnCounters,
      items: fullItems,
      allSteps: INSTALLATION_STEPS,
      filterOptions,
      statusCounts,
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

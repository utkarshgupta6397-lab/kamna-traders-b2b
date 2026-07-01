import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DOCUMENTATION_STEPS, WORKFLOW_CONFIG } from '@/lib/solar-workflow-config';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.role === 'ADMIN';
    const canViewDocQueue = isAdmin || !!session.solar_documentation_view;

    if (!canViewDocQueue) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const documentationStage = searchParams.get('documentationStage');

    const where: any = { status: 'EXECUTION' }; // Only show executing orders in this pipeline

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } }
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
      orderBy: { createdAt: 'desc' } // or whatever default sorting makes sense
    });

    const now = new Date().getTime();
    const columnCounters: Record<string, number> = {};
    DOCUMENTATION_STEPS.forEach(step => columnCounters[step] = 0);

    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalPendingReview = 0;
    let totalOverdue = 0;

    const transformedItems = orders.map(order => {
      let completedSteps = 0;
      let currentStage = 'Completed';
      let isOverdue = false;
      const stepsMap: Record<string, any> = {};

      const totalSteps = DOCUMENTATION_STEPS.length;
      let orderIsCompleted = true;

      // Ensure steps correspond exactly to DOCUMENTATION_STEPS order
      for (const stepName of DOCUMENTATION_STEPS) {
        const step = order.workflowSteps.find(s => (s.metadata as any)?.name === stepName);
        if (!step) {
          stepsMap[stepName] = { status: 'PENDING' };
          orderIsCompleted = false;
          if (currentStage === 'Completed') currentStage = stepName;
          continue;
        }

        stepsMap[stepName] = {
          status: step.status,
          updatedAt: step.updatedAt,
          completedAt: step.completedAt,
          startedAt: step.startedAt,
          completedByName: step.completedBy?.name,
          notes: step.notes
        };

        if (step.status === 'COMPLETED') {
          completedSteps++;
        } else {
          orderIsCompleted = false;
          if (currentStage === 'Completed') currentStage = stepName;

          if (step.status === 'PENDING' || step.status === 'IN_PROGRESS' || step.status === 'BLOCKED') {
            columnCounters[stepName] = (columnCounters[stepName] || 0) + 1;
          }

          // Check overdue
          const referenceDate = step.startedAt || step.updatedAt;
          if (referenceDate && (step.status === 'PENDING' || step.status === 'IN_PROGRESS')) {
            const diffDays = (now - referenceDate.getTime()) / (1000 * 3600 * 24);
            if (diffDays > WORKFLOW_CONFIG.OVERDUE_THRESHOLD_DAYS) {
              isOverdue = true;
            }
          }
          
          if (stepName.includes('Review') && step.status === 'PENDING') {
            // Count for Pending Review KPI if current step is a review step
            totalPendingReview++;
          }
        }
      }

      if (orderIsCompleted) {
        totalCompleted++;
      } else {
        totalInProgress++;
      }

      if (isOverdue) totalOverdue++;

      const workflowPercentage = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
      
      const assignedExecutive = order.callingExecutive?.name || order.salesman?.name || 'Unassigned';

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        totalOrderAmount: order.totalOrderAmount,
        assignedExecutive,
        workflowPercentage,
        currentStage,
        isOverdue,
        stepsMap
      };
    });

    // Apply documentationStage filter if present (post-processing since we derived currentStage)
    let filteredItems = transformedItems;
    if (documentationStage && documentationStage !== 'All') {
      filteredItems = filteredItems.filter(item => item.currentStage === documentationStage);
    }

    const summary = {
      total: transformedItems.length,
      completed: totalCompleted,
      inProgress: totalInProgress,
      pendingReview: totalPendingReview,
      overdue: totalOverdue,
      averageCompletionTime: "N/A" // Complex to calculate without a strict completion definition, stub for now
    };

    return NextResponse.json({
      summary,
      columnCounters,
      items: filteredItems,
      allSteps: DOCUMENTATION_STEPS
    });

  } catch (error: any) {
    console.error('Error fetching documentation dashboard:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch documentation data' }, { status: 500 });
  }
}

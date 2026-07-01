import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { DOCUMENTATION_STEPS, INSTALLATION_STEPS } from '@/lib/solar-workflow-config';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { status, remarks } = body;

    const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'EXECUTION', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
    }

    const order = await prisma.solarOrder.findUnique({ where: { id }, select: { id: true, status: true, orderNumber: true, orderDate: true } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const isAdmin = session.role === 'ADMIN';

    // Validation Rules based on Blueprint
    if (status === 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Cannot manually transition to Pending Approval' }, { status: 400 });
    }

    if (status === 'APPROVED') {
      if (order.status !== 'PENDING_APPROVAL') return NextResponse.json({ error: 'Only PENDING_APPROVAL orders can be approved' }, { status: 400 });
      if (!isAdmin && !session.solar_orders_approval) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    if (status === 'CANCELLED') {
      if (!isAdmin) return NextResponse.json({ error: 'Only Administrators can cancel orders' }, { status: 403 });
      if (!remarks) return NextResponse.json({ error: 'Cancellation remarks are required' }, { status: 400 });
    }

    if (status === 'REJECTED') {
      if (order.status !== 'PENDING_APPROVAL') return NextResponse.json({ error: 'Only PENDING_APPROVAL orders can be rejected' }, { status: 400 });
      if (!isAdmin && !session.solar_orders_approval) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      if (!remarks || remarks.trim() === '') return NextResponse.json({ error: 'Rejection remarks are mandatory' }, { status: 400 });
    }

    // Execute state transition
    const result = await prisma.$transaction(async (tx) => {
      let finalStatus = status;

      // If approved, automatically transition to EXECUTION and initialize workflows
      if (status === 'APPROVED') {
        finalStatus = 'EXECUTION';
      }

      let newOrderNumber = order.orderNumber;
      if (status === 'APPROVED' && order.orderNumber.startsWith('TEMP-')) {
        const orderDateObj = new Date(order.orderDate);
        const currentYear = orderDateObj.getFullYear().toString().slice(2);
        const currentMonth = (orderDateObj.getMonth() + 1).toString().padStart(2, '0');
        const yearMonthStr = `${currentYear}${currentMonth}`;
        
        let seqRecord = await tx.solarOrderSequence.upsert({
          where: { year: yearMonthStr },
          update: { sequence: { increment: 1 } },
          create: { year: yearMonthStr, sequence: 1 },
        });

        const highestOrder = await tx.solarOrder.findFirst({
          where: { orderNumber: { startsWith: `OD-${yearMonthStr}-` } },
          orderBy: { orderNumber: 'desc' }
        });

        let actualSequence = seqRecord.sequence;
        if (highestOrder) {
          const maxSeq = parseInt(highestOrder.orderNumber.split('-')[2], 10);
          if (!isNaN(maxSeq) && maxSeq >= actualSequence) {
            actualSequence = maxSeq + 1;
            await tx.solarOrderSequence.update({
              where: { year: yearMonthStr },
              data: { sequence: actualSequence }
            });
          }
        }

        newOrderNumber = `OD-${yearMonthStr}-${actualSequence.toString().padStart(3, '0')}`;
      }

      const updated = await tx.solarOrder.update({
        where: { id },
        data: {
          status: finalStatus,
          orderNumber: newOrderNumber,
          approvedById: status === 'APPROVED' ? session.userId : undefined,
          approvedAt: status === 'APPROVED' ? new Date() : undefined,
          rejectedById: status === 'REJECTED' ? session.userId : undefined,
          rejectedAt: status === 'REJECTED' ? new Date() : undefined,
          rejectionRemarks: status === 'REJECTED' ? remarks : undefined,
        }
      });

      let eventType = 'STATUS_CHANGED';
      if (status === 'APPROVED') eventType = 'ORDER_APPROVED';
      if (status === 'REJECTED') eventType = 'ORDER_REJECTED';

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: id,
          actorId: session.userId,
          actorName: session.name || 'Unknown User',
          eventType,
          description: status === 'REJECTED' ? `Order rejected: ${remarks}` : `Changed status from ${order.status} to ${finalStatus}${remarks ? ` (Remarks: ${remarks})` : ''}`,
        }
      });

      // Initialize workflow steps if transitioning to EXECUTION
      if (finalStatus === 'EXECUTION') {
        const existingDocs = await tx.solarWorkflowStep.count({ where: { solarOrderId: id, workflowType: 'DOCUMENTATION' } });
        if (existingDocs === 0) {
          await tx.solarWorkflowStep.createMany({
            data: DOCUMENTATION_STEPS.map((step, index) => ({
              solarOrderId: id,
              workflowType: 'DOCUMENTATION',
              stepKey: `DOC_${index + 1}`,
              stepIndex: index + 1,
              status: index === 0 ? 'PENDING' : 'BLOCKED',
              metadata: { name: step }
            }))
          });
        }

        const existingInstalls = await tx.solarWorkflowStep.count({ where: { solarOrderId: id, workflowType: 'INSTALLATION' } });
        if (existingInstalls === 0) {
          await tx.solarWorkflowStep.createMany({
            data: INSTALLATION_STEPS.map((step, index) => ({
              solarOrderId: id,
              workflowType: 'INSTALLATION',
              stepKey: `INST_${index + 1}`,
              stepIndex: index + 1,
              status: index === 0 ? 'PENDING' : 'BLOCKED',
              metadata: { name: step }
            }))
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ success: true, order: result });
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    if (error.name === 'PrismaClientValidationError') {
      return NextResponse.json({ error: 'Invalid ID or data format' }, { status: 400 });
    }
    console.error('[SolarOrders Status API Error]', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error', stack: error?.stack }, { status: 500 });
  }
}

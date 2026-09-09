import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { canOverrideDispatchWorkflow, dispatchForbiddenResponse } from '@/lib/dispatch-auth';
import { recordDispatchWorkflowHistory } from '@/lib/dispatch-history';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canOverrideDispatchWorkflow(session)) {
    return NextResponse.json(dispatchForbiddenResponse('Workflow Override / Reopen'), { status: 403 });
  }

  try {
    const { id } = await params;
    const { step } = await request.json();

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order || !order.preDispatchWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const wf = order.preDispatchWorkflow;

    if (wf.mappedInvoiceId) {
      const accessToken = await getZohoTokens();
      const orgId = getZohoOrgId();
      if (accessToken && orgId) {
        const getRes = await fetch(`${API_BASE_URL}/books/v3/invoices/${wf.mappedInvoiceId}?organization_id=${orgId}`, {
          headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        if (getRes.ok) {
          const json = await getRes.json();
          if (json.invoice && json.invoice.status === 'closed') {
            return NextResponse.json({ error: 'Cannot reopen because the mapped invoice is closed in Zoho Books.' }, { status: 400 });
          }
        }
      }
    }

    const updates: any = { overallStatus: 'IN_PROGRESS' };

    switch (step) {
      case 'rate-review':
        updates.rateReviewStatus = 'REOPENED';
        updates.currentStep = 1;
        break;
      case 'payment-verification':
        updates.paymentStatus = 'REOPENED';
        updates.currentStep = 2;
        break;
      case 'ready-for-invoice':
        updates.readyForInvoiceStatus = 'REOPENED';
        updates.currentStep = 3;
        break;
      case 'invoice-confirmation':
        updates.invoiceConfirmStatus = 'REOPENED';
        updates.currentStep = 4;
        break;
      default:
        return NextResponse.json({ error: 'Invalid step to reopen' }, { status: 400 });
    }

    const stepLabels: Record<string, string> = {
      'rate-review': 'Rate Review',
      'payment-verification': 'Payment Verification',
      'ready-for-invoice': 'Ready for Invoice',
      'invoice-confirmation': 'Invoice Confirmation',
    };

    const targetStepName = stepLabels[step] || step;

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.preDispatchWorkflow.update({
        where: { id: wf.id },
        data: updates
      });

      await recordDispatchWorkflowHistory(tx, {
        dispatchOrderId: id,
        userId: session.userId,
        userName: session.name,
        action: `Reopened ${targetStepName}`,
        fromStage: targetStepName,
        toStage: targetStepName,
        metadata: { step, reopenedAt: new Date().toISOString() }
      });

      return up;
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    console.error('[Workflow Reopen Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

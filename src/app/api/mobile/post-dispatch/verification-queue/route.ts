import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Post-Dispatch access required.' },
      { status: 403 }
    );
  }

  const currentUserId = session.userId || session.id;

  try {
    const awaitingWorkflows = await prisma.postDispatchWorkflow.findMany({
      where: {
        status: 'AWAITING_VERIFICATION',
        invoice: {
          erpStatus: 'Active',
        },
      },
      include: {
        invoice: true,
        submissions: {
          where: { status: 'AWAITING_VERIFICATION' },
          orderBy: { submissionNumber: 'desc' },
          take: 1,
          include: {
            files: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const receivingQueue = awaitingWorkflows.filter((w) => w.workflowType === 'RECEIVING');
    const checkedQueue = awaitingWorkflows.filter((w) => w.workflowType === 'CHECKED');

    return NextResponse.json({
      counts: {
        receiving: receivingQueue.length,
        checked: checkedQueue.length,
        total: awaitingWorkflows.length,
      },
      queue: awaitingWorkflows.map((w) => {
        const latestSub = w.submissions[0] || null;
        // User cannot self-verify if they uploaded the submission
        const isSelfUploader = latestSub?.uploadedByUserId === currentUserId;

        return {
          workflowId: w.id,
          workflowType: w.workflowType,
          status: w.status,
          invoiceId: w.invoice.id,
          invoiceNumber: w.invoice.invoiceNumber,
          customerName: w.invoice.customerName,
          total: w.invoice.total,
          submission: latestSub
            ? {
                id: latestSub.id,
                submissionNumber: latestSub.submissionNumber,
                receivingDetails: latestSub.receivingDetails,
                checkedBy: latestSub.checkedBy,
                checkedAt: latestSub.checkedAt,
                uploadedByUserId: latestSub.uploadedByUserId,
                uploadedByUserName: latestSub.uploadedByUserName,
                uploadedAt: latestSub.uploadedAt,
                files: latestSub.files,
                canVerify: !isSelfUploader,
              }
            : null,
        };
      }),
    });
  } catch (error: any) {
    console.error('[Verification Queue API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch verification queue' }, { status: 500 });
  }
}

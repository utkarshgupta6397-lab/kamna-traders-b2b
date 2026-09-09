import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canVerifySubmission } from '@/lib/post-dispatch-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';
import { checkAndArchiveInvoice } from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { submissionId } = await params;
  if (!submissionId) {
    return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 });
  }

  try {
    const submission = await prisma.postDispatchSubmission.findUnique({
      where: { id: submissionId },
      include: {
        workflow: {
          include: {
            invoice: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (submission.workflow.workflowType !== 'CHECKED') {
      return NextResponse.json({ error: 'Invalid workflow type for this endpoint' }, { status: 400 });
    }

    if (submission.workflow.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Workflow is already completed and cannot be modified.' },
        { status: 400 }
      );
    }

    // Verify permission & UPLOADER CANNOT SELF-VERIFY rule
    const verifyCheck = canVerifySubmission(
      session,
      submission.uploadedByUserId,
      'mobile_dispatch_post_dispatch_checked_verify'
    );

    if (!verifyCheck.allowed) {
      return NextResponse.json(
        { error: verifyCheck.error },
        { status: verifyCheck.statusCode || 403 }
      );
    }

    const body = await request.json();
    const action = String(body.action || '').toUpperCase();
    const comment = (body.comment || '').trim();

    const verifierUserId = session.userId || session.id;
    const verifierUserName = session.name || 'Verifier';
    const invoiceId = submission.workflow.invoice.id;

    if (action === 'APPROVE') {
      await prisma.$transaction(async (tx) => {
        await tx.postDispatchSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'APPROVED',
            verifiedByUserId: verifierUserId,
            verifiedByUserName: verifierUserName,
            verifiedAt: new Date(),
          },
        });

        await tx.postDispatchWorkflow.update({
          where: { id: submission.workflow.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        await recordPostDispatchHistory(tx, {
          invoiceId,
          workflowType: 'CHECKED',
          eventType: 'CHECKED_APPROVED',
          userId: verifierUserId,
          userName: verifierUserName,
          submissionId: submission.id,
          metadata: {
            checkedBy: submission.checkedBy,
            checkedAt: submission.checkedAt?.toISOString(),
            comment: comment || null,
          },
        });

        await checkAndArchiveInvoice(invoiceId, tx);
      });

      return NextResponse.json({
        success: true,
        message: 'Checked evidence approved and workflow completed.',
        status: 'COMPLETED',
      });
    } else if (action === 'REJECT') {
      if (!comment) {
        return NextResponse.json(
          { error: 'A rejection comment is required explaining why rework is needed.' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.postDispatchSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'REJECTED',
            rejectionComment: comment,
            verifiedByUserId: verifierUserId,
            verifiedByUserName: verifierUserName,
            verifiedAt: new Date(),
          },
        });

        await tx.postDispatchWorkflow.update({
          where: { id: submission.workflow.id },
          data: {
            status: 'REWORK_REQUIRED',
          },
        });

        await recordPostDispatchHistory(tx, {
          invoiceId,
          workflowType: 'CHECKED',
          eventType: 'CHECKED_REJECTED',
          userId: verifierUserId,
          userName: verifierUserName,
          submissionId: submission.id,
          rejectionReason: comment,
          metadata: {
            rejectionComment: comment,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Checked evidence rejected and marked for rework.',
        status: 'REWORK_REQUIRED',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid verification action. Must be APPROVE or REJECT.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[Checked Verify API] Error:', error);
    return NextResponse.json(
      { error: 'Unable to update verification status.' },
      { status: 500 }
    );
  }
}

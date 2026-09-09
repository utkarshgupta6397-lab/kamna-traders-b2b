import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchPermission } from '@/lib/post-dispatch-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission check: mobile_dispatch -> mobile_dispatch_post_dispatch -> mobile_dispatch_post_dispatch_checked_upload
  if (!hasPostDispatchPermission(session, 'mobile_dispatch_post_dispatch_checked_upload')) {
    return NextResponse.json(
      { error: 'Forbidden. Checked By Upload permission required.' },
      { status: 403 }
    );
  }

  const { invoiceId } = await params;
  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
  }

  try {
    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        workflows: {
          where: { workflowType: 'CHECKED' },
          include: {
            submissions: {
              orderBy: { submissionNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.erpSubStatus === 'Void' || invoice.zohoStatus.toLowerCase() === 'void') {
      return NextResponse.json(
        { error: 'Cannot upload evidence for a Void invoice.' },
        { status: 400 }
      );
    }

    if (invoice.zohoStatus.toLowerCase() === 'draft') {
      return NextResponse.json(
        { error: 'Draft invoices are not actionable in Post Dispatch. Invoice must be Sent in Zoho.' },
        { status: 400 }
      );
    }

    const checkedWorkflow = invoice.workflows[0];
    if (!checkedWorkflow) {
      return NextResponse.json({ error: 'Checked workflow not found for this invoice' }, { status: 404 });
    }

    if (checkedWorkflow.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Checked workflow is already completed and locked.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const checkedBy = (formData.get('checkedBy') as string | null) || '';
    const checkedAtStr = (formData.get('checkedAt') as string | null) || '';
    const files = formData.getAll('files') as File[];

    if (!checkedBy.trim()) {
      return NextResponse.json(
        { error: 'Checked By name is required.' },
        { status: 400 }
      );
    }

    if (!checkedAtStr.trim()) {
      return NextResponse.json(
        { error: 'Checked At timestamp is required.' },
        { status: 400 }
      );
    }

    const checkedAtDate = new Date(checkedAtStr);
    if (isNaN(checkedAtDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid Checked At timestamp.' },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'At least one photo is required for checked evidence upload.' },
        { status: 400 }
      );
    }

    const lastSub = checkedWorkflow.submissions[0];
    const nextSubNumber = lastSub ? lastSub.submissionNumber + 1 : 1;
    const isReUpload = nextSubNumber > 1;

    const uploaderUserId = session.userId || session.id;
    const uploaderUserName = session.name || 'Warehouse Staff';

    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.postDispatchSubmission.create({
        data: {
          workflowId: checkedWorkflow.id,
          submissionNumber: nextSubNumber,
          status: 'AWAITING_VERIFICATION',
          checkedBy: checkedBy.trim(),
          checkedAt: checkedAtDate,
          uploadedByUserId: uploaderUserId,
          uploadedByUserName: uploaderUserName,
          uploadedAt: new Date(),
        },
      });

      const storageDir = path.join(
        process.cwd(),
        'storage',
        'post-dispatch',
        'checked',
        invoiceId,
        submission.id
      );
      await mkdir(storageDir, { recursive: true });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const ext = path.extname(file.name) || '.jpg';
        const safeFilename = `photo_${i + 1}_${Date.now()}${ext}`;
        const filePath = path.join(storageDir, safeFilename);

        await writeFile(filePath, buffer);

        await tx.postDispatchFile.create({
          data: {
            submissionId: submission.id,
            fileName: file.name || safeFilename,
            filePath,
            mimeType: file.type || 'image/jpeg',
            sizeBytes: buffer.length,
            uploadedAt: new Date(),
          },
        });
      }

      await tx.postDispatchWorkflow.update({
        where: { id: checkedWorkflow.id },
        data: {
          status: 'AWAITING_VERIFICATION',
          currentSubmissionId: submission.id,
        },
      });

      await recordPostDispatchHistory(tx, {
        invoiceId,
        workflowType: 'CHECKED',
        eventType: isReUpload ? 'CHECKED_RE_UPLOADED' : 'CHECKED_UPLOADED',
        userId: uploaderUserId,
        userName: uploaderUserName,
        submissionId: submission.id,
        metadata: {
          submissionNumber: nextSubNumber,
          checkedBy: checkedBy.trim(),
          checkedAt: checkedAtDate.toISOString(),
          uploader: uploaderUserName,
          photoCount: files.length,
        },
      });

      return submission;
    });

    return NextResponse.json({
      success: true,
      message: 'Checked evidence submitted successfully and awaiting verification.',
      submissionId: result.id,
      status: 'AWAITING_VERIFICATION',
    });
  } catch (error: any) {
    console.error('[Checked Upload API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Photo could not be uploaded. Please try again.' },
      { status: 500 }
    );
  }
}

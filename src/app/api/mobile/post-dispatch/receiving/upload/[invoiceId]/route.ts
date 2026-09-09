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

  // Permission check: mobile_dispatch -> mobile_dispatch_post_dispatch -> mobile_dispatch_post_dispatch_receiving_upload
  if (!hasPostDispatchPermission(session, 'mobile_dispatch_post_dispatch_receiving_upload')) {
    return NextResponse.json(
      { error: 'Forbidden. Receiving Upload permission required.' },
      { status: 403 }
    );
  }

  const { invoiceId } = await params;
  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
  }

  try {
    // 1. Fetch invoice and receiving workflow
    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        workflows: {
          where: { workflowType: 'RECEIVING' },
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

    // Business rule: Void invoice has no actions
    if (invoice.erpSubStatus === 'Void' || invoice.zohoStatus.toLowerCase() === 'void') {
      return NextResponse.json(
        { error: 'Cannot upload evidence for a Void invoice.' },
        { status: 400 }
      );
    }

    // Business rule: Invoice status = Draft -> NOT actionable in POST DISPATCH
    if (invoice.zohoStatus.toLowerCase() === 'draft') {
      return NextResponse.json(
        { error: 'Draft invoices are not actionable in Post Dispatch. Invoice must be Sent in Zoho.' },
        { status: 400 }
      );
    }

    const receivingWorkflow = invoice.workflows[0];
    if (!receivingWorkflow) {
      return NextResponse.json({ error: 'Receiving workflow not found for this invoice' }, { status: 404 });
    }

    // If already COMPLETED, immutable - cannot re-upload
    if (receivingWorkflow.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Receiving workflow is already completed and locked.' },
        { status: 400 }
      );
    }

    // 2. Parse multipart form data
    const formData = await request.formData();
    const receivingDetails = (formData.get('receivingDetails') as string | null) || '';
    const files = formData.getAll('files') as File[];

    // Rule: At least ONE photo is required
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'At least one photo is required for receiving upload.' },
        { status: 400 }
      );
    }

    // Next submission number
    const lastSub = receivingWorkflow.submissions[0];
    const nextSubNumber = lastSub ? lastSub.submissionNumber + 1 : 1;
    const isReUpload = nextSubNumber > 1;

    const uploaderUserId = session.userId || session.id;
    const uploaderUserName = session.name || 'Warehouse Staff';

    // 3. Create submission in DB and store files permanently
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.postDispatchSubmission.create({
        data: {
          workflowId: receivingWorkflow.id,
          submissionNumber: nextSubNumber,
          status: 'AWAITING_VERIFICATION',
          receivingDetails: receivingDetails.trim() || null,
          uploadedByUserId: uploaderUserId,
          uploadedByUserName: uploaderUserName,
          uploadedAt: new Date(),
        },
      });

      // Storage directory: storage/post-dispatch/receiving/[invoiceId]/[submissionId]
      const storageDir = path.join(
        process.cwd(),
        'storage',
        'post-dispatch',
        'receiving',
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

      // Update workflow status to AWAITING_VERIFICATION
      await tx.postDispatchWorkflow.update({
        where: { id: receivingWorkflow.id },
        data: {
          status: 'AWAITING_VERIFICATION',
          currentSubmissionId: submission.id,
        },
      });

      // Record history
      await recordPostDispatchHistory(tx, {
        invoiceId,
        workflowType: 'RECEIVING',
        eventType: isReUpload ? 'RECEIVING_RE_UPLOADED' : 'RECEIVING_UPLOADED',
        userId: uploaderUserId,
        userName: uploaderUserName,
        submissionId: submission.id,
        metadata: {
          submissionNumber: nextSubNumber,
          photoCount: files.length,
          receivingDetails: receivingDetails.trim() || null,
        },
      });

      return submission;
    });

    return NextResponse.json({
      success: true,
      message: 'Receiving evidence submitted successfully and awaiting verification.',
      submissionId: result.id,
      status: 'AWAITING_VERIFICATION',
    });
  } catch (error: any) {
    console.error('[Receiving Upload API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Photo could not be uploaded. Please try again.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasDesktopPostDispatchReviewAccess, hasPostDispatchAccess } from '@/lib/post-dispatch-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasDesktopPostDispatchReviewAccess(session) && !hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Post-Dispatch Review access required.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
  }

  try {
    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id },
      include: {
        lines: true,
        workflows: {
          include: {
            submissions: {
              include: {
                files: true,
              },
              orderBy: { submissionNumber: 'desc' },
            },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const now = new Date();
    const startTime = new Date(invoice.zohoCreatedTime).getTime();
    const endTime = invoice.timerStoppedAt ? new Date(invoice.timerStoppedAt).getTime() : now.getTime();
    const elapsedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

    const isActionable = invoice.zohoStatus.toLowerCase() === 'sent' && invoice.erpStatus === 'Active';
    const isVoid = invoice.erpSubStatus === 'Void' || invoice.zohoStatus.toLowerCase() === 'void';

    const detailsJson = invoice.zohoDetailsJson as any;
    let gstin: string | null = null;
    if (detailsJson?.gst_no && String(detailsJson.gst_no).trim()) {
      gstin = String(detailsJson.gst_no).trim();
    } else if (detailsJson?.shipping_gst_no && String(detailsJson.shipping_gst_no).trim()) {
      gstin = String(detailsJson.shipping_gst_no).trim();
    } else if (invoice.customerId) {
      const localCust = await (prisma as any).customer.findUnique({
        where: { id: invoice.customerId },
        select: { gstNumber: true },
      });
      if (localCust?.gstNumber && localCust.gstNumber !== 'NOT_AVAILABLE') {
        gstin = localCust.gstNumber;
      }
    }

    const warehouseName = (detailsJson?.location_name as string) || null;
    const isConsumer = detailsJson?.gst_treatment
      ? ['consumer', 'unregistered'].includes(String(detailsJson.gst_treatment).toLowerCase().trim())
      : false;

    const currentUserId = session.userId || session.id;

    return NextResponse.json({
      invoice: {
        ...invoice,
        gstin,
        warehouseName,
        isConsumer,
        isActionable,
        isVoid,
        elapsedSeconds,
        currentUserId,
      },
    });
  } catch (error: any) {
    console.error('[PostDispatch Invoice Detail API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice details' }, { status: 500 });
  }
}

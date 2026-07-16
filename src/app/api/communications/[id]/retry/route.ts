import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.communications_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await props.params;

    const communication = await prisma.communication.findUnique({
      where: { id },
    });

    if (!communication) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    if (communication.status !== 'FAILED') {
      return NextResponse.json({ error: 'Only failed communications can be retried' }, { status: 400 });
    }

    // Reset status to QUEUED and increment retry count
    const updatedCommunication = await prisma.communication.update({
      where: { id },
      data: {
        status: 'QUEUED',
        retryCount: { increment: 1 },
        errorMessage: null,
      },
    });

    // In a real system, you would trigger the background worker/queue here.
    // For now, setting it to QUEUED handles the requirement as outlined in the plan.

    return NextResponse.json({ success: true, communication: updatedCommunication });
  } catch (error: any) {
    console.error('[API_COMMUNICATIONS_RETRY_POST]', error);
    return NextResponse.json({ error: 'Failed to retry communication' }, { status: 500 });
  }
}

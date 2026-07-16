import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CommunicationService } from '@/lib/services/CommunicationService';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.communications_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const communication = await prisma.communication.findUnique({
      where: { id },
      include: {
        attachments: true,
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      }
    });

    if (!communication) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ communication });
  } catch (error: any) {
    console.error('[API_COMMUNICATIONS_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.communications_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.status) {
       await CommunicationService.updateStatus(id, body.status, body.errorMessage, body.providerMessageId);
    }

    const updated = await prisma.communication.findUnique({ where: { id } });
    return NextResponse.json({ communication: updated });
  } catch (error: any) {
    console.error('[API_COMMUNICATIONS_PATCH]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.communications_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await prisma.communication.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API_COMMUNICATIONS_DELETE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

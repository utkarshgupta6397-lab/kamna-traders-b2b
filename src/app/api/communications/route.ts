import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CommunicationService } from '@/lib/services/CommunicationService';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.communications_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const channel = searchParams.get('channel');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (type) where.type = type;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const communications = await prisma.communication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      }
    });

    return NextResponse.json({ communications });
  } catch (error: any) {
    console.error('[API_COMMUNICATIONS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch communications' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.communications_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    // Validate required fields
    if (!body.customerId || !body.channel || !body.direction || !body.type || !body.body) {
       return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newCommunication = await CommunicationService.createCommunication({
      ...body,
      createdById: session.userId,
    });

    return NextResponse.json({ communication: newCommunication }, { status: 201 });
  } catch (error: any) {
    console.error('[API_COMMUNICATIONS_POST]', error);
    return NextResponse.json({ error: 'Failed to create communication' }, { status: 500 });
  }
}

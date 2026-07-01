import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const messages = await prisma.projectChatMessage.findMany({
      where: {
        solarOrderId: id,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        createdBy: {
          select: {
            name: true,
          }
        }
      }
    });

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error('[ProjectChat GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { message } = body;

    const trimmedMessage = message?.trim();

    if (!trimmedMessage) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    if (trimmedMessage.length > 2000) {
      return NextResponse.json({ error: 'Message cannot exceed 2000 characters' }, { status: 400 });
    }

    // Verify order exists
    const order = await prisma.solarOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const newMessage = await prisma.projectChatMessage.create({
      data: {
        solarOrderId: id,
        message: trimmedMessage,
        createdById: session.userId,
      },
      include: {
        createdBy: {
          select: {
            name: true,
          }
        }
      }
    });

    // Create Audit Log
    await prisma.solarActivityLog.create({
      data: {
        solarOrderId: id,
        eventType: 'PROJECT_CHAT_MESSAGE',
        actorId: session.userId,
        actorName: session.name,
        description: `${session.name} posted a project message.`
      }
    });

    return NextResponse.json({ message: newMessage });
  } catch (err: any) {
    console.error('[ProjectChat POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

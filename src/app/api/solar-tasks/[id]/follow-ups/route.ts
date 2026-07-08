import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: taskId } = await context.params;
    const body = await req.json();

    const { comment } = body;

    if (!comment || comment.trim() === '') {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    const newFollowUp = await prisma.$transaction(async (tx) => {
      const followUp = await tx.solarTaskFollowUp.create({
        data: {
          taskId,
          userId: session.userId,
          comment,
        },
        include: {
          user: { select: { id: true, name: true } }
        }
      });

      await tx.solarTask.update({
        where: { id: taskId },
        data: {
          latestUpdate: comment.substring(0, 100) + (comment.length > 100 ? '...' : '')
        }
      });

      return followUp;
    });

    return NextResponse.json({ followUp: newFollowUp }, { status: 201 });
  } catch (error) {
    console.error('Error adding task follow-up:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

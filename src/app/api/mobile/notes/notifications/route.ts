import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext } from '@/lib/notes-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [unreadCount, notifications] = await Promise.all([
      prisma.notification.count({
        where: {
          userId: auth.userId,
          isRead: false,
        },
      }),
      prisma.notification.findMany({
        where: {
          userId: auth.userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (error: any) {
    console.error('[Notes Notifications API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { notificationIds, markAllRead } = body;

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userId: auth.userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
    } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: auth.userId,
        },
        data: {
          isRead: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Mark Notifications Read API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext } from '@/lib/notes-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView || !auth.canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim().toLowerCase() || '';

    const users = await prisma.user.findMany({
      where: {
        active: true,
        id: { not: auth.userId },
        OR: [
          { role: 'ADMIN' },
          { mobile_notes_view: true },
        ],
        ...(query
          ? {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error('[Notes Eligible Users API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

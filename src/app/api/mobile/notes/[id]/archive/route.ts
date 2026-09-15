import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext, isUserAuthorizedForNote } from '@/lib/notes-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView || !auth.canArchive) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const shouldArchive = body.unarchive ? false : true;

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        shares: { select: { userId: true } },
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!isUserAuthorizedForNote(auth.userId, note)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.note.update({
        where: { id },
        data: {
          isArchived: shouldArchive,
          archivedAt: shouldArchive ? new Date() : null,
          archivedById: shouldArchive ? auth.userId : null,
        },
      });

      await tx.noteAuditLog.create({
        data: {
          noteId: id,
          userId: auth.userId,
          action: shouldArchive ? 'ARCHIVED' : 'UNARCHIVED',
          details: JSON.stringify({
            archivedAt: new Date().toISOString(),
          }),
        },
      });

      return res;
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('[Archive Note API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

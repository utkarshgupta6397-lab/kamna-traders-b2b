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

  if (!auth || !auth.canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

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

    // Check current pin status for this user
    const existingPin = await prisma.notePin.findUnique({
      where: {
        noteId_userId: {
          noteId: id,
          userId: auth.userId,
        },
      },
    });

    let isPinned = false;

    if (existingPin) {
      // Unpin
      await prisma.notePin.delete({
        where: { id: existingPin.id },
      });
      isPinned = false;
    } else {
      // Pin
      await prisma.notePin.create({
        data: {
          noteId: id,
          userId: auth.userId,
        },
      });
      isPinned = true;
    }

    return NextResponse.json({
      success: true,
      noteId: id,
      isPinned,
    });
  } catch (error: any) {
    console.error('[Pin Note API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

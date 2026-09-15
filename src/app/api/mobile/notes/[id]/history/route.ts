import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext, isUserAuthorizedForNote } from '@/lib/notes-auth';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const versions = await prisma.noteVersion.findMany({
      where: { noteId: id },
      include: {
        editedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });

    return NextResponse.json({
      success: true,
      currentVersionNumber: note.version,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        isCurrent: v.versionNumber === note.version,
        title: v.title,
        noteType: v.noteType,
        color: v.color,
        editedById: v.editedById,
        editedByName: v.editedBy.name,
        editedAt: v.editedAt,
      })),
    });
  } catch (error: any) {
    console.error('[Note History API]', error);
    return NextResponse.json({ error: 'Couldn\'t load version history.' }, { status: 500 });
  }
}

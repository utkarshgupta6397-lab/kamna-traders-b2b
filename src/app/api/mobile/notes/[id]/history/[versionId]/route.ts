import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext, isUserAuthorizedForNote } from '@/lib/notes-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id, versionId } = await params;

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

    // Try finding by cuid id, or if integer by versionNumber
    let version: any = null;
    const asNumber = parseInt(versionId, 10);
    if (!isNaN(asNumber) && String(asNumber) === versionId) {
      version = await prisma.noteVersion.findUnique({
        where: {
          noteId_versionNumber: {
            noteId: id,
            versionNumber: asNumber,
          },
        },
        include: {
          editedBy: { select: { id: true, name: true, role: true } },
        },
      });
    } else {
      version = await prisma.noteVersion.findUnique({
        where: { id: versionId },
        include: {
          editedBy: { select: { id: true, name: true, role: true } },
        },
      });
    }

    if (!version || version.noteId !== id) {
      return NextResponse.json({ error: 'Historical version not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: version.id,
        noteId: version.noteId,
        versionNumber: version.versionNumber,
        isCurrent: version.versionNumber === note.version,
        title: version.title,
        noteType: version.noteType,
        content: version.content,
        checklistItems: version.checklistItems || [],
        color: version.color,
        visibility: version.visibility,
        editedById: version.editedById,
        editedByName: version.editedBy.name,
        editedAt: version.editedAt,
      },
    });
  } catch (error: any) {
    console.error('[Historical Version API]', error);
    return NextResponse.json({ error: 'Couldn\'t load version details.' }, { status: 500 });
  }
}

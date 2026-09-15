import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { isUserAuthorizedForNote } from '@/lib/notes-auth';
import NoteVersionDetailClient from '@/components/mobile/notes/NoteVersionDetailClient';

export const dynamic = 'force-dynamic';

export default async function NoteVersionDetailPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  if (!hasMobilePermission(session, 'mobile_notes_view')) {
    redirect('/mobile');
  }

  const { id, versionId } = await params;
  const currentUserId = (session.userId as string) || '';

  const note = await prisma.note.findUnique({
    where: { id },
    include: {
      shares: { select: { userId: true } },
    },
  });

  if (!note || !isUserAuthorizedForNote(currentUserId, note)) {
    redirect('/mobile/notes');
  }

  // Version might be a numeric versionNumber or cuid id
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
        editedBy: { select: { id: true, name: true } },
      },
    });
  } else {
    version = await prisma.noteVersion.findUnique({
      where: { id: versionId },
      include: {
        editedBy: { select: { id: true, name: true } },
      },
    });
  }

  if (!version || version.noteId !== id) {
    redirect(`/mobile/notes/${id}/history`);
  }

  const formattedVersion = {
    id: version.id,
    noteId: version.noteId,
    versionNumber: version.versionNumber,
    isCurrent: version.versionNumber === note.version,
    title: version.title,
    noteType: version.noteType,
    content: version.content,
    checklistItems: version.checklistItems,
    color: version.color,
    visibility: version.visibility,
    editedById: version.editedById,
    editedByName: version.editedBy.name,
    editedAt: version.editedAt.toISOString(),
  };

  return <NoteVersionDetailClient version={formattedVersion} />;
}

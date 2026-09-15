import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { isUserAuthorizedForNote } from '@/lib/notes-auth';
import NoteDetailClient from '@/components/mobile/notes/NoteDetailClient';

export const dynamic = 'force-dynamic';

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  if (!hasMobilePermission(session, 'mobile_notes_view')) {
    redirect('/mobile');
  }

  const { id } = await params;
  const currentUserId = (session.userId as string) || '';

  const note = await prisma.note.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      updatedBy: { select: { id: true, name: true, role: true } },
      archivedBy: { select: { id: true, name: true } },
      shares: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      pins: {
        where: { userId: currentUserId },
        select: { id: true },
      },
    },
  });

  if (!note || !isUserAuthorizedForNote(currentUserId, note)) {
    redirect('/mobile/notes');
  }

  const permissions = {
    canView: hasMobilePermission(session, 'mobile_notes_view'),
    canCreate: hasMobilePermission(session, 'mobile_notes_create'),
    canEdit: hasMobilePermission(session, 'mobile_notes_edit'),
    canArchive: hasMobilePermission(session, 'mobile_notes_archive'),
  };

  const formattedNote = {
    id: note.id,
    title: note.title,
    noteType: note.noteType,
    content: note.content,
    checklistItems: note.checklistItems,
    color: note.color,
    visibility: note.visibility,
    isArchived: note.isArchived,
    archivedAt: note.archivedAt?.toISOString() || null,
    archivedByName: note.archivedBy?.name || null,
    version: note.version,
    isPinned: note.pins.length > 0 && !note.isArchived,
    createdById: note.createdById,
    createdByName: note.createdBy.name,
    createdAt: note.createdAt.toISOString(),
    updatedById: note.updatedById,
    updatedByName: note.updatedBy.name,
    updatedAt: note.updatedAt.toISOString(),
    shares: note.shares.map((s) => ({
      userId: s.userId,
      name: s.user.name,
    })),
  };

  return (
    <NoteDetailClient
      note={formattedNote}
      permissions={permissions}
      currentUserId={currentUserId}
    />
  );
}

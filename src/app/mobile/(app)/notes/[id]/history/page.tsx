import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { isUserAuthorizedForNote } from '@/lib/notes-auth';
import NoteHistoryClient from '@/components/mobile/notes/NoteHistoryClient';

export const dynamic = 'force-dynamic';

export default async function NoteHistoryPage({
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
      shares: { select: { userId: true } },
    },
  });

  if (!note || !isUserAuthorizedForNote(currentUserId, note)) {
    redirect('/mobile/notes');
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

  const formattedVersions = versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    isCurrent: v.versionNumber === note.version,
    title: v.title,
    noteType: v.noteType,
    color: v.color,
    editedById: v.editedById,
    editedByName: v.editedBy.name,
    editedAt: v.editedAt.toISOString(),
  }));

  return (
    <NoteHistoryClient
      noteId={note.id}
      versions={formattedVersions}
      currentVersionNumber={note.version}
    />
  );
}

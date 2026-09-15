import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { isUserAuthorizedForNote } from '@/lib/notes-auth';
import NoteFormClient from '@/components/mobile/notes/NoteFormClient';

export const dynamic = 'force-dynamic';

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  if (!hasMobilePermission(session, 'mobile_notes_view') || !hasMobilePermission(session, 'mobile_notes_edit')) {
    redirect('/mobile/notes');
  }

  const { id } = await params;
  const currentUserId = (session.userId as string) || '';

  const note = await prisma.note.findUnique({
    where: { id },
    include: {
      shares: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!note || !isUserAuthorizedForNote(currentUserId, note)) {
    redirect('/mobile/notes');
  }

  if (note.isArchived) {
    redirect(`/mobile/notes/${note.id}`);
  }

  const initialData = {
    id: note.id,
    title: note.title,
    noteType: note.noteType,
    content: note.content || '',
    checklistItems: Array.isArray(note.checklistItems) ? (note.checklistItems as any) : [],
    color: note.color,
    visibility: note.visibility,
    version: note.version,
    shares: note.shares.map((s) => ({
      userId: s.userId,
      name: s.user.name,
    })),
  };

  return <NoteFormClient mode="edit" initialData={initialData} />;
}

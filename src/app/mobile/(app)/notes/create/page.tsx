import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { getRandomNoteColor } from '@/lib/notes-colors';
import NoteFormClient from '@/components/mobile/notes/NoteFormClient';

export const dynamic = 'force-dynamic';

export default async function CreateNotePage() {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  if (!hasMobilePermission(session, 'mobile_notes_view') || !hasMobilePermission(session, 'mobile_notes_create')) {
    redirect('/mobile/notes');
  }

  const userId = (session.userId as string) || '';
  const latestNote = await prisma.note.findFirst({
    where: { createdById: userId },
    orderBy: { createdAt: 'desc' },
    select: { color: true },
  });

  const randomColor = getRandomNoteColor(latestNote?.color);

  return <NoteFormClient mode="create" initialData={{ color: randomColor.id }} />;
}

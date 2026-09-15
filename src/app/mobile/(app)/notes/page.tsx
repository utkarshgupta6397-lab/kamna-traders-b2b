import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasMobilePermission } from '@/lib/mobile-auth';
import NotesListingClient from '@/components/mobile/notes/NotesListingClient';

export const dynamic = 'force-dynamic';

export default async function MobileNotesPage() {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  if (!hasMobilePermission(session, 'mobile_notes_view')) {
    redirect('/mobile');
  }

  const permissions = {
    canView: hasMobilePermission(session, 'mobile_notes_view'),
    canCreate: hasMobilePermission(session, 'mobile_notes_create'),
    canEdit: hasMobilePermission(session, 'mobile_notes_edit'),
    canArchive: hasMobilePermission(session, 'mobile_notes_archive'),
  };

  const currentUser = {
    id: (session.userId as string) || '',
    name: (session.name as string) || 'Staff',
  };

  return <NotesListingClient permissions={permissions} currentUser={currentUser} />;
}

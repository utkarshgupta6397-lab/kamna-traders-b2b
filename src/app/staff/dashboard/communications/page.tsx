import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CommunicationsClient from './CommunicationsClient';

export default async function CommunicationsPage() {
  const session = await getSession();

  if (!session || !session.communications_view) {
    redirect('/unauthorized');
  }

  return <CommunicationsClient hasTemplatePermission={session.communications_templates} />;
}

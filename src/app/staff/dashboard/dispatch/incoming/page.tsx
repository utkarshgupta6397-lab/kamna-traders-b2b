import IncomingQueueClient from './IncomingQueueClient';
import { Metadata } from 'next';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Incoming Orders | Dispatch | KAMNA ERP',
};

export default async function IncomingQueuePage() {
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  const permissions = {
    isAdmin,
    canForceArchive: isAdmin || Boolean(session?.dispatch_force_archive),
  };

  return <IncomingQueueClient permissions={permissions} />;
}

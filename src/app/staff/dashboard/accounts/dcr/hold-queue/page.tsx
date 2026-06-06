import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HoldQueueClient from './HoldQueueClient';

export const dynamic = 'force-dynamic';

export default async function HoldQueuePage() {
  const session = await getSession();

  if (!session || (!session.dcr_hold_release && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard/accounts/dcr?error=unauthorized');
  }

  return <HoldQueueClient />;
}

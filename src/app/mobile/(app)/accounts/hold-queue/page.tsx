import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MobileHoldQueueClient from './MobileHoldQueueClient';

export const dynamic = 'force-dynamic';

export default async function MobileHoldQueuePage() {
  const session = await getSession();

  if (!session || (!session.dcr_hold_release && session.role !== 'ADMIN')) {
    redirect('/mobile/accounts?error=unauthorized');
  }

  return <MobileHoldQueueClient />;
}

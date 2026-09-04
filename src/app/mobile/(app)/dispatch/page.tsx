import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MobileDispatchClient from './MobileDispatchClient';

export default async function MobileDispatchPage() {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  return <MobileDispatchClient />;
}

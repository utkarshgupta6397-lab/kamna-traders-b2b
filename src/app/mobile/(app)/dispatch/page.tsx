import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MobileDispatchClient from './MobileDispatchClient';
import { hasMobilePermission } from '@/lib/mobile-auth';

export default async function MobileDispatchPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (!hasMobilePermission(session, 'mobile_dispatch')) {
    redirect('/mobile');
  }

  return <MobileDispatchClient />;
}

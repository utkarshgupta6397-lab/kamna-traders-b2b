import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MobileDispatchClient from './MobileDispatchClient';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { hasMobilePostDispatchAccess, hasPostDispatchPermission } from '@/lib/post-dispatch-auth';

export default async function MobileDispatchPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (!hasMobilePermission(session, 'mobile_dispatch')) {
    redirect('/mobile');
  }

  const permissions = {
    canPostDispatch: hasMobilePostDispatchAccess(session),
    canReceivingUpload: hasPostDispatchPermission(session, 'mobile_dispatch_post_dispatch_receiving_upload'),
    canCheckedUpload: hasPostDispatchPermission(session, 'mobile_dispatch_post_dispatch_checked_upload'),
  };

  const user = {
    id: (session.userId as string) || (session.id as string) || '',
    name: (session.name as string) || 'Staff',
  };

  return <MobileDispatchClient permissions={permissions} user={user} />;
}

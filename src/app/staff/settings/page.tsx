import SettingsPageClient from '@/components/SettingsPageClient';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/staff');
  }

  const permissions = {
    canManageZoneMappings: !!session.canManageZoneMappings || session.role === 'ADMIN',
    canManageUnlimitedSkus: !!session.canManageUnlimitedSkus || session.role === 'ADMIN',
  };

  return <SettingsPageClient permissions={permissions} />;
}

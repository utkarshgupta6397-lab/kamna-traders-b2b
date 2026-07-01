import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SolarOrdersTabs from './SolarOrdersTabs';

export default async function SolarOrdersLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff/dashboard?error=unauthorized_solar_orders');
  }

  if (!session.solar_orders_view) {
    redirect('/staff/dashboard?error=unauthorized_solar_orders');
  }

  const isAdmin = session.role === 'ADMIN';
  const isStaff = session.role === 'STAFF';
  const canViewOrders = isAdmin || !!session.solar_orders_view;
  const canViewDocQueue = isAdmin || isStaff || !!session.solar_documentation_view;
  const canViewInstallQueue = isAdmin || !!session.solar_installation_view;

  return (
    <SolarOrdersTabs
      canViewOrders={canViewOrders}
      canViewDocQueue={canViewDocQueue}
      canViewInstallQueue={canViewInstallQueue}
    >
      {children}
    </SolarOrdersTabs>
  );
}

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import InstallationDashboardClient from './InstallationDashboardClient';

export default async function InstallationDashboard() {
  const session = await getSession();

  const isAdmin = session?.role === 'ADMIN';
  const isStaff = session?.role === 'STAFF';
  const canViewInstallQueue = isAdmin || isStaff || !!session?.solar_installation_view;

  if (!canViewInstallQueue) {
    redirect('/staff/dashboard/solar-orders');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-teal-800">Installation</h1>
          <p className="text-sm text-gray-500">Track and manage physical execution and installation progress for all solar orders.</p>
        </div>
      </div>

      <InstallationDashboardClient />
    </div>
  );
}

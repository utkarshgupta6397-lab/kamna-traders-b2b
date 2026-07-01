import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DocumentationDashboardClient from './DocumentationDashboardClient';

export default async function DocumentationDashboard() {
  const session = await getSession();

  const isAdmin = session?.role === 'ADMIN';
  const isStaff = session?.role === 'STAFF';
  const canViewDocQueue = isAdmin || isStaff || !!session?.solar_documentation_view;

  if (!canViewDocQueue) {
    redirect('/staff/dashboard/solar-orders');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2766]">Documentation</h1>
          <p className="text-sm text-gray-500">Track and manage documentation progress for all solar orders.</p>
        </div>
      </div>

      <DocumentationDashboardClient />
    </div>
  );
}

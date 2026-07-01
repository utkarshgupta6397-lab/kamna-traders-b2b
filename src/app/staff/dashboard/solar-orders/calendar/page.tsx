import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CalendarPageClient from './CalendarPageClient';

export default async function CalendarPage() {
  const session = await getSession();

  const isAdmin = session?.role === 'ADMIN';
  const isStaff = session?.role === 'STAFF';
  const canView = isAdmin || isStaff || !!session?.solar_installation_view;

  if (!canView) {
    redirect('/staff/dashboard/solar-orders');
  }

  const canEdit = isAdmin || isStaff || !!session?.solar_installation_view;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-teal-800">Installation Calendar</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Drag and drop orders onto dates to schedule installations.
        </p>
      </div>
      <CalendarPageClient canEdit={canEdit} />
    </div>
  );
}

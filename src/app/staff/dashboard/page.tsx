import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function StaffDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard');
  }

  // Pass session permissions to DashboardClient for section access gating
  return <DashboardClient userName={session.name} session={session} />;
}

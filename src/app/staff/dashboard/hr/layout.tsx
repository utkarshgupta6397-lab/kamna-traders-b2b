import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HrTabs from './HrTabs';

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Fhr');
  }

  const isAdmin = session.role === 'ADMIN';
  const canAccessAttendance = isAdmin || Boolean(session.hr_attendance_processor);

  if (!canAccessAttendance) {
    redirect('/staff/dashboard?error=unauthorized_hr');
  }

  return <HrTabs>{children}</HrTabs>;
}

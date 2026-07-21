import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ReportsSidebar from './ReportsSidebar';

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || (session.role !== 'ADMIN' && !session.accounts_reports_salesman)) {
    redirect('/staff/dashboard?error=unauthorized');
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] w-full border border-gray-200 bg-white shadow-sm overflow-hidden mt-4">
      {/* Sidebar - Fixed 280px */}
      <ReportsSidebar />
      
      {/* Content Area */}
      <div className="flex-1 bg-[#f8f9fc]">
        {children}
      </div>
    </div>
  );
}

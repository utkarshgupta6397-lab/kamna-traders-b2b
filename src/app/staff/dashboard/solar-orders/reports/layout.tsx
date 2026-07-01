import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsSidebar from './ReportsSidebar';

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || (!session.solar_orders_view && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard?error=unauthorized');
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] w-full border border-gray-200 bg-white shadow-sm overflow-hidden mt-4">
      {/* Sidebar - Fixed 280px */}
      <ReportsSidebar />
      
      {/* Content Area */}
      <div className="flex-1 bg-gray-50/30">
        {children}
      </div>
    </div>
  );
}

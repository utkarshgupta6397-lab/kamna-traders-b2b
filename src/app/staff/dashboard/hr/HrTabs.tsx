'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck } from 'lucide-react';

interface HrTabsProps {
  children: React.ReactNode;
}

export default function HrTabs({ children }: HrTabsProps) {
  const pathname = usePathname();

  let activeTab = 'attendance-processor';
  if (pathname.includes('/hr/attendance-processor')) {
    activeTab = 'attendance-processor';
  }

  const tabCls = (tab: string) =>
    `flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-[#1A2766] text-[#1A2766]'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-6">
      <div
        className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto whitespace-nowrap"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <Link href="/staff/dashboard/hr/attendance-processor" className={tabCls('attendance-processor')}>
          <CalendarCheck size={16} strokeWidth={2} />
          Attendance Processor
        </Link>
      </div>

      <div>{children}</div>
    </div>
  );
}

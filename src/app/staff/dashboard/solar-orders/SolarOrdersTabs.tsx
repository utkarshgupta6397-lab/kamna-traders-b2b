'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutDashboard, ClipboardList, FileText, Wrench } from 'lucide-react';

interface SolarOrdersTabsProps {
  canViewOrders: boolean;
  canViewDocQueue: boolean;
  canViewInstallQueue: boolean;
  canViewCalendar: boolean;
  children: React.ReactNode;
}

export default function SolarOrdersTabs({
  canViewOrders,
  canViewDocQueue,
  canViewInstallQueue,
  canViewCalendar,
  children,
}: SolarOrdersTabsProps) {
  const pathname = usePathname();

  let activeTab = 'dashboard';
  if (pathname.includes('/solar-orders/orders')) {
    activeTab = 'orders';
  } else if (pathname.includes('/solar-orders/documentation-queue')) {
    activeTab = 'documentation-queue';
  } else if (pathname.includes('/solar-orders/installation-queue')) {
    activeTab = 'installation-queue';
  } else if (pathname.includes('/solar-orders/calendar')) {
    activeTab = 'calendar';
  } else if (!canViewOrders && canViewDocQueue) {
    activeTab = 'documentation-queue';
  } else if (!canViewOrders && !canViewDocQueue && canViewInstallQueue) {
    activeTab = 'installation-queue';
  }

  const tabCls = (tab: string) =>
    `flex items-center gap-1.5 pb-3 text-sm font-semibold transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-[#1A2766] text-[#1A2766]'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200">
        {canViewOrders && (
          <>
            <Link href="/staff/dashboard/solar-orders" className={tabCls('dashboard')}>
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
            <Link href="/staff/dashboard/solar-orders/orders" className={tabCls('orders')}>
              <ClipboardList size={14} />
              Orders
            </Link>
          </>
        )}

        {canViewDocQueue && (
          <Link
            href="/staff/dashboard/solar-orders/documentation-queue"
            className={tabCls('documentation-queue')}
          >
            <FileText size={14} />
            Documentation
          </Link>
        )}

        {canViewInstallQueue && (
          <Link
            href="/staff/dashboard/solar-orders/installation-queue"
            className={tabCls('installation-queue')}
          >
            <Wrench size={14} />
            Installation
          </Link>
        )}

        {canViewCalendar && (
          <Link
            href="/staff/dashboard/solar-orders/calendar"
            className={tabCls('calendar')}
          >
            <CalendarDays size={14} />
            Calendar
          </Link>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
}

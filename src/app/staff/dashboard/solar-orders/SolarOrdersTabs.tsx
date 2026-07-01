'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SolarOrdersTabsProps {
  canViewOrders: boolean;
  canViewDocQueue: boolean;
  canViewInstallQueue: boolean;
  children: React.ReactNode;
}

export default function SolarOrdersTabs({
  canViewOrders,
  canViewDocQueue,
  canViewInstallQueue,
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
  } else if (!canViewOrders && canViewDocQueue) {
    activeTab = 'documentation-queue'; // Fallback if no order view permission
  } else if (!canViewOrders && !canViewDocQueue && canViewInstallQueue) {
    activeTab = 'installation-queue';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200">
        {canViewOrders && (
          <>
            <Link
              href="/staff/dashboard/solar-orders"
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-[#1A2766] text-[#1A2766]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/staff/dashboard/solar-orders/orders"
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'orders'
                  ? 'border-[#1A2766] text-[#1A2766]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Orders
            </Link>
          </>
        )}
        
        {canViewDocQueue && (
          <Link
            href="/staff/dashboard/solar-orders/documentation-queue"
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'documentation-queue'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Documentation
          </Link>
        )}
        
        {canViewInstallQueue && (
          <Link
            href="/staff/dashboard/solar-orders/installation-queue"
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'installation-queue'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Installation
          </Link>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
}

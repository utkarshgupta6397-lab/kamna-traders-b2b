'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileCheck2, Hammer, Receipt, Files, Clock } from 'lucide-react';

export default function OrderDetailTabs({ orderId }: { orderId: string }) {
  const pathname = usePathname();

  const tabs = [
    { label: 'Overview', path: `/staff/dashboard/solar-orders/orders/${orderId}`, icon: LayoutDashboard },
    { label: 'Documentation', path: `/staff/dashboard/solar-orders/orders/${orderId}/documentation`, icon: FileCheck2 },
    { label: 'Installation', path: `/staff/dashboard/solar-orders/orders/${orderId}/installation`, icon: Hammer },
    { label: 'Financials', path: `/staff/dashboard/solar-orders/orders/${orderId}/financials`, icon: Receipt },
    { label: 'Files', path: `/staff/dashboard/solar-orders/orders/${orderId}/files`, icon: Files },
    { label: 'Activity', path: `/staff/dashboard/solar-orders/orders/${orderId}/timeline`, icon: Clock },
  ];

  return (
    <div className="flex overflow-x-auto no-scrollbar gap-1 py-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        const Icon = tab.icon;
        
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`flex items-center gap-2 whitespace-nowrap px-3.5 py-2 text-sm font-medium rounded-t-lg sm:rounded-lg transition-all ${
              isActive
                ? 'bg-white text-blue-600 shadow-sm border border-b-0 sm:border-b border-gray-200 ring-1 ring-black/5 relative z-10 translate-y-px sm:translate-y-0'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
            }`}
          >
            <Icon size={15} className={isActive ? 'text-blue-500' : 'text-gray-400'} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

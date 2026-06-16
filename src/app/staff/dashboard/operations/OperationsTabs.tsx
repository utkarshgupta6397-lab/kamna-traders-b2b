'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface OperationsTabsProps {
  canManageTransfers: boolean;
  children: React.ReactNode;
}

export default function OperationsTabs({
  canManageTransfers,
  children,
}: OperationsTabsProps) {
  const pathname = usePathname();

  let activeTab = 'current-stock';
  if (pathname.includes('/operations/carts')) {
    activeTab = 'carts';
  } else if (pathname.includes('/operations/inventory-history')) {
    activeTab = 'inventory-history';
  } else if (pathname.includes('/operations/transfers')) {
    activeTab = 'transfers';
  } else if (pathname.includes('/operations/current-stock')) {
    activeTab = 'current-stock';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto">
        <Link
          href="/staff/dashboard/operations/carts"
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'carts'
              ? 'border-[#1A2766] text-[#1A2766]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Carts
        </Link>
        <Link
          href="/staff/dashboard/operations/inventory-history"
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'inventory-history'
              ? 'border-[#1A2766] text-[#1A2766]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Inventory History
        </Link>
        <Link
          href="/staff/dashboard/operations/current-stock"
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'current-stock'
              ? 'border-[#1A2766] text-[#1A2766]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Current Stock
        </Link>
        {canManageTransfers && (
          <Link
            href="/staff/dashboard/operations/transfers"
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'transfers'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transfers
          </Link>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
}

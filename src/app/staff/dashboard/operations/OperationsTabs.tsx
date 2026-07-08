'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, History, Package, ArrowLeftRight } from 'lucide-react';

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

  const tabCls = (tab: string) =>
    `flex items-center gap-1.5 pb-3 text-sm font-semibold transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-[#1A2766] text-[#1A2766]'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <Link href="/staff/dashboard/operations/carts" className={tabCls('carts')}>
          <ShoppingCart size={16} strokeWidth={1.8} />
          Carts
        </Link>
        <Link href="/staff/dashboard/operations/inventory-history" className={tabCls('inventory-history')}>
          <History size={16} strokeWidth={1.8} />
          Inventory History
        </Link>
        <Link href="/staff/dashboard/operations/current-stock" className={tabCls('current-stock')}>
          <Package size={16} strokeWidth={1.8} />
          Current Stock
        </Link>
        {canManageTransfers && (
          <Link href="/staff/dashboard/operations/transfers" className={tabCls('transfers')}>
            <ArrowLeftRight size={16} strokeWidth={1.8} />
            Transfers
          </Link>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface AccountsTabsProps {
  canViewStatement: boolean;
  canViewTransactions: boolean;
  canViewSummary: boolean;
  canManageDcr?: boolean;
  children: React.ReactNode;
}

export default function AccountsTabs({
  canViewStatement,
  canViewTransactions,
  canViewSummary,
  canManageDcr,
  children,
}: AccountsTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let activeTab = 'statement';
  if (pathname.includes('/accounts/dcr')) {
    activeTab = 'dcr';
  } else if (pathname.includes('/accounts/summary')) {
    activeTab = 'summary';
  } else if (searchParams.get('tab') === 'transactions') {
    activeTab = 'transactions';
  } else if (!canViewStatement && canViewTransactions) {
    activeTab = 'transactions';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200">
        {canViewStatement && (
          <Link
            href="/staff/dashboard/accounts?tab=statement"
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'statement'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Customer Statement
          </Link>
        )}
        {canViewTransactions && (
          <Link
            href="/staff/dashboard/accounts?tab=transactions"
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'transactions'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transactions
          </Link>
        )}
        {canViewSummary && (
          <Link
            href="/staff/dashboard/accounts/summary"
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'summary'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Summary
          </Link>
        )}
        {canManageDcr && (
          <Link
            href="/staff/dashboard/accounts/dcr"
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'dcr'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Manage DCR
          </Link>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
}

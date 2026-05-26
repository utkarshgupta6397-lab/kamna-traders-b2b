'use client';

import Link from 'next/link';

interface AccountsTabsProps {
  canViewStatement: boolean;
  canViewTransactions: boolean;
  canViewSummary: boolean;
  activeTab: 'statement' | 'transactions' | 'summary';
  children: React.ReactNode;
}

export default function AccountsTabs({
  canViewStatement,
  canViewTransactions,
  canViewSummary,
  activeTab,
  children,
}: AccountsTabsProps) {
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
      </div>

      <div>{children}</div>
    </div>
  );
}

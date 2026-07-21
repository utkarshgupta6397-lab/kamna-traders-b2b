'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FileText, ArrowLeftRight, ChartColumn, ShieldCheck, FileSpreadsheet, BarChart3 } from 'lucide-react';

interface AccountsTabsProps {
  canViewStatement: boolean;
  canViewTransactions: boolean;
  canViewSummary: boolean;
  canManageDcr?: boolean;
  canProcessInvoices?: boolean;
  children: React.ReactNode;
}

export default function AccountsTabs({
  canViewStatement,
  canViewTransactions,
  canViewSummary,
  canManageDcr,
  canProcessInvoices,
  children,
}: AccountsTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let activeTab = 'statement';
  if (pathname.includes('/accounts/dcr')) {
    activeTab = 'dcr';
  } else if (pathname.includes('/accounts/invoice-processor')) {
    activeTab = 'invoice-processor';
  } else if (pathname.includes('/accounts/summary')) {
    activeTab = 'summary';
  } else if (pathname.includes('/accounts/reports')) {
    activeTab = 'reports';
  } else if (searchParams.get('tab') === 'transactions') {
    activeTab = 'transactions';
  } else if (!canViewStatement && canViewTransactions) {
    activeTab = 'transactions';
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
        {canViewStatement && (
          <Link href="/staff/dashboard/accounts?tab=statement" className={tabCls('statement')}>
            <FileText size={16} strokeWidth={1.8} />
            Customer Statement
          </Link>
        )}
        {canViewTransactions && (
          <Link href="/staff/dashboard/accounts?tab=transactions" className={tabCls('transactions')}>
            <ArrowLeftRight size={16} strokeWidth={1.8} />
            Transactions
          </Link>
        )}
        {canViewSummary && (
          <Link href="/staff/dashboard/accounts/summary" className={tabCls('summary')}>
            <ChartColumn size={16} strokeWidth={1.8} />
            Summary
          </Link>
        )}
        {canManageDcr && (
          <Link href="/staff/dashboard/accounts/dcr" className={tabCls('dcr')}>
            <ShieldCheck size={16} strokeWidth={1.8} />
            Manage DCR
          </Link>
        )}
        {canProcessInvoices && (
          <Link href="/staff/dashboard/accounts/invoice-processor" className={tabCls('invoice-processor')}>
            <FileSpreadsheet size={16} strokeWidth={1.8} />
            Invoice Processor
          </Link>
        )}
        <Link href="/staff/dashboard/accounts/reports" className={tabCls('reports')}>
          <BarChart3 size={16} strokeWidth={1.8} />
          Reports
        </Link>
      </div>

      <div>{children}</div>
    </div>
  );
}

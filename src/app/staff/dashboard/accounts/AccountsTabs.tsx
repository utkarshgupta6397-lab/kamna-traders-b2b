'use client';

import { useState, useEffect } from 'react';
import CustomerStatementView from '@/components/zoho/CustomerStatementView';
import LiveBankTransactionsView from '@/components/bank/LiveBankTransactionsView';
import { Suspense } from 'react';

interface AccountsTabsProps {
  canViewStatement: boolean;
  canViewTransactions: boolean;
}

export default function AccountsTabs({ canViewStatement, canViewTransactions }: AccountsTabsProps) {
  const [activeTab, setActiveTab] = useState<'statement' | 'transactions'>(
    canViewStatement ? 'statement' : 'transactions'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200">
        {canViewStatement && (
          <button
            onClick={() => setActiveTab('statement')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'statement'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Customer Statement
          </button>
        )}
        {canViewTransactions && (
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'transactions'
                ? 'border-[#1A2766] text-[#1A2766]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transactions
          </button>
        )}
      </div>

      <div>
        {activeTab === 'statement' && canViewStatement && (
          <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading statement...</div>}>
            <CustomerStatementView />
          </Suspense>
        )}
        {activeTab === 'transactions' && canViewTransactions && (
          <LiveBankTransactionsView />
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import CustomerStatementView from '@/components/zoho/CustomerStatementView';
import { Suspense } from 'react';

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'statement' | 'transactions'>('statement');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200">
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
      </div>

      <div>
        {activeTab === 'statement' && (
          <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading statement...</div>}>
            <CustomerStatementView />
          </Suspense>
        )}
        {activeTab === 'transactions' && (
          <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-medium text-gray-600">Coming Soon</h3>
            <p className="text-sm text-gray-400 mt-2">
              The transactions viewer is currently under development.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

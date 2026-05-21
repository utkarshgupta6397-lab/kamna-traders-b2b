import CustomerStatementView from '@/components/zoho/CustomerStatementView';
import { Suspense } from 'react';

export default function CustomerStatementPage() {
  return (
    <div className="max-w-6xl mx-auto py-6">
      <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading statement...</div>}>
        <CustomerStatementView />
      </Suspense>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Suspense } from 'react';
import CustomerLookupClient from './CustomerLookupClient';

export const metadata = {
  title: 'Customer DCR Lookup | Kamna B2B ERP',
};

export default async function CustomerLookupPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/api/auth/login');
  }
  
  if (session.role !== 'ADMIN' && !session.dcr_management && !session.accounts_customer_statement) {
    redirect('/staff/dashboard/accounts/dcr');
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] animate-in fade-in duration-300 min-h-[calc(100vh-64px)] overflow-hidden">
      <div className="bg-white px-8 py-5 border-b border-gray-200 shrink-0 shadow-sm z-10 relative">
        <h1 className="text-2xl font-bold text-[#1A2766] tracking-tight flex items-center gap-2">
          Customer DCR Lookup
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          Fast operational view for pending and issued DCRs.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto w-full">
          <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading lookup tool...</div>}>
            <CustomerLookupClient />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

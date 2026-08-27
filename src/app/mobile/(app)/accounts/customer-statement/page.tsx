import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import MobileCustomerStatementClient from './MobileCustomerStatementClient';

export const metadata = {
  title: 'Customer Statement | Kamna B2B ERP',
};

export default async function MobileCustomerStatementPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/mobile/login');
  }
  
  if (session.role !== 'ADMIN' && !session.accounts_customer_statement) {
    redirect('/mobile/accounts');
  }

  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <header className="flex-none sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile/accounts" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px] truncate">Customer Statement</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 w-full relative max-w-[430px] mx-auto overflow-y-auto">
        <MobileCustomerStatementClient userName={session.name?.split(' ')[0] || 'User'} />
      </main>
    </div>
  );
}

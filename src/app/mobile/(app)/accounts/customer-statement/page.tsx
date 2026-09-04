import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import MobileCustomerStatementClient from './MobileCustomerStatementClient';
import StatementHeader from './StatementHeader';

export const metadata = {
  title: 'Customer Statement | Kamna B2B ERP',
};

export default async function MobileCustomerStatementPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await getSession();
  
  if (!session) {
    redirect('/mobile/login');
  }
  
  if (session.role !== 'ADMIN' && !session.accounts_customer_statement) {
    redirect('/mobile/accounts');
  }

  const sp = await searchParams;
  const backTo = typeof sp.backTo === 'string' ? sp.backTo : undefined;

  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <StatementHeader backTo={backTo} />
      <main className="flex-1 flex flex-col min-h-0 w-full relative max-w-[430px] mx-auto overflow-y-auto">
        <MobileCustomerStatementClient userName={session.name?.split(' ')[0] || 'User'} />
      </main>
    </div>
  );
}

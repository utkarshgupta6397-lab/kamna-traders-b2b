import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import InvoiceProcessorClient from './InvoiceProcessorClient';

export default async function InvoiceProcessorPage() {
  const session = await getSession();

  if (!session || (session.role !== 'ADMIN' && !session.accounts_invoice_processor)) {
    redirect('/staff/dashboard/accounts?error=unauthorized');
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoice Processor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Convert Zoho Invoice Export into Kamna Traders Invoice Format.
        </p>
      </div>

      <InvoiceProcessorClient />
    </div>
  );
}

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OrderCreationForm from './OrderCreationForm';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default async function NewSolarOrderPage() {
  const session = await getSession();

  if (!session?.solar_orders_create) {
    redirect('/staff/dashboard/solar-orders/orders');
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/staff/dashboard/solar-orders/orders" className="hover:text-gray-600 transition-colors">Orders</Link>
          <ChevronRight size={14} />
          <span className="text-gray-600 font-medium">Create Solar Order</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1A2766]">Create Solar Order</h1>
        <p className="text-sm text-gray-500">Initiate a new solar project workflow.</p>
      </div>

      <OrderCreationForm />
    </div>
  );
}

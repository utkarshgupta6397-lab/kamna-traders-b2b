import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SolarOrdersTable from './SolarOrdersTable';

export default async function SolarOrdersList() {
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  if (!session?.solar_orders_view) {
    redirect('/staff/dashboard/solar-orders');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2766]">Solar Orders</h1>
          <p className="text-sm text-gray-500">Manage all solar orders</p>
        </div>
      </div>

      <SolarOrdersTable 
        currentUserId={session.userId} 
        canApprove={isAdmin || !!session.solar_orders_approval} 
        canCreate={!!session.solar_orders_create}
      />
    </div>
  );
}

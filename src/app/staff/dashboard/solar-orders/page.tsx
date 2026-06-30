import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SolarOrdersDashboardClient from './SolarOrdersDashboardClient';

export default async function SolarOrdersDashboard() {
  const session = await getSession();

  if (!session?.solar_orders_view) {
    redirect('/staff/dashboard?error=unauthorized_solar_orders');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2766]">Solar Orders Dashboard</h1>
          <p className="text-sm text-gray-500">Operational overview of current solar orders.</p>
        </div>
      </div>

      <SolarOrdersDashboardClient />
    </div>
  );
}

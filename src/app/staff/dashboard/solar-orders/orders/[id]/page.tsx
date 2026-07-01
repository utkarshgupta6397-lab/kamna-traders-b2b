import { prisma } from '@/lib/db';
import { fetchOrderWithDetails } from '@/lib/fetchers';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SolarOrderForm from '../../components/SolarOrderForm';

export default async function OrderDetailOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  
  const order = await fetchOrderWithDetails(id);

  const canMasterEdit = session?.role === 'ADMIN' || !!session?.solar_orders_master_edit;
  let allUsers: any[] = [];
  if (canMasterEdit) {
    allUsers = await prisma.user.findMany({
      where: { role: { in: ['SALESMAN', 'CALLING_EXECUTIVE', 'ADMIN'] } },
      select: { id: true, name: true, role: true }
    });
  }

  if (!order) {
    notFound();
  }
  return (
    <SolarOrderForm 
      mode="VIEW"
      initialOrder={order} 
      users={allUsers} 
      canMasterEdit={canMasterEdit} 
      session={session} 
    />
  );
}

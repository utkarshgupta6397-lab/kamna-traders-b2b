import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SolarOrderForm from '../../components/SolarOrderForm';

export default async function OrderDetailOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  
  const order = await prisma.solarOrder.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      salesman: { select: { name: true } },
      callingExecutive: { select: { name: true } },
      approvedBy: { select: { name: true } },
      subVendor: { select: { name: true } },
      panels: { orderBy: { orderIndex: 'asc' } },
      inverters: { orderBy: { orderIndex: 'asc' } },
      files: { where: { fileCategory: 'SITE_IMAGE', isDeleted: false } },
    }
  });

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

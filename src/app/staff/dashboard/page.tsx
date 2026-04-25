import { PrismaClient } from '@prisma/client';
import StaffCartBuilder from '@/components/StaffCartBuilder';
import { getSession } from '@/lib/auth';

const prisma = new PrismaClient();

export default async function StaffDashboardPage() {
  const session = await getSession();
  const staffId = session?.userId as string;

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true }
  });

  const skus = await prisma.sku.findMany({
    where: { isActive: true },
    include: {
      inventory: true
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">New Internal Cart</h1>
      </div>

      <StaffCartBuilder 
        warehouses={warehouses} 
        skus={skus} 
        staffId={staffId}
      />
    </div>
  );
}

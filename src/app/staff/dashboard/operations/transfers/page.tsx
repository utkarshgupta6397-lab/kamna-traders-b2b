import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TransfersConsoleClient from '@/components/TransfersConsoleClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TransfersPage() {
  const session = await getSession();
  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Ftransfers');
  }

  const hasPermission = session.canManageTransfers || session.role === 'ADMIN';
  if (!hasPermission) {
    redirect('/staff/dashboard');
  }

  const [warehouses, skus] = await Promise.all([
    prisma.warehouse.findMany({
      where: { active: true, isSystemWarehouse: false },
      orderBy: { name: 'asc' }
    }),
    prisma.sku.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        isUnlimited: true
      },
      orderBy: { name: 'asc' }
    })
  ]);

  return (
    <TransfersConsoleClient
      session={session}
      warehouses={warehouses}
      skus={skus}
    />
  );
}

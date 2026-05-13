import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import InventoryHistoryClient from '@/components/InventoryHistoryClient';

export default async function InventoryHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/staff');

  // Fetch only static context; logs are now fetched client-side via API for better UX (loaders, explicit apply)
  const [warehouses, skus] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.sku.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { id: 'asc' } }),
  ]);

  return (
    <InventoryHistoryClient 
      warehouses={warehouses} 
      skus={skus} 
      canAdjust={!!session.canAdjustInventory}
    />
  );
}

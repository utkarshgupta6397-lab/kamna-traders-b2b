import { prisma } from '@/lib/db';
import WarehousesManagerClient from './WarehousesManagerClient';

export default async function WarehousesPage() {
  // Query master warehouse data and counts
  const [warehouses, total, activeCount, inactiveCount] = await Promise.all([
    prisma.warehouse.findMany({
      where: { isSystemWarehouse: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        address: true,
        active: true,
        zohoLocationId: true,
        createdAt: true,
        updatedAt: true,
        isSystemWarehouse: true,
        printZonalSlips: true,
      },
    }),
    prisma.warehouse.count({ where: { isSystemWarehouse: false } }),
    prisma.warehouse.count({ where: { isSystemWarehouse: false, active: true } }),
    prisma.warehouse.count({ where: { isSystemWarehouse: false, active: false } }),
  ]);

  return (
    <WarehousesManagerClient
      initialWarehouses={warehouses}
      initialTotal={total}
      initialActiveCount={activeCount}
      initialInactiveCount={inactiveCount}
    />
  );
}

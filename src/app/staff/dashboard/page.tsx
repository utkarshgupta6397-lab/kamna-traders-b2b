import { PrismaClient } from '@prisma/client';
import StaffCartBuilder from '@/components/StaffCartBuilder';
import { getSession } from '@/lib/auth';

const prisma = new PrismaClient();

export default async function StaffDashboardPage() {
  const session = await getSession();
  const staffId = session?.userId as string;

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
  });

  // Active = visible to staff. OOS is a separate status shown as a tag.
  // Staff can still reference OOS items in their cart (e.g., for pre-orders or notes).
  const skus = await prisma.sku.findMany({
    where: { isActive: true },
    include: { inventory: true },
  });

  // Enrich each SKU with computed OOS status
  const enrichedSkus = skus.map(sku => {
    const hasInventory = sku.inventory.length > 0;
    const totalQty = sku.inventory.reduce((sum, inv) => sum + inv.qty, 0);
    const anyOosFlag = sku.inventory.some(inv => inv.isOos);
    const isOos = hasInventory ? (anyOosFlag || totalQty <= 0) : false;
    return { ...sku, isOos };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">New Internal Cart</h1>
      </div>

      <StaffCartBuilder
        warehouses={warehouses}
        skus={enrichedSkus}
        staffId={staffId}
      />
    </div>
  );
}

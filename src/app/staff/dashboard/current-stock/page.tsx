import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CurrentStockClient from '@/components/CurrentStockClient';

export default async function CurrentStockPage() {
  const session = await getSession();
  if (!session) redirect('/staff');

  // Fetch all necessary data
  const [warehouses, categories, brands, skus, inventory] = await Promise.all([
    prisma.warehouse.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.brand.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.sku.findMany({ 
      where: { isActive: true }, 
      select: { id: true, name: true, zohoBooksId2: true, categoryId: true, brandId: true, caseSize: true },
      orderBy: { name: 'asc' }
    }),
    prisma.warehouseInventory.findMany({
      select: { skuId: true, warehouseId: true, qty: true, isOos: true }
    })
  ]);

  // Transform inventory into a lookup object
  // inventoryLookup[skuId][warehouseId] = { qty, isOos }
  const inventoryLookup: Record<string, Record<string, { qty: number, isOos: boolean }>> = {};
  
  for (const inv of inventory) {
    if (!inventoryLookup[inv.skuId]) {
      inventoryLookup[inv.skuId] = {};
    }
    inventoryLookup[inv.skuId][inv.warehouseId] = {
      qty: inv.qty,
      isOos: inv.isOos
    };
  }

  // Map SKUs to include their inventory
  const items = skus.map(sku => ({
    ...sku,
    inventory: inventoryLookup[sku.id] || {}
  }));

  return (
    <CurrentStockClient 
      warehouses={warehouses} 
      categories={categories} 
      brands={brands}
      items={items} 
    />
  );
}

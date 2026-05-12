import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CurrentStockClient from '@/components/CurrentStockClient';

export default async function CurrentStockPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  if (sp.safe === '1') {
    return <div className="p-20 text-center font-bold text-red-600 bg-red-50 rounded-2xl border-2 border-red-200">SAFE MODE ACTIVE: Heavy dashboard components disabled to prevent overheating. <a href="?" className="underline ml-2">Exit Safe Mode</a></div>;
  }
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

import SolarPanelStockClient from '@/components/SolarPanelStockClient';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DebugPdfPage() {
  const productSearchOptions = { categoryName: 'Solar Panel' };

  const [warehouses, categories, brands, items] = await Promise.all([
    prisma.warehouse.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true, isSystemWarehouse: true },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({ 
      where: { active: true, status: 'Active' }, 
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' }
    }),
    prisma.brand.findMany({
      where: { active: true, status: 'Active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    import('@/lib/services/ProductLookupService').then(m => m.ProductLookupService.search('inventory', productSearchOptions))
  ]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'white' }}>
      <SolarPanelStockClient 
        warehouses={warehouses} 
        categories={categories} 
        brands={brands} 
        items={items} 
        canSync={true}
        isExportMode={true}
      />
    </div>
  );
}

import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import MobileWireCableStockClient from './MobileWireCableStockClient';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MobileWireCableStockPage() {
  const session = await getSession();
  if (!session) return null;

  const productSearchOptions = { categoryName: 'Wire & Cables' };

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
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <header className="flex-none sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile/operations" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Wire & Cables Stock</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 w-full relative">
        <MobileWireCableStockClient 
          warehouses={warehouses} 
          categories={categories} 
          brands={brands} 
          items={items} 
        />
      </main>
    </div>
  );
}

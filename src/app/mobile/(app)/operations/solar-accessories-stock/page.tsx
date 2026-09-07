import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import MobileSolarAccessoriesStockClient from './MobileSolarAccessoriesStockClient';
import { prisma } from '@/lib/db';
import { hasMobileFeatureAccess } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MobileSolarAccessoriesStockPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_solar_accessories')) {
    redirect('/mobile/operations');
  }

  const productSearchOptions = { categoryName: 'Solar Accessories' };

  const [warehouses, items] = await Promise.all([
    prisma.warehouse.findMany({
      where: { active: true },
      select: { id: true, name: true, isSystemWarehouse: true },
      orderBy: { name: 'asc' },
    }),
    import('@/lib/services/ProductLookupService').then(m =>
      m.ProductLookupService.search('inventory', productSearchOptions)
    ),
  ]);

  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <header className="flex-none sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link
            href="/mobile/operations"
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Solar Accessories</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 w-full relative">
        <MobileSolarAccessoriesStockClient warehouses={warehouses} items={items} />
      </main>
    </div>
  );
}

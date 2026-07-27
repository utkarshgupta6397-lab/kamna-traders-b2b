'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Tag, Factory, FolderTree, SlidersHorizontal, Calculator, Scale, Hash } from 'lucide-react';

export default function CatalogTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  let activeTab = 'products';
  if (pathname.includes('/catalog-pricing/brands')) {
    activeTab = 'brands';
  } else if (pathname.includes('/catalog-pricing/manufacturers')) {
    activeTab = 'manufacturers';
  } else if (pathname.includes('/catalog-pricing/categories')) {
    activeTab = 'categories';
  } else if (pathname.includes('/catalog-pricing/product-attributes')) {
    activeTab = 'product-attributes';
  } else if (pathname.includes('/catalog-pricing/tax-rates')) {
    activeTab = 'tax-rates';
  } else if (pathname.includes('/catalog-pricing/units')) {
    activeTab = 'units';
  } else if (pathname.includes('/catalog-pricing/hsn-codes')) {
    activeTab = 'hsn-codes';
  } else if (pathname.includes('/catalog-pricing/products')) {
    activeTab = 'products';
  }

  const tabCls = (tab: string) =>
    `flex items-center gap-1.5 pb-3 text-sm font-semibold transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-[#1A2766] text-[#1A2766]'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <Link href="/staff/dashboard/catalog-pricing/products" className={tabCls('products')}>
          <Box size={16} strokeWidth={1.8} />
          Products
        </Link>
        <Link href="/staff/dashboard/catalog-pricing/brands" className={tabCls('brands')}>
          <Tag size={16} strokeWidth={1.8} />
          Brands
        </Link>
        <Link href="/staff/dashboard/catalog-pricing/manufacturers" className={tabCls('manufacturers')}>
          <Factory size={16} strokeWidth={1.8} />
          Manufacturers
        </Link>
        <Link href="/staff/dashboard/catalog-pricing/categories" className={tabCls('categories')}>
          <FolderTree size={16} strokeWidth={1.8} />
          Categories
        </Link>
        <Link href="/staff/dashboard/catalog-pricing/product-attributes" className={tabCls('product-attributes')}>
          <SlidersHorizontal size={16} strokeWidth={1.8} />
          Product Attributes
        </Link>
        <Link href="/staff/dashboard/catalog-pricing/tax-rates" className={tabCls('tax-rates')}>
          <Calculator size={16} strokeWidth={1.8} />
          Tax Rates
        </Link>
        <Link href="/staff/dashboard/catalog-pricing/units" className={tabCls('units')}>
          <Scale size={16} strokeWidth={1.8} />
          Units of Measurement
        </Link>
        <Link href="/staff/dashboard/catalog-pricing/hsn-codes" className={tabCls('hsn-codes')}>
          <Hash size={16} strokeWidth={1.8} />
          HSN Codes
        </Link>
      </div>

      <div>{children}</div>
    </div>
  );
}

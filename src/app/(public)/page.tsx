import { PrismaClient } from '@prisma/client';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';

const prisma = new PrismaClient();

export default async function HomePage() {
  const categories = await prisma.category.findMany();

  // Only show active SKUs. Active = visible in storefront.
  // OOS is a separate, independent flag derived from inventory.
  const skus = await prisma.sku.findMany({
    where: { isActive: true },
    include: {
      category: true,
      inventory: true,
    },
  });

  const products = skus.map(sku => {
    // A product is OOS if:
    // 1. Any inventory record has isOos = true, OR
    // 2. Total qty across all warehouse inventory is 0 (and inventory records exist)
    const hasInventory = sku.inventory.length > 0;
    const totalQty = sku.inventory.reduce((sum, inv) => sum + inv.qty, 0);
    const anyOosFlag = sku.inventory.some(inv => inv.isOos);
    const isOos = hasInventory ? (anyOosFlag || totalQty <= 0) : false;

    return {
      id: sku.id,
      name: sku.name,
      brand: sku.brand,
      unit: sku.unit,
      moq: sku.moq,
      price: sku.price,
      category: sku.category,
      isOos,
    };
  });

  return (
    <div className="space-y-8">
      {/* Category quick-filters */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Categories</h2>
        <div className="flex overflow-x-auto pb-2 gap-2">
          <Link
            href="/"
            className="flex-shrink-0 bg-[#1A2766] text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-[#003347] transition-colors"
          >
            All
          </Link>
          {categories.map(category => (
            <Link
              key={category.id}
              href={`/?category=${category.id}`}
              className="flex-shrink-0 bg-white border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-sm font-medium hover:border-[#1A2766] hover:text-[#1A2766] transition-colors"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Product grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">All Products</h2>
          <span className="text-xs text-gray-400">{products.length} items</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
          {products.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-100">
              <p className="text-gray-400">No products available at the moment.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

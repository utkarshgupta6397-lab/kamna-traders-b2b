import { PrismaClient } from '@prisma/client';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';

const prisma = new PrismaClient();

export default async function HomePage() {
  const categories = await prisma.category.findMany();
  
  // Get SKUs with inventory status
  const skus = await prisma.sku.findMany({
    where: { isActive: true },
    include: {
      category: true,
      inventory: true,
    }
  });

  // Calculate if SKU is Out of Stock globally (or based on some logic)
  const products = skus.map(sku => {
    // If no inventory records, or all inventory records are 0 qty, it's OOS
    const totalQty = sku.inventory.reduce((sum, inv) => sum + inv.qty, 0);
    return {
      id: sku.id,
      name: sku.name,
      brand: sku.brand,
      unit: sku.unit,
      moq: sku.moq,
      price: sku.price,
      category: sku.category,
      isOos: totalQty <= 0,
    };
  });

  return (
    <div className="space-y-12">
      {/* Quick Category Filters */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Browse Categories</h2>
        <div className="flex overflow-x-auto pb-4 gap-4 hide-scrollbar">
          <Link href="/" className="flex-shrink-0 bg-[#1A2766] text-white px-6 py-3 rounded-xl font-medium shadow-sm hover:bg-[#003347] transition-colors">
            All Products
          </Link>
          {categories.map(category => (
            <Link key={category.id} href={`/?category=${category.id}`} className="flex-shrink-0 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium shadow-sm hover:border-[#1A2766] hover:text-[#1A2766] transition-colors">
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
          <span className="text-sm text-gray-500">{products.length} items</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
          {products.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500 text-lg">No products available at the moment.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

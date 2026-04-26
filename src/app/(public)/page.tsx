import { prisma } from '@/lib/db';
import HomePageClient from '@/components/HomePageClient';


export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const catId = sp.category ?? '';

  // Always fetch ALL categories with their SKU counts (independent of filters)
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { skus: { where: { isActive: true } } } } },
  });

  const skus = await prisma.sku.findMany({
    where: {
      isActive: true,
      ...(catId ? { categoryId: catId } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { name: { contains: q } },
              { brand: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { category: true, inventory: true, brand: true },
    orderBy: { name: 'asc' },
    take: 200,
  });

  const products = skus.map(sku => {
    const hasInventory = sku.inventory.length > 0;
    const totalQty = sku.inventory.reduce((s, inv) => s + inv.qty, 0);
    const anyOos = sku.inventory.some(inv => inv.isOos);
    return {
      id: sku.id,
      name: sku.name,
      brand: sku.brand?.name ?? null,
      unit: sku.unit,
      moq: sku.moq,
      stepQty: sku.stepQty,
      price: sku.price,
      imageUrl: sku.imageUrl,
      category: sku.category,
      isOos: hasInventory ? anyOos || totalQty <= 0 : false,
    };
  });

  // Map categories with real total counts (not filtered counts)
  const categoriesWithCounts = categories.map(c => ({
    id: c.id,
    name: c.name,
    count: c._count.skus,
  }));

  const totalActiveSkus = categoriesWithCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <HomePageClient
      categories={categoriesWithCounts}
      products={products}
      selectedCategoryId={catId}
      searchQuery={q}
      totalSkuCount={totalActiveSkus}
    />
  );
}

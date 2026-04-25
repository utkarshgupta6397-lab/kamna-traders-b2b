import { PrismaClient } from '@prisma/client';
import HomePageClient from '@/components/HomePageClient';

const prisma = new PrismaClient();

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const catId = sp.category ?? '';

  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

  const skus = await prisma.sku.findMany({
    where: {
      isActive: true,
      ...(catId ? { categoryId: catId } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { name: { contains: q } },
              { brand: { contains: q } },
            ],
          }
        : {}),
    },
    include: { category: true, inventory: true },
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
      brand: sku.brand,
      unit: sku.unit,
      moq: sku.moq,
      price: sku.price,
      category: sku.category,
      isOos: hasInventory ? anyOos || totalQty <= 0 : false,
    };
  });

  return (
    <HomePageClient
      categories={categories}
      products={products}
      selectedCategoryId={catId}
      searchQuery={q}
    />
  );
}

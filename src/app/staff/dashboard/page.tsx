import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';
import StaffHomeClient from '@/components/StaffHomeClient';

const prisma = new PrismaClient();

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const session = await getSession();
  const staffId = session?.userId as string;
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const catId = sp.category ?? '';

  const [warehouses, categories] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true } }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { skus: { where: { isActive: true } } } } },
    }),
  ]);

  const skus = await prisma.sku.findMany({
    where: {
      isActive: true,
      ...(catId ? { categoryId: catId } : {}),
      ...(q ? { OR: [{ id: { contains: q } }, { name: { contains: q } }] } : {}),
    },
    include: { category: true, inventory: true },
    orderBy: { name: 'asc' },
    take: 200,
  });

  const products = skus.map(sku => {
    const totalQty = sku.inventory.reduce((s, inv) => s + inv.qty, 0);
    const anyOos = sku.inventory.some(inv => inv.isOos);
    return {
      id: sku.id, name: sku.name, brand: sku.brand, unit: sku.unit,
      moq: sku.moq, price: sku.price, imageUrl: sku.imageUrl, category: sku.category,
      isOos: sku.inventory.length > 0 ? anyOos || totalQty <= 0 : false,
    };
  });

  const categoriesWithCounts = categories.map(c => ({
    id: c.id, name: c.name, count: c._count.skus,
  }));

  const totalSkuCount = categoriesWithCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <StaffHomeClient
      staffId={staffId}
      warehouses={warehouses}
      categories={categoriesWithCounts}
      products={products}
      selectedCategoryId={catId}
      searchQuery={q}
      totalSkuCount={totalSkuCount}
    />
  );
}

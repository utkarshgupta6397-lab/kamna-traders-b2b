import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import StaffHomeClient from '@/components/StaffHomeClient';


export default async function StaffDashboardPage() {
  const session = await getSession();
  const staffId = session?.userId as string;

  const [warehouses, categories] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true } }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { skus: { where: { isActive: true } } } } },
    }),
  ]);

  const categoriesWithCounts = categories.map((c) => ({
    id: c.id, name: c.name, count: c._count.skus,
  }));

  return (
    <StaffHomeClient
      staffId={staffId}
      warehouses={warehouses}
      categories={categoriesWithCounts}
    />
  );
}

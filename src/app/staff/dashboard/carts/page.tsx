import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import CartRegistryClient from '@/components/CartRegistryClient';

export default async function CartsPage() {
  const session = await getSession();
  if (!session) return null;

  // Pre-fetch filter data and user permissions
  const [warehouses, staff, user] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.user.findUnique({
      where: { id: session.userId as string },
      select: { canManageCarts: true, role: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#1A2766] uppercase tracking-tight">Carts</h1>
      </div>

      <CartRegistryClient 
        warehouses={warehouses}
        staff={staff}
        zohoOrgId={process.env.ZOHO_BOOKS_ORG_ID || ''}
        canManageCarts={user?.canManageCarts || user?.role === 'ADMIN'}
      />
    </div>
  );
}

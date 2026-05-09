import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import CartRegistryClient from '@/components/CartRegistryClient';

export default async function CartsPage() {
  const session = await getSession();
  if (!session) return null;

  // Pre-fetch filter data for the client component
  const [warehouses, staff] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
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
      />
    </div>
  );
}

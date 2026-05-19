import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import CartRegistryClient from '@/components/CartRegistryClient';
import { getZohoOrgId } from '@/lib/zoho-auth';

export default async function CartsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  if (sp.safe === '1') {
    return <div className="p-20 text-center font-bold text-red-600 bg-red-50 rounded-2xl border-2 border-red-200">SAFE MODE ACTIVE: Registry disabled. <a href="?" className="underline ml-2">Exit Safe Mode</a></div>;
  }
  const [warehouses, staff] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
  ]);

  const canManageCarts = session.canManageCarts || session.role === 'ADMIN';

  return (
    <div className="max-w-[96vw] mx-auto w-full px-1 py-1">
      <CartRegistryClient 
        warehouses={warehouses}
        staff={staff}
        zohoOrgId={getZohoOrgId()}
        canManageCarts={canManageCarts}
      />
    </div>
  );
}

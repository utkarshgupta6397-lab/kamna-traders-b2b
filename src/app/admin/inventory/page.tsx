import { prisma } from '@/lib/db';
import { updateInventory } from '../actions';
import InventoryClient from '@/components/InventoryClient';
import InventoryTableClient from '@/components/InventoryTableClient';

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; wh?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const q = sp.q?.trim() ?? '';
  const whFilter = sp.wh ?? '';
  const perPage = 30;

  const whereClause: Record<string, any> = {
    warehouse: { isSystemWarehouse: false }
  };
  if (whFilter) whereClause.warehouseId = whFilter;
  if (q) {
    whereClause.OR = [
      { skuId: { contains: q } },
      { sku: { name: { contains: q } } },
    ];
  }

  const [inventoryItems, total, warehouses, skus] = await Promise.all([
    prisma.warehouseInventory.findMany({
      where: whereClause,
      include: { warehouse: true, sku: true },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.warehouseInventory.count({ where: whereClause }),
    prisma.warehouse.findMany({ where: { active: true, isSystemWarehouse: false } }),
    prisma.sku.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ]);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Inventory ({total})</h1>
        <form action="/admin/inventory" method="get" className="flex gap-2 items-center flex-wrap">
          <input type="text" name="q" defaultValue={q} placeholder="Search SKU / name…" className="border rounded-lg px-3 py-1.5 text-sm w-44 focus:ring-2 focus:ring-[#1A2766] outline-none" />
          <select name="wh" defaultValue={whFilter} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button type="submit" className="bg-[#1A2766] text-white px-3 py-1.5 rounded-lg text-xs font-medium">Filter</button>
          {(q || whFilter) && <a href="/admin/inventory" className="text-xs text-gray-400 hover:text-gray-600">Clear</a>}
        </form>
      </div>

      {/* Update form with searchable SKU select */}
      <InventoryClient warehouses={warehouses} skus={skus} updateAction={updateInventory} />

      {/* Interactive Table with Bulk Controls */}
      <InventoryTableClient items={inventoryItems} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-6 flex-wrap">
          {Array.from({ length: totalPages }, (_, i) => (
            <a key={i} href={`/admin/inventory?page=${i + 1}${q ? `&q=${q}` : ''}${whFilter ? `&wh=${whFilter}` : ''}`}
              className={`px-2.5 py-1 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#1A2766] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{i + 1}</a>
          ))}
        </div>
      )}
    </div>
  );
}

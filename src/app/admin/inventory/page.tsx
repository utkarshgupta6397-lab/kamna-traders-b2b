import { prisma } from '@/lib/db';
import { updateInventory } from '../actions';
import InventoryClient from '@/components/InventoryClient';


export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; wh?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const q = sp.q?.trim() ?? '';
  const whFilter = sp.wh ?? '';
  const perPage = 30;

  const whereClause: Record<string, unknown> = {};
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
    prisma.warehouse.findMany({ where: { active: true } }),
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-3">Warehouse</th><th className="p-3">SKU ID</th><th className="p-3">Product</th>
                <th className="p-3">Zone</th><th className="p-3 text-right">Qty</th><th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {inventoryItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="p-3 text-xs">{item.warehouse.name}</td>
                  <td className="p-3 font-mono text-xs font-bold">{item.sku.id}</td>
                  <td className="p-3 text-xs">{item.sku.name}</td>
                  <td className="p-3 text-xs text-gray-500">{item.zone || '-'}</td>
                  <td className="p-3 text-right font-semibold text-xs">{item.qty}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.isOos ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {item.isOos ? 'OOS' : 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
              {inventoryItems.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No records.</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center gap-1.5 p-3 border-t flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => (
              <a key={i} href={`/admin/inventory?page=${i + 1}${q ? `&q=${q}` : ''}${whFilter ? `&wh=${whFilter}` : ''}`}
                className={`px-2.5 py-1 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#1A2766] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{i + 1}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

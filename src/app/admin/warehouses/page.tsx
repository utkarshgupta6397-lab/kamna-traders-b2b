import { PrismaClient } from '@prisma/client';
import { createWarehouse, updateWarehouse, deleteWarehouse } from '../actions';
import { Trash2, Save } from 'lucide-react';
import SafeDeleteButton from '@/components/SafeDeleteButton';

const prisma = new PrismaClient();

export default async function WarehousesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const perPage = 20;
  const [warehouses, total] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage,
      include: { _count: { select: { inventory: true, carts: true } } },
    }),
    prisma.warehouse.count(),
  ]);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Warehouses ({total})</h1>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Add New Warehouse</h2>
        <form action={createWarehouse} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input type="text" name="address" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <button type="submit" className="bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">Add Warehouse</button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-3">Name</th><th className="p-3">Address</th><th className="p-3">Status</th><th className="p-3">Mapped</th><th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {warehouses.map(w => (
              <tr key={w.id} className="hover:bg-gray-50/50">
                <td className="p-3" colSpan={5}>
                  <form action={updateWarehouse} className="flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="id" value={w.id} />
                    <input type="text" name="name" defaultValue={w.name} className="border rounded px-2 py-1 text-sm w-40 focus:ring-1 focus:ring-[#1A2766] outline-none" />
                    <input type="text" name="address" defaultValue={w.address ?? ''} className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px] focus:ring-1 focus:ring-[#1A2766] outline-none" />
                    <select name="active" defaultValue={String(w.active)} className="border rounded px-2 py-1 text-sm bg-white">
                      <option value="true">Active</option><option value="false">Inactive</option>
                    </select>
                    <span className="text-[10px] text-gray-400">{w._count.inventory} inv · {w._count.carts} carts</span>
                    <button type="submit" className="text-[#1A2766] hover:bg-blue-50 p-1.5 rounded" title="Save"><Save size={14} /></button>
                    <SafeDeleteButton action={deleteWarehouse} id={w.id} label="warehouse" className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-30">
                      <Trash2 size={14} />
                    </SafeDeleteButton>
                  </form>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No warehouses.</td></tr>}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-3 border-t">
            {Array.from({ length: totalPages }, (_, i) => (
              <a key={i} href={`/admin/warehouses?page=${i + 1}`} className={`px-3 py-1 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#1A2766] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{i + 1}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

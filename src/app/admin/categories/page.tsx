import { PrismaClient } from '@prisma/client';
import { createCategory, updateCategory, deleteCategory } from '../actions';
import { Trash2, Save } from 'lucide-react';
import SafeDeleteButton from '@/components/SafeDeleteButton';

const prisma = new PrismaClient();

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const perPage = 20;
  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: 'asc' }, skip: (page - 1) * perPage, take: perPage,
      include: { _count: { select: { skus: true } } },
    }),
    prisma.category.count(),
  ]);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Categories ({total})</h1>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Add New Category</h2>
        <form action={createCategory} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Category Name</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" />
          </div>
          <button type="submit" className="bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">Add Category</button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">SKUs</th><th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {categories.map(c => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="p-3" colSpan={4}>
                  <form action={updateCategory} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="text" name="name" defaultValue={c.name} className="border rounded px-2 py-1 text-sm w-48 focus:ring-1 focus:ring-[#1A2766] outline-none" />
                    <select name="active" defaultValue={String(c.active)} className="border rounded px-2 py-1 text-sm bg-white">
                      <option value="true">Active</option><option value="false">Inactive</option>
                    </select>
                    <span className="text-[10px] text-gray-400">{c._count.skus} SKUs</span>
                    <button type="submit" className="text-[#1A2766] hover:bg-blue-50 p-1.5 rounded" title="Save"><Save size={14} /></button>
                    <SafeDeleteButton action={deleteCategory} id={c.id} label="category" className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded">
                      <Trash2 size={14} />
                    </SafeDeleteButton>
                  </form>
                </td>
              </tr>
            ))}
            {categories.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">No categories.</td></tr>}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-3 border-t">
            {Array.from({ length: totalPages }, (_, i) => (
              <a key={i} href={`/admin/categories?page=${i + 1}`} className={`px-3 py-1 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#1A2766] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{i + 1}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { PrismaClient } from '@prisma/client';
import { createSku, updateSku, deleteSku } from '../actions';
import { Trash2, Save } from 'lucide-react';
import SafeDeleteButton from '@/components/SafeDeleteButton';

const prisma = new PrismaClient();

export default async function SKUsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const q = sp.q?.trim() ?? '';
  const perPage = 25;

  const where = q ? { OR: [{ id: { contains: q } }, { name: { contains: q } }] } : {};
  const [skus, total, categories] = await Promise.all([
    prisma.sku.findMany({
      where, include: { category: true },
      orderBy: { id: 'asc' }, skip: (page - 1) * perPage, take: perPage,
    }),
    prisma.sku.count({ where }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">SKUs ({total})</h1>
        <form action="/admin/skus" method="get" className="flex gap-2">
          <input type="text" name="q" defaultValue={q} placeholder="Search SKU / name…" className="border rounded-lg px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-[#1A2766] outline-none" />
          <button type="submit" className="bg-[#1A2766] text-white px-3 py-1.5 rounded-lg text-xs font-medium">Search</button>
          {q && <a href="/admin/skus" className="text-xs text-gray-400 self-center hover:text-gray-600">Clear</a>}
        </form>
      </div>

      {/* Add SKU */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Add New SKU</h2>
        <form action={createSku} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">SKU ID *</label>
            <input type="text" name="id" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="e.g. KT2001" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Product Name *</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Category *</label>
            <select name="categoryId" required className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#1A2766] outline-none">
              <option value="">Select</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
            <input type="text" name="unit" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="kg, L, pcs" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Price (₹)</label>
            <input type="number" step="0.01" name="price" required defaultValue="0" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">MOQ</label>
            <input type="number" name="moq" required defaultValue="1" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Step (+/- qty)</label>
            <input type="number" name="stepQty" required defaultValue="1" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Image URL</label>
            <input type="text" name="imageUrl" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="https://..." /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
            <input type="text" name="brand" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div className="md:col-span-3">
            <button type="submit" className="w-full bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">Add SKU</button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 uppercase tracking-wider">
                <th className="p-2.5">SKU</th><th className="p-2.5">Name</th><th className="p-2.5">Cat</th><th className="p-2.5">Unit</th>
                <th className="p-2.5">Price</th><th className="p-2.5">MOQ</th><th className="p-2.5">Step</th><th className="p-2.5">Image</th>
                <th className="p-2.5">Status</th><th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {skus.map(sku => (
                <tr key={sku.id} className="hover:bg-gray-50/50">
                  <td className="p-2" colSpan={10}>
                    <form action={updateSku} className="flex items-center gap-1.5 flex-wrap">
                      <input type="hidden" name="id" value={sku.id} />
                      <span className="font-mono text-xs font-bold text-gray-600 w-16 flex-shrink-0">{sku.id}</span>
                      <input type="text" name="name" defaultValue={sku.name} className="border rounded px-1.5 py-1 text-xs w-36 focus:ring-1 focus:ring-[#1A2766] outline-none" />
                      <select name="categoryId" defaultValue={sku.categoryId ?? ''} className="border rounded px-1 py-1 text-xs bg-white w-24">
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <input type="text" name="unit" defaultValue={sku.unit ?? ''} className="border rounded px-1.5 py-1 text-xs w-12" placeholder="unit" />
                      <input type="number" step="0.01" name="price" defaultValue={sku.price} className="border rounded px-1.5 py-1 text-xs w-16" />
                      <input type="number" name="moq" defaultValue={sku.moq} className="border rounded px-1.5 py-1 text-xs w-14" />
                      <input type="number" name="stepQty" defaultValue={sku.stepQty} className="border rounded px-1.5 py-1 text-xs w-14" />
                      <input type="text" name="imageUrl" defaultValue={sku.imageUrl ?? ''} className="border rounded px-1.5 py-1 text-xs w-28" placeholder="Image URL" />
                      <input type="text" name="brand" defaultValue={sku.brand ?? ''} className="border rounded px-1.5 py-1 text-xs w-20 hidden" />
                      <select name="isActive" defaultValue={String(sku.isActive)} className="border rounded px-1 py-1 text-xs bg-white w-18">
                        <option value="true">Active</option><option value="false">Inactive</option>
                      </select>
                      <button type="submit" className="text-[#1A2766] hover:bg-blue-50 p-1 rounded"><Save size={12} /></button>
                      <SafeDeleteButton action={deleteSku} id={sku.id} label="SKU" className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded">
                        <Trash2 size={12} />
                      </SafeDeleteButton>
                    </form>
                  </td>
                </tr>
              ))}
              {skus.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-gray-400">No SKUs found.</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center gap-1.5 p-3 border-t flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => (
              <a key={i} href={`/admin/skus?page=${i + 1}${q ? `&q=${q}` : ''}`} className={`px-2.5 py-1 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#1A2766] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{i + 1}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

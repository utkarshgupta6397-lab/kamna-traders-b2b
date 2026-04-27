import { prisma } from '@/lib/db';
import { createSku, updateSku, deleteSku } from '../actions';
import { Trash2, Save } from 'lucide-react';
import SafeDeleteButton from '@/components/SafeDeleteButton';
import ActionForm, { FormSubmit } from '@/components/ActionForm';
import ImageUploadClient from '@/components/ImageUploadClient';


export default async function SKUsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const q = sp.q?.trim() ?? '';
  const perPage = 25;

  const where = q ? { OR: [{ id: { contains: q } }, { name: { contains: q } }] } : {};
  const [skus, total, categories, brands] = await Promise.all([
    prisma.sku.findMany({
      where, include: { category: true, brand: true },
      orderBy: { id: 'asc' }, skip: (page - 1) * perPage, take: perPage,
    }),
    prisma.sku.count({ where }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.brand.findMany({ orderBy: { name: 'asc' } }),
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
        <ActionForm action={createSku} successMessage="SKU created!" resetOnSuccess className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">SKU ID *</label>
            <input type="text" name="id" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="e.g. KT2001" /></div>
          <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Product Name *</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select name="categoryId" className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#1A2766] outline-none">
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
            <select name="brandId" className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#1A2766] outline-none">
              <option value="">Select Brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
            <input type="text" name="unit" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="kg, L, pcs" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Price (₹)</label>
            <input type="number" min="0" step="0.01" name="price" required defaultValue="0" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">MOQ</label>
            <input type="number" min="0" name="moq" required defaultValue="1" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Step (+/- qty)</label>
            <input type="number" min="1" name="stepQty" required defaultValue="1" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Thumbnail</label>
            <ImageUploadClient name="imageUrl" />
          </div>
          <div className="md:col-span-5">
            <FormSubmit className="w-full bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">Add SKU</FormSubmit>
          </div>
        </ActionForm>
      </div>

      {/* Table (Div-based to avoid layout breaking with ActionForm) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Header */}
          <div className="flex bg-gray-50 border-b text-gray-500 uppercase tracking-wider text-xs font-medium">
            <div className="w-20 p-3">SKU</div>
            <div className="w-48 p-3">Name</div>
            <div className="w-32 p-3">Category</div>
            <div className="w-24 p-3">Brand</div>
            <div className="w-16 p-3">Unit</div>
            <div className="w-20 p-3">Price</div>
            <div className="w-16 p-3">MOQ</div>
            <div className="w-16 p-3">Step</div>
            <div className="w-16 p-3">Image</div>
            <div className="w-24 p-3">Status</div>
            <div className="flex-1 p-3 text-right">Actions</div>
          </div>
          
          {/* Body */}
          <div className="divide-y divide-gray-50 text-gray-700">
            {skus.map(sku => (
              <ActionForm key={sku.id} action={updateSku} successMessage="SKU updated" className="flex items-center hover:bg-gray-50/50 transition-colors">
                <input type="hidden" name="id" value={sku.id} />
                <div className="w-20 p-2 font-mono text-xs font-bold text-gray-600 truncate" title={sku.id}>{sku.id}</div>
                <div className="w-48 p-2">
                  <input type="text" name="name" defaultValue={sku.name} className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] outline-none" />
                </div>
                <div className="w-32 p-2">
                  <select name="categoryId" defaultValue={sku.categoryId ?? ''} className="w-full border rounded px-1 py-1.5 text-xs bg-white">
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="w-24 p-2">
                  <select name="brandId" defaultValue={sku.brandId ?? ''} className="w-full border rounded px-1 py-1.5 text-xs bg-white">
                    <option value="">None</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="w-16 p-2">
                  <input type="text" name="unit" defaultValue={sku.unit ?? ''} className="w-full border rounded px-2 py-1.5 text-xs" placeholder="unit" />
                </div>
                <div className="w-20 p-2">
                  <input type="number" min="0" step="0.01" name="price" defaultValue={sku.price} className="w-full border rounded px-2 py-1.5 text-xs" />
                </div>
                <div className="w-16 p-2">
                  <input type="number" min="0" name="moq" defaultValue={sku.moq} className="w-full border rounded px-2 py-1.5 text-xs" />
                </div>
                <div className="w-16 p-2">
                  <input type="number" min="1" name="stepQty" defaultValue={sku.stepQty} className="w-full border rounded px-2 py-1.5 text-xs" />
                </div>
                <div className="w-16 p-2 flex items-center justify-center">
                  <ImageUploadClient name="imageUrl" defaultValue={sku.imageUrl ?? ''} />
                </div>
                <div className="w-24 p-2">
                  <select name="isActive" defaultValue={String(sku.isActive)} className="w-full border rounded px-2 py-1.5 text-xs bg-white">
                    <option value="true">Active</option><option value="false">Inactive</option>
                  </select>
                </div>
                <div className="flex-1 p-2 flex justify-end items-center gap-1">
                  <FormSubmit className="text-[#1A2766] hover:bg-blue-50 p-1.5 rounded transition-colors" icon={<Save size={14} />} />
                  <SafeDeleteButton action={deleteSku} id={sku.id} label="SKU" className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors">
                    <Trash2 size={14} />
                  </SafeDeleteButton>
                </div>
              </ActionForm>
            ))}
            {skus.length === 0 && <div className="p-8 text-center text-gray-400">No SKUs found.</div>}
          </div>
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

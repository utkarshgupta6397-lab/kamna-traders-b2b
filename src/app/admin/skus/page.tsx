import { PrismaClient } from '@prisma/client';
import { createSku, deleteSku } from '../actions';
import { Trash2 } from 'lucide-react';

const prisma = new PrismaClient();

export default async function SKUsPage() {
  const skus = await prisma.sku.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' }
  });
  const categories = await prisma.category.findMany();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">SKUs</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">Add New SKU</h2>
        <form action={createSku} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU ID</label>
            <input type="text" name="id" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="e.g., SKU101" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select name="categoryId" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none bg-white">
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
            <input type="number" step="0.01" name="price" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" defaultValue="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MOQ (Minimum Order Qty)</label>
            <input type="number" name="moq" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" defaultValue="1" />
          </div>
          <div>
            <button type="submit" className="w-full bg-[#AE1B1E] text-white px-6 py-2 rounded-lg hover:bg-red-800 transition-colors font-medium">
              Add SKU
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                <th className="p-4 font-medium">SKU ID</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Price</th>
                <th className="p-4 font-medium">MOQ</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {skus.map((sku) => (
                <tr key={sku.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono text-sm">{sku.id}</td>
                  <td className="p-4 font-medium">{sku.name}</td>
                  <td className="p-4 text-gray-500">{sku.category?.name || '-'}</td>
                  <td className="p-4 text-gray-500">₹{sku.price.toFixed(2)}</td>
                  <td className="p-4 text-gray-500">{sku.moq}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${sku.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {sku.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <form action={deleteSku.bind(null, sku.id)}>
                      <button type="submit" className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors" title="Delete SKU">
                        <Trash2 size={18} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {skus.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No SKUs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

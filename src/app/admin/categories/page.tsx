import { PrismaClient } from '@prisma/client';
import { createCategory, deleteCategory } from '../actions';
import { Trash2 } from 'lucide-react';

const prisma = new PrismaClient();

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">Add New Category</h2>
        <form action={createCategory} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" />
          </div>
          <button type="submit" className="bg-[#AE1B1E] text-white px-6 py-2 rounded-lg hover:bg-red-800 transition-colors font-medium">
            Add Category
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-medium">{category.name}</td>
                <td className="p-4 text-right">
                  <form action={deleteCategory.bind(null, category.id)}>
                    <button type="submit" className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors" title="Delete Category">
                      <Trash2 size={18} />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={2} className="p-8 text-center text-gray-500">No categories found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

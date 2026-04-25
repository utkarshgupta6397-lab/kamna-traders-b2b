import { PrismaClient } from '@prisma/client';
import { createWarehouse, deleteWarehouse } from '../actions';
import { Trash2 } from 'lucide-react';

const prisma = new PrismaClient();

export default async function WarehousesPage() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">Add New Warehouse</h2>
        <form action={createWarehouse} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" />
          </div>
          <div className="flex-[2]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" name="address" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" />
          </div>
          <button type="submit" className="bg-[#AE1B1E] text-white px-6 py-2 rounded-lg hover:bg-red-800 transition-colors font-medium">
            Add Warehouse
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Address</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {warehouses.map((warehouse) => (
              <tr key={warehouse.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-medium">{warehouse.name}</td>
                <td className="p-4 text-gray-500">{warehouse.address}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${warehouse.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {warehouse.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <form action={deleteWarehouse.bind(null, warehouse.id)}>
                    <button type="submit" className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors" title="Delete Warehouse">
                      <Trash2 size={18} />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">No warehouses found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { PrismaClient } from '@prisma/client';
import { updateInventory } from '../actions';

const prisma = new PrismaClient();

export default async function InventoryPage() {
  const inventoryItems = await prisma.warehouseInventory.findMany({
    include: { warehouse: true, sku: true },
    orderBy: { updatedAt: 'desc' }
  });
  
  const warehouses = await prisma.warehouse.findMany();
  const skus = await prisma.sku.findMany();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">Update Inventory</h2>
        <form action={updateInventory} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
            <select name="warehouseId" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none bg-white">
              <option value="">Select Warehouse</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <select name="skuId" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none bg-white">
              <option value="">Select SKU</option>
              {skus.map(s => (
                <option key={s.id} value={s.id}>{s.id} - {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input type="number" name="qty" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" defaultValue="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone (e.g., A1)</label>
            <input type="text" name="zone" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none" />
          </div>
          <div className="md:col-span-4">
            <button type="submit" className="w-full bg-[#1A2766] text-white px-6 py-2 rounded-lg hover:bg-[#003347] transition-colors font-medium">
              Save Inventory Record
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                <th className="p-4 font-medium">Warehouse</th>
                <th className="p-4 font-medium">SKU ID</th>
                <th className="p-4 font-medium">Product Name</th>
                <th className="p-4 font-medium">Zone</th>
                <th className="p-4 font-medium text-right">Quantity</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {inventoryItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">{item.warehouse.name}</td>
                  <td className="p-4 font-mono text-sm">{item.sku.id}</td>
                  <td className="p-4 font-medium">{item.sku.name}</td>
                  <td className="p-4 text-gray-500">{item.zone || '-'}</td>
                  <td className="p-4 text-right font-semibold">{item.qty}</td>
                  <td className="p-4">
                    {item.isOos ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Out of Stock
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        In Stock
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {inventoryItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">No inventory records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

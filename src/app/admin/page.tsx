import { PrismaClient } from '@prisma/client';
import { Package, Users, Warehouse, Database } from 'lucide-react';

const prisma = new PrismaClient();

export default async function AdminDashboard() {
  const userCount = await prisma.user.count();
  const warehouseCount = await prisma.warehouse.count();
  const skuCount = await prisma.sku.count();
  const oosCount = await prisma.warehouseInventory.count({
    where: { isOos: true },
  });

  const stats = [
    { title: 'Total Users', value: userCount, icon: Users, color: 'bg-blue-500' },
    { title: 'Warehouses', value: warehouseCount, icon: Warehouse, color: 'bg-indigo-500' },
    { title: 'Total SKUs', value: skuCount, icon: Package, color: 'bg-teal-500' },
    { title: 'Out of Stock Items', value: oosCount, icon: Database, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white rounded-xl shadow-sm p-6 flex items-center space-x-4 border border-gray-100">
              <div className={`p-4 rounded-lg text-white ${stat.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
        <p className="text-gray-500 text-sm">System is operational. Ready for orders.</p>
      </div>
    </div>
  );
}

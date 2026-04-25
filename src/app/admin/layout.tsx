import Link from 'next/link';
import { Package, Users, Warehouse, Tags, Database, LayoutDashboard, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#f8f9fb]">
      {/* Sidebar */}
      <div className="w-64 bg-[#1A2766] text-white flex flex-col">
        <div className="p-4 bg-[#003347] flex items-center justify-center">
          <h1 className="text-xl font-bold">Kamna Admin</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/admin" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#003347] transition-colors">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link href="/admin/users" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#003347] transition-colors">
            <Users size={20} />
            <span>Users</span>
          </Link>
          <Link href="/admin/warehouses" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#003347] transition-colors">
            <Warehouse size={20} />
            <span>Warehouses</span>
          </Link>
          <Link href="/admin/categories" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#003347] transition-colors">
            <Tags size={20} />
            <span>Categories</span>
          </Link>
          <Link href="/admin/skus" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#003347] transition-colors">
            <Package size={20} />
            <span>SKUs</span>
          </Link>
          <Link href="/admin/inventory" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#003347] transition-colors">
            <Database size={20} />
            <span>Inventory</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-[#003347]">
          <Link href="/logout" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-[#AE1B1E] transition-colors text-red-200 hover:text-white">
            <LogOut size={20} />
            <span>Logout</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm z-10 p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Admin Portal</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Logged in as Admin</span>
          </div>
        </header>
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8f9fb] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

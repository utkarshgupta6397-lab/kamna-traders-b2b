import Link from 'next/link';
import Image from 'next/image';
import { Package, Users, Warehouse, Tags, Database, LayoutDashboard, LogOut } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/warehouses', label: 'Warehouses', icon: Warehouse },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/skus', label: 'SKUs', icon: Package },
  { href: '/admin/inventory', label: 'Inventory', icon: Database },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/staff');
  }

  return (
    <div className="flex h-screen bg-[#f8f9fb]">
      {/* Sidebar */}
      <div className="w-60 bg-[#1A2766] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-3 bg-[#003347] flex items-center gap-2 border-b border-white/10">
          <Image src="/logo.svg" alt="Kamna Traders" width={110} height={48} className="object-contain brightness-0 invert" />
          <span className="text-white/50 text-xs font-medium border-l border-white/20 pl-2 ml-1">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-all duration-150"
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/10">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-300 text-sm font-medium hover:bg-red-700/30 hover:text-red-100 transition-all duration-150"
            >
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </form>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">Admin Portal</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            ● Admin Session Active
          </span>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8f9fb] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

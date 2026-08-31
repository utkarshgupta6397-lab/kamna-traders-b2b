import Link from 'next/link';
import Image from 'next/image';
import { Package, Users, Warehouse, Tags, Database, LayoutDashboard, LogOut, Bookmark, RefreshCw, Terminal, Printer, Shield, Lock, FileText, Briefcase, MessageCircle, Server, Wrench, Webhook, DownloadCloud } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/user-permissions', label: 'User Permissions', icon: Lock },
  { href: '/admin/hold-queue-config', label: 'Hold Queue Configuration', icon: Shield },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/warehouses', label: 'Warehouses', icon: Warehouse },
  { href: '/admin/sub-vendors', label: 'Sub-Vendors', icon: Briefcase },
  { href: '/admin/cities', label: 'Cities', icon: Bookmark },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/brands', label: 'Brands', icon: Bookmark },
  { href: '/admin/skus', label: 'SKUs', icon: Package },
  { href: '/admin/sku-sync', label: 'SKU Sync', icon: RefreshCw },
  { href: '/admin/catalog-sync', label: 'Catalog Maintenance', icon: RefreshCw },
  { href: '/admin/zoho-books', label: 'Zoho Books Sync', icon: Database },
  { href: '/admin/incoming-so', label: 'Incoming SO', icon: DownloadCloud },
  { href: '/admin/zoho-creator', label: 'Zoho Creator', icon: Webhook },
  { href: '/admin/inventory', label: 'Inventory', icon: Database },
  { href: '/admin/zoho-debug', label: 'Zoho Debug', icon: Terminal },
  { href: '/admin/print-debug', label: 'Print Debug', icon: Printer },
  { href: '/admin/printers', label: 'Printer Management', icon: Printer },
  { href: '/admin/accounts/summary', label: 'Accounts Summary', icon: FileText },
  { href: '/admin/customer-statement', label: 'Customer Statement', icon: FileText },
  { href: '/admin/transactions', label: 'Transactions', icon: Database },
  { href: '/admin/sessions', label: 'Sessions', icon: Shield },
  { href: '/admin/system-utilities', label: 'System Utilities', icon: Wrench },
  { href: '/admin/gateway-settings', label: 'Gateway Settings', icon: Server },
  { href: '/admin/dev-tools/gateway-test', label: 'Gateway Test', icon: Terminal },
  { href: '/admin/dev-tools/test-communication', label: 'Test Communication', icon: Terminal },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  console.log(`[AdminLayout] Auth Check: ${session ? 'Valid Session' : 'No Session'}, Role: ${session?.role || 'None'}`);

  if (!session || session.role !== 'ADMIN') {
    console.warn(`[AdminLayout] Redirecting to /staff. Reason: ${!session ? 'No session' : 'Role mismatch (' + session.role + ')'}`);
    redirect('/staff?callbackUrl=%2Fadmin');
  }

  return (
    <div className="flex h-screen bg-[#f8f9fb]">
      <Toaster position="top-right" />
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
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-all duration-150"
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
          {session?.whatsapp_integration && (
            <Link
              href="/admin/whatsapp-integration"
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-all duration-150"
            >
              <MessageCircle size={17} />
              <span>WhatsApp Integration</span>
            </Link>
          )}
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

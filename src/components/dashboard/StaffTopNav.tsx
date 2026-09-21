'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Box,
  FileText,
  Users,
  Sun,
  MessageSquare,
  Truck,
  Settings,
  LogOut,
} from 'lucide-react';

interface StaffTopNavProps {
  session: {
    name?: string | null;
    role?: string;
    accountsAccess?: boolean;
    accounts_customer_statement?: boolean;
    accounts_transactions?: boolean;
    accounts_summary_view?: boolean;
    manage_payments_view_own?: boolean;
    manage_payments_view_all?: boolean;
    hr_attendance_processor?: boolean;
    solar_orders_view?: boolean;
    communications_view?: boolean;
    dispatch_view?: boolean;
  };
}

export default function StaffTopNav({ session }: StaffTopNavProps) {
  const pathname = usePathname();

  const isItemActive = (href: string, exact: boolean = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all ${
      isActive
        ? 'text-white font-semibold bg-white/15 shadow-xs'
        : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  const hasAccountsAccess =
    session.accounts_customer_statement ||
    session.accounts_transactions ||
    session.accounts_summary_view ||
    session.manage_payments_view_own ||
    session.manage_payments_view_all ||
    session.role === 'ADMIN';

  const hasCatalogAccess = session.accountsAccess || session.role === 'ADMIN';
  const hasHrAccess = session.hr_attendance_processor || session.role === 'ADMIN';
  const hasDispatchAccess = session.dispatch_view || session.role === 'ADMIN';

  return (
    <nav className="flex items-center gap-1.5 lg:gap-2 text-sm text-white/80 flex-shrink-0">
      {/* 1. Dashboard (Exact match on /staff/dashboard) */}
      <Link
        href="/staff/dashboard"
        className={navLinkClass(isItemActive('/staff/dashboard', true))}
        title="Dashboard"
      >
        <LayoutDashboard size={15} />
        <span className="hidden md:inline">Dashboard</span>
      </Link>

      {/* 2. Cart */}
      <Link
        href="/staff/dashboard/cart"
        className={navLinkClass(
          isItemActive('/staff/dashboard/cart') || isItemActive('/staff/cart')
        )}
        title="Cart"
      >
        <ShoppingCart size={15} />
        <span className="hidden md:inline">Cart</span>
      </Link>

      {/* 3. Catalog & Pricing */}
      {hasCatalogAccess && (
        <Link
          href="/staff/dashboard/catalog-pricing"
          className={navLinkClass(isItemActive('/staff/dashboard/catalog-pricing'))}
          title="Catalog & Pricing"
        >
          <BookOpen size={15} />
          <span className="hidden md:inline">Catalog & Pricing</span>
        </Link>
      )}

      {/* 4. Operations */}
      <Link
        href="/staff/dashboard/operations"
        className={navLinkClass(isItemActive('/staff/dashboard/operations'))}
        title="Operations"
      >
        <Box size={15} />
        <span className="hidden md:inline">Operations</span>
      </Link>

      {/* 5. Accounts */}
      {hasAccountsAccess && (
        <Link
          href="/staff/dashboard/accounts"
          className={navLinkClass(isItemActive('/staff/dashboard/accounts'))}
          title="Accounts"
        >
          <FileText size={15} />
          <span className="hidden md:inline">Accounts</span>
        </Link>
      )}

      {/* 6. HR */}
      {hasHrAccess && (
        <Link
          href="/staff/dashboard/hr"
          className={navLinkClass(isItemActive('/staff/dashboard/hr'))}
          title="HR"
        >
          <Users size={15} />
          <span className="hidden md:inline">HR</span>
        </Link>
      )}

      {/* 7. Solar Orders */}
      {session.solar_orders_view && (
        <Link
          href="/staff/dashboard/solar-orders"
          className={navLinkClass(isItemActive('/staff/dashboard/solar-orders'))}
          title="Solar Orders"
        >
          <Sun size={15} />
          <span className="hidden md:inline">Solar Orders</span>
        </Link>
      )}

      {/* 8. Communications (Preserved conditional item) */}
      {session.communications_view && (
        <Link
          href="/staff/dashboard/communications"
          className={navLinkClass(isItemActive('/staff/dashboard/communications'))}
          title="Communications"
        >
          <MessageSquare size={15} />
          <span className="hidden md:inline">Communications</span>
        </Link>
      )}

      {/* 9. Dispatch */}
      {hasDispatchAccess && (
        <Link
          href="/staff/dashboard/dispatch"
          className={navLinkClass(isItemActive('/staff/dashboard/dispatch'))}
          title="Dispatch"
        >
          <Truck size={15} />
          <span className="hidden md:inline">Dispatch</span>
        </Link>
      )}

      {/* 10. Settings */}
      <Link
        href="/staff/settings"
        className={navLinkClass(isItemActive('/staff/settings'))}
        title="Settings"
      >
        <Settings size={15} />
        <span className="hidden md:inline">Settings</span>
      </Link>

      {/* Logout */}
      <form action="/api/auth/logout" method="POST" className="ml-1">
        <button
          type="submit"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-200 hover:text-white hover:bg-red-500/20 transition-all font-medium"
          title="Logout"
        >
          <LogOut size={15} />
          <span className="hidden md:inline">Logout</span>
        </button>
      </form>
    </nav>
  );
}

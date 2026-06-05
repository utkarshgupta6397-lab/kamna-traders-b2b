'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface DcrStats {
  reviewPending: number;
  pendingSerials: number;
  vendorDcrPending: number;
}

const DcrStatsContext = createContext<{
  stats: DcrStats;
  refreshStats: () => Promise<void>;
}>({
  stats: { reviewPending: 0, pendingSerials: 0, vendorDcrPending: 0 },
  refreshStats: async () => {},
});

export const useDcrStats = () => useContext(DcrStatsContext);

export default function DcrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [stats, setStats] = useState<DcrStats>({ reviewPending: 0, pendingSerials: 0, vendorDcrPending: 0 });

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dcr/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          reviewPending: data.reviewPending || 0,
          pendingSerials: data.pendingSerials || 0,
          vendorDcrPending: data.vendorDcrPending || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch DCR stats in layout:', err);
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats, pathname]);

  const sidebarNav = [
    { id: 'process',          label: 'Process Invoices',      path: '/staff/dashboard/accounts/dcr',                                   exact: true,  placeholder: false },
    { id: 'pending',          label: 'Pending Serials',        path: '/staff/dashboard/accounts/dcr/pending-serials',                   exact: false, placeholder: false },
    { id: 'purchase_receive', label: 'Purchase Receive',       path: '/staff/dashboard/accounts/dcr/purchase-receive',                  exact: false, placeholder: false },
    { id: 'purchase_dcr',     label: 'Purchase DCR Received',  path: '/staff/dashboard/accounts/dcr/purchase-dcr-received',             exact: false, placeholder: false },
    { id: 'serial_search',    label: 'Serial Search',          path: '/staff/dashboard/accounts/dcr/serial-search',                    exact: false, placeholder: false },
    { id: 'serial_correct',   label: 'Serial Corrections',     path: '/staff/dashboard/accounts/dcr/serial-corrections',               exact: false, placeholder: false },
    { id: 'hold',             label: 'Hold Queue',             path: '#',                                                               exact: false, placeholder: true  },
    { id: 'ready',            label: 'Ready To Issue',         path: '#',                                                               exact: false, placeholder: true  },
    { id: 'issued',           label: 'Issued',                 path: '#',                                                               exact: false, placeholder: true  },
    { id: 'reports',          label: 'Reports',                path: '#',                                                               exact: false, placeholder: true  },
  ];

  const isActive = (navPath: string, exact: boolean) => {
    if (navPath === '#') return false;
    if (exact) return pathname === navPath;
    return pathname.startsWith(navPath);
  };

  const getBadgeValue = (id: string) => {
    if (id === 'process') return stats.reviewPending;
    if (id === 'pending') return stats.pendingSerials;
    if (id === 'purchase_dcr') return stats.vendorDcrPending;
    return 0;
  };

  return (
    <DcrStatsContext.Provider value={{ stats, refreshStats }}>
      <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
        {/* Left Sidebar Nav */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wider">DCR Workflows</h2>
            </div>
            <nav className="flex flex-col p-2 space-y-1">
              {sidebarNav.map(item => {
                const active = isActive(item.path, item.exact);
                const isReviewPath = pathname.includes('/review/');
                // Exception: if we are on a review page, "Process Invoices" should stay highlighted since it's the parent.
                const trulyActive = active || (item.id === 'process' && isReviewPath);
                const badgeValue = getBadgeValue(item.id);

                return (
                  <Link
                    key={item.id}
                    href={item.placeholder ? '#' : item.path}
                    className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      trulyActive 
                        ? 'bg-[#1A2766]/5 text-[#1A2766] border border-[#1A2766]/10' 
                        : item.placeholder 
                          ? 'text-gray-400 hover:bg-gray-50 cursor-not-allowed'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      {badgeValue > 0 && (
                        <span 
                          className="min-w-[24px] h-5 px-1.5 flex items-center justify-center bg-orange-500 text-white rounded-full text-[11px] font-semibold"
                          style={{ minWidth: '24px', height: '20px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}
                        >
                          {badgeValue}
                        </span>
                      )}
                      {item.placeholder && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-wider border border-gray-200">Soon</span>}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </DcrStatsContext.Provider>
  );
}


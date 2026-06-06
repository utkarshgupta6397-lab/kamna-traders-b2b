'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface DcrStats {
  reviewPending: number;
  pendingSerials: number;
  vendorDcrPending: number;
  holdQueue: number;
  readyToIssue: number;
}

const DcrStatsContext = createContext<{
  stats: DcrStats;
  refreshStats: () => Promise<void>;
}>({
  stats: { reviewPending: 0, pendingSerials: 0, vendorDcrPending: 0, holdQueue: 0, readyToIssue: 0 },
  refreshStats: async () => {},
});

export const useDcrStats = () => useContext(DcrStatsContext);

export default function DcrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [stats, setStats] = useState<DcrStats>({ reviewPending: 0, pendingSerials: 0, vendorDcrPending: 0, holdQueue: 0, readyToIssue: 0 });
  const [permissions, setPermissions] = useState<any>(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dcr/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          reviewPending: data.reviewPending || 0,
          pendingSerials: data.pendingSerials || 0,
          vendorDcrPending: data.vendorDcrPending || 0,
          holdQueue: data.holdQueue || 0,
          readyToIssue: data.readyToIssue || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch DCR stats in layout:', err);
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats, pathname]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Unauthorized');
      })
      .then(data => {
        if (data.session) {
          setPermissions(data.session);
        }
      })
      .catch(() => {});
  }, []);

  const sidebarNavSections = [
    {
      heading: 'PURCHASE',
      items: [
        { id: 'purchase_receive', label: 'Purchase Receive',       path: '/staff/dashboard/accounts/dcr/purchase-receive',                  exact: false, placeholder: false },
        { id: 'purchase_dcr',     label: 'Purchase DCR Received',  path: '/staff/dashboard/accounts/dcr/purchase-dcr-received',             exact: false, placeholder: false },
      ]
    },
    {
      heading: 'SALES',
      items: [
        { id: 'process',          label: 'Process Invoices',      path: '/staff/dashboard/accounts/dcr',                                   exact: true,  placeholder: false },
        { id: 'pending',          label: 'Pending Serials',        path: '/staff/dashboard/accounts/dcr/pending-serials',                   exact: false, placeholder: false },
        { id: 'hold',             label: 'Hold Queue',             path: '/staff/dashboard/accounts/dcr/hold-queue',                       exact: false, placeholder: false },
        { id: 'ready',            label: 'Ready To Issue',         path: '/staff/dashboard/accounts/dcr/ready-to-issue',                   exact: false, placeholder: false },
      ]
    },
    {
      heading: 'EXTRA',
      items: [
        { id: 'serial_correct',   label: 'Serial Corrections',     path: '/staff/dashboard/accounts/dcr/serial-corrections',               exact: false, placeholder: false },
        { id: 'customer_lookup',  label: 'Customer DCR Lookup',    path: '/staff/dashboard/accounts/dcr/customer-lookup',                  exact: false, placeholder: false },
      ]
    }
  ];

  const filteredNavSections = sidebarNavSections.map(section => {
    return {
      ...section,
      items: section.items.filter(item => {
        if (item.id === 'serial_correct') {
          return permissions?.role === 'ADMIN' || !!permissions?.dcr_serial_mapping_override;
        }
        if (item.id === 'hold') {
          return permissions?.role === 'ADMIN' || !!permissions?.dcr_hold_release;
        }
        return true;
      })
    };
  }).filter(section => section.items.length > 0);

  const isActive = (navPath: string, exact: boolean) => {
    if (navPath === '#') return false;
    if (exact) return pathname === navPath;
    return pathname.startsWith(navPath);
  };

  const getBadgeValue = (id: string) => {
    if (id === 'process') return stats.reviewPending;
    if (id === 'pending') return stats.pendingSerials;
    if (id === 'purchase_receive') return stats.vendorDcrPending;
    if (id === 'hold') return stats.holdQueue;
    if (id === 'ready') return stats.readyToIssue;
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
            <nav className="flex flex-col p-3 space-y-4 overflow-y-auto">
              {filteredNavSections.map(section => (
                <div key={section.heading}>
                  <h3 className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    {section.heading}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map(item => {
                      const active = isActive(item.path, item.exact);
                      const isReviewPath = pathname.includes('/review/');
                      // Exception: if we are on a review page, "Process Invoices" should stay highlighted since it's the parent.
                      const trulyActive = active || (item.id === 'process' && isReviewPath);
                      const badgeValue = getBadgeValue(item.id);

                      return (
                        <Link
                          key={item.id}
                          href={item.placeholder ? '#' : item.path}
                          className={`flex items-center justify-between px-2.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                            trulyActive 
                              ? 'bg-[#1A2766]/5 text-[#1A2766] border border-[#1A2766]/10' 
                              : item.placeholder 
                                ? 'text-gray-400 hover:bg-gray-50 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                          }`}
                        >
                          <span>{item.label}</span>
                          <div className="flex items-center gap-1.5">
                            {badgeValue > 0 && (
                              <span 
                                className="min-w-[24px] h-5 px-1.5 flex items-center justify-center bg-orange-500 text-white rounded-full text-[11px] font-semibold shadow-sm"
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
                  </div>
                </div>
              ))}
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


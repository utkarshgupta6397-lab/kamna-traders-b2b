'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function DcrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const sidebarNav = [
    { id: 'process', label: 'Process Invoices', path: '/staff/dashboard/accounts/dcr', exact: true, phase2: false },
    { id: 'pending', label: 'Pending Serials', path: '#', exact: false, phase2: true },
    { id: 'vendor', label: 'Vendor DCR', path: '#', exact: false, phase2: true },
    { id: 'hold', label: 'Hold Queue', path: '#', exact: false, phase2: true },
    { id: 'ready', label: 'Ready To Issue', path: '#', exact: false, phase2: true },
    { id: 'issued', label: 'Issued', path: '#', exact: false, phase2: true },
    { id: 'reports', label: 'Reports', path: '#', exact: false, phase2: true },
  ];

  const isActive = (navPath: string, exact: boolean) => {
    if (navPath === '#') return false;
    if (exact) return pathname === navPath;
    return pathname.startsWith(navPath);
  };

  return (
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

              return (
                <Link
                  key={item.id}
                  href={item.phase2 ? '#' : item.path}
                  className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    trulyActive 
                      ? 'bg-[#1A2766]/5 text-[#1A2766]' 
                      : item.phase2 
                        ? 'text-gray-400 hover:bg-gray-50 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.phase2 && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-wider border border-gray-200">Phase 2</span>}
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
  );
}

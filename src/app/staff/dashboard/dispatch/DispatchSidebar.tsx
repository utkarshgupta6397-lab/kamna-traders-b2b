'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  FileCheck2,
  Banknote,
  Truck,
  CheckCircle,
  FileSignature,
  PackageMinus,
  UploadCloud,
  ClipboardCheck,
  Inbox,
  LineChart
} from "lucide-react";

export default function DispatchSidebar() {
  const pathname = usePathname();

  const sidebarNavSections = [
{
      heading: 'INCOMING',
      items: [
        { id: 'incoming_orders', label: 'Incoming Orders', path: '/staff/dashboard/dispatch/incoming', exact: true, icon: Inbox },
      ]
    },
    {
      heading: 'PRE DISPATCH',
      items: [
        { id: 'rate_review', label: 'Rate Review', path: '/staff/dashboard/dispatch/pre/rate-review', exact: true, icon: FileCheck2 },
        { id: 'payment_verification', label: 'Payment Verification', path: '/staff/dashboard/dispatch/pre/payment-verification', exact: true, icon: Banknote },
        { id: 'truck_details', label: 'Truck Details', path: '/staff/dashboard/dispatch/pre/truck-details', exact: true, icon: Truck },
        { id: 'ready_for_invoice', label: 'Ready for Invoice', path: '/staff/dashboard/dispatch/pre/ready-for-invoice', exact: true, icon: CheckCircle },
        { id: 'invoice_confirmation', label: 'Invoice Confirmation', path: '/staff/dashboard/dispatch/pre/invoice-confirmation', exact: true, icon: FileSignature },
      ]
    },
    {
      heading: 'POST DISPATCH',
      items: [
        { id: 'inventory_deduction', label: 'Inventory Deduction', path: '/staff/dashboard/dispatch/post/inventory-deduction', exact: true, icon: PackageMinus },
        { id: 'receiving_upload', label: 'Receiving Upload', path: '/staff/dashboard/dispatch/post/receiving-upload', exact: true, icon: UploadCloud },
        { id: 'checked_by_at', label: 'Checked By / At', path: '/staff/dashboard/dispatch/post/checked-by-at', exact: true, icon: ClipboardCheck },
      ]
    }
  ];

  const bottomActions = [
    { id: 'dispatch_reports', label: 'Dispatch Reports', path: '/staff/dashboard/dispatch/reports', exact: true, icon: LineChart }
  ];

  const isActive = (navPath: string, exact: boolean) => {
    if (exact) return pathname === navPath;
    return pathname.startsWith(navPath);
  };

  const getBadgeValue = (id: string) => {
    return 0; // MVP mock
  };

  return (
    <div className="w-full md:w-64 flex-shrink-0 flex flex-col h-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wider">DISPATCH</h2>
        </div>
        
        <nav className="flex-1 flex flex-col p-3 space-y-4 overflow-y-auto">
          {sidebarNavSections.map(section => (
            <div key={section.heading}>
              <h3 className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                {section.heading}
              </h3>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = isActive(item.path, item.exact);
                  const badgeValue = getBadgeValue(item.id);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      href={item.path}
                      className={`flex items-center justify-between px-2.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                        active 
                          ? 'bg-[#1A2766]/5 text-[#1A2766] border border-[#1A2766]/10' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {Icon && <Icon size={16} />}
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {badgeValue > 0 && (
                          <span 
                            className="min-w-[24px] h-5 px-1.5 flex items-center justify-center bg-orange-500 text-white rounded-full text-[11px] font-semibold shadow-sm"
                            style={{ minWidth: '24px', height: '20px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}
                          >
                            {badgeValue}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 bg-gray-50/30 flex-shrink-0">
           {bottomActions.map(item => {
             const active = isActive(item.path, item.exact);
             const Icon = item.icon;
             return (
               <Link
                  key={item.id}
                  href={item.path}
                  className={`flex items-center justify-between px-2.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                    active 
                      ? 'bg-[#1A2766]/5 text-[#1A2766] border border-[#1A2766]/10' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {Icon && <Icon size={16} />}
                    <span>{item.label}</span>
                  </div>
                </Link>
             );
           })}
        </div>
      </div>
    </div>
  );
}

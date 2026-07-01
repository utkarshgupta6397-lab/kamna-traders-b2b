'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, PhoneCall, PenTool, FileText, IndianRupee, Package } from 'lucide-react';

export default function ReportsSidebar() {
  const pathname = usePathname();

  const links = [
    {
      title: 'Available',
      items: [
        { name: 'Sales by Salesman', href: '/staff/dashboard/solar-orders/reports/salesman', icon: BarChart3 },
        { name: 'Sales by Calling Agent', href: '/staff/dashboard/solar-orders/reports/calling-agent', icon: PhoneCall },
      ],
    },
  ];

  const comingSoon = [
    {
      title: 'Reserved',
      items: [
        { name: 'Installation Reports', icon: PenTool },
        { name: 'Documentation Reports', icon: FileText },
        { name: 'Payment Reports', icon: IndianRupee },
        { name: 'Inventory Reports', icon: Package },
      ],
    },
  ];

  return (
    <div className="w-[280px] h-full flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="flex-1 overflow-y-auto py-4">
        {links.map((section, idx) => (
          <div key={idx} className="mb-6">
            <h4 className="px-5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              {section.title}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors relative ${
                        isActive
                          ? 'text-[#1A2766] bg-[#1A2766]/5 font-semibold'
                          : 'text-gray-600 hover:text-[#1A2766] hover:bg-gray-50'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1A2766] rounded-r" />
                      )}
                      <Icon size={16} className={isActive ? 'text-[#1A2766]' : 'text-gray-400'} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {comingSoon.map((section, idx) => (
          <div key={idx} className="mb-6 opacity-60">
            <h4 className="px-5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              {section.title}
            </h4>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <div className="flex items-center justify-between px-5 py-2.5 text-sm text-gray-500 cursor-not-allowed">
                      <div className="flex items-center gap-3">
                        <Icon size={16} className="text-gray-400" />
                        {item.name}
                      </div>
                      <span className="text-[9px] font-bold tracking-wider bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 uppercase">
                        Soon
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

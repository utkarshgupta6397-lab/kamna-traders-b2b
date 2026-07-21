'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  Wallet, 
  CreditCard, 
  Landmark,
  FileSpreadsheet,
  Receipt,
  Building2,
  FileCheck,
  TrendingUp,
  Activity,
  BookOpen,
  BookText,
  Scale,
  Package,
  LineChart,
  Target,
  Building,
  PieChart
} from 'lucide-react';

export default function ReportsSidebar() {
  const pathname = usePathname();

  const links = [
    {
      title: 'Available',
      items: [
        { name: 'Sales by Salesman', id: 'sales-by-salesman', icon: BarChart3 },
        { name: 'Collection Reports', id: 'collection-reports', icon: Wallet },
        { name: 'Outstanding Receivables', id: 'outstanding-receivables', icon: CreditCard },
        { name: 'Outstanding Payables', id: 'outstanding-payables', icon: Landmark },
        { name: 'Customer Ledger', id: 'customer-ledger', icon: FileSpreadsheet },
        { name: 'Vendor Ledger', id: 'vendor-ledger', icon: Receipt },
        { name: 'Bank Reports', id: 'bank-reports', icon: Building2 },
        { name: 'GST Reports', id: 'gst-reports', icon: FileCheck },
        { name: 'Profit & Loss', id: 'profit-and-loss', icon: TrendingUp },
        { name: 'Cash Flow', id: 'cash-flow', icon: Activity },
        { name: 'Journal Reports', id: 'journal-reports', icon: BookOpen },
        { name: 'Ledger Reports', id: 'ledger-reports', icon: BookText },
      ],
    },
  ];

  const comingSoon = [
    {
      title: 'Reserved',
      items: [
        { name: 'Balance Sheet', icon: Scale },
        { name: 'Inventory Valuation', icon: Package },
        { name: 'Expense Analytics', icon: LineChart },
        { name: 'Budget vs Actual', icon: Target },
        { name: 'Cost Center Reports', icon: Building },
        { name: 'Financial Ratios', icon: PieChart },
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
                const href = `/staff/dashboard/accounts/reports/${item.id}`;
                const isEnabled = item.id === 'sales-by-salesman';
                const isActive = pathname === href && isEnabled;
                const Icon = item.icon;

                if (!isEnabled) {
                  return (
                    <li key={item.name}>
                      <div className="flex items-center gap-3 px-5 py-2.5 text-sm text-gray-400 opacity-50 cursor-not-allowed pointer-events-none">
                        <Icon size={16} className="text-gray-400" />
                        {item.name}
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={item.name}>
                    <Link
                      href={href}
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
          <div key={idx} className="mb-6 opacity-30">
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

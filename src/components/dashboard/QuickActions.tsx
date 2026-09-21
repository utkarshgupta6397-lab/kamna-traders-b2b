import React from 'react';
import Link from 'next/link';
import { FileText, PackagePlus, Boxes, Truck, ArrowUpRight } from 'lucide-react';

export interface CompactQuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

export const TOP_QUICK_ACTIONS: CompactQuickAction[] = [
  {
    label: 'Customer Statement',
    href: '/staff/dashboard/accounts?tab=statement',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50/70 hover:bg-blue-100/70',
    border: 'border-blue-100',
  },
  {
    label: 'Create Product',
    href: '/staff/dashboard/catalog-pricing/products/create',
    icon: PackagePlus,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50/70 hover:bg-indigo-100/70',
    border: 'border-indigo-100',
  },
  {
    label: 'Current Stock',
    href: '/staff/dashboard/operations/current-stock',
    icon: Boxes,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50/70 hover:bg-emerald-100/70',
    border: 'border-emerald-100',
  },
  {
    label: 'Post Dispatch',
    href: '/staff/dashboard/dispatch/incoming?dispatch=post',
    icon: Truck,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50/70 hover:bg-cyan-100/70',
    border: 'border-cyan-100',
  },
];

export default function QuickActions() {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="hidden xl:inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
        Quick:
      </span>
      {TOP_QUICK_ACTIONS.map((act) => {
        const Icon = act.icon;
        return (
          <Link
            key={act.href}
            href={act.href}
            className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${act.border} ${act.bg} transition-all hover:shadow-2xs text-xs font-semibold text-slate-700 hover:text-slate-900 shrink-0`}
            title={act.label}
          >
            <Icon size={13} className={act.color} />
            <span>{act.label}</span>
            <ArrowUpRight
              size={11}
              className="text-slate-400 group-hover:text-slate-600 opacity-60 group-hover:opacity-100 shrink-0 ml-0.5"
            />
          </Link>
        );
      })}
    </div>
  );
}

'use client';

import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Box,
  FileText,
  History,
  LucideIcon,
} from 'lucide-react';
import QuickActions from './QuickActions';

export type DashboardSectionId =
  | 'overview'
  | 'sales'
  | 'inventory'
  | 'operations'
  | 'accounts'
  | 'activity';

interface SectionDef {
  id: DashboardSectionId;
  label: string;
  icon: LucideIcon;
}

export const DASHBOARD_SECTIONS: SectionDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'sales', label: 'Sales', icon: TrendingUp },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'operations', label: 'Operations', icon: Box },
  { id: 'accounts', label: 'Accounts', icon: FileText },
  { id: 'activity', label: 'Activity', icon: History },
];

interface DashboardSectionTabsProps {
  activeSection: DashboardSectionId;
  onSectionChange: (sectionId: DashboardSectionId) => void;
}

export default function DashboardSectionTabs({
  activeSection,
  onSectionChange,
}: DashboardSectionTabsProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/90 pb-1.5 shrink-0 flex-wrap lg:flex-nowrap">
      {/* Left: Dominant Workspace Pill Tabs Container */}
      <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto max-w-full">
        {DASHBOARD_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white text-[#1A2766] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-[#1A2766]' : 'text-slate-400'} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Compact Quick Actions Cluster (Open Cart, Catalog, Operations, Accounts) */}
      <div className="flex items-center gap-2 shrink-0">
        <QuickActions />
      </div>
    </div>
  );
}

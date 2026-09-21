import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  // Future-ready props for real data
  value?: string | number | null;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  } | null;
}

export default function DashboardKpiCard({
  title,
  subtitle,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  value = null,
  trend = null,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl px-3.5 py-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between h-[84px] overflow-hidden">
      {/* Top: Category Title & Icon with breathing room */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBgClass} ${iconColorClass}`}
          >
            <Icon size={15} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate">
            {title}
          </span>
        </div>

        {/* Static trend placeholder */}
        {trend ? (
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            {trend.label}
          </span>
        ) : (
          <div className="h-3.5 w-12 bg-slate-100 rounded shrink-0" />
        )}
      </div>

      {/* Bottom: Static value placeholder or future real value */}
      <div className="flex items-baseline justify-between gap-2 pt-1">
        {value !== null ? (
          <span className="text-lg font-black text-slate-900 tracking-tight leading-none">
            {value}
          </span>
        ) : (
          <div className="h-5 w-20 bg-slate-200/80 rounded" />
        )}

        {subtitle && (
          <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

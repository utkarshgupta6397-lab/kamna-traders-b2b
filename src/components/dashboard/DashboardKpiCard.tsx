import React from 'react';
import { LucideIcon } from 'lucide-react';
import WipWidget from './WipWidget';

export interface KpiCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  value?: string | number | null;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  } | null;
  isLoading?: boolean;
  isError?: boolean;
  isWip?: boolean;
  badge?: string | null;
}

export default function DashboardKpiCard({
  title,
  subtitle,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  value = null,
  trend = null,
  isLoading = false,
  isError = false,
  isWip = false,
  badge = null,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl px-3.5 py-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between h-[84px] overflow-hidden">
      {/* Top: Category Title & Icon */}
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

        {/* Top-right slot: trend, badge, or clean space */}
        {trend ? (
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            {trend.label}
          </span>
        ) : badge ? (
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded shrink-0">
            {badge}
          </span>
        ) : null}
      </div>

      {/* Bottom: Real value, Loading Skeleton, Error State, or WIP watermark */}
      {isWip ? (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <WipWidget size="sm" />
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-2 pt-1">
          {isLoading ? (
            <div className="h-5 w-20 bg-slate-200/80 rounded animate-pulse" />
          ) : isError ? (
            <span className="text-sm font-semibold text-slate-400 leading-none">
              —
            </span>
          ) : value !== null && value !== undefined ? (
            <span className="text-lg font-black text-slate-900 tracking-tight leading-none">
              {value}
            </span>
          ) : (
            <span className="text-sm font-semibold text-slate-400 leading-none">
              —
            </span>
          )}

          {isError ? (
            <span className="text-[11px] text-rose-500/80 font-medium truncate max-w-[120px]">
              Unable to load
            </span>
          ) : subtitle ? (
            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[130px]">
              {subtitle}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

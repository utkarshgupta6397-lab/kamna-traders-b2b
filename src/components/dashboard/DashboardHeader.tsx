'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { getTimeBasedEyebrow } from '@/utils/greeting';

interface DashboardHeaderProps {
  userName?: string | null;
  lastUpdated: Date;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export default function DashboardHeader({
  userName,
  lastUpdated,
  isRefreshing,
  onRefresh,
}: DashboardHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [eyebrowGreeting, setEyebrowGreeting] = useState<string>(() => getTimeBasedEyebrow());

  useEffect(() => {
    setMounted(true);
    const updateGreeting = () => {
      setEyebrowGreeting(getTimeBasedEyebrow());
    };
    updateGreeting();
    const timer = setInterval(updateGreeting, 60000);
    return () => clearInterval(timer);
  }, []);

  // Format last updated timestamp in user's local timezone
  const formattedLastUpdated = lastUpdated.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = lastUpdated.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const displayName = userName?.trim() || 'Staff';

  return (
    <div className="flex items-center justify-between gap-4 pb-1.5 border-b border-slate-200/80 shrink-0">
      {/* Left: Strong welcoming greeting with clear visual hierarchy */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            suppressHydrationWarning
            className="text-[11px] font-bold uppercase tracking-widest text-[#AE1B1E]"
          >
            {eyebrowGreeting}
          </span>
          <h1 className="text-xl lg:text-2xl font-black text-[#1A2766] tracking-tight leading-tight truncate">
            {displayName}!
          </h1>
        </div>
        <p className="text-xs text-slate-500 font-normal mt-0.5">
          Great to have you here. Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>

      {/* Right: Subtle Last Updated & Refresh controls */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Clock size={12} className="text-slate-400 shrink-0" />
          <span suppressHydrationWarning className="text-slate-500">
            {mounted
              ? `Last updated: ${formattedDate}, ${formattedLastUpdated}`
              : 'Last updated: Just now'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-600 hover:text-[#1A2766] hover:bg-slate-100 active:bg-slate-200/70 border border-slate-200/70 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh dashboard"
        >
          <RefreshCw
            size={12}
            className={`${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`}
          />
          <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}

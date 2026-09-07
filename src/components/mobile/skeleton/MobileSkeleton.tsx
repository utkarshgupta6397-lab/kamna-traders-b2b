import React from 'react';

export function MobileSkeleton({
  className = '',
  style,
  rounded = 'rounded-md',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rounded?: string }) {
  return (
    <div
      className={`bg-slate-200/80 animate-pulse ${rounded} ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

export function MobileHeaderSkeleton({
  title,
  showBack = true,
  backHref = '/mobile',
}: {
  title?: string;
  showBack?: boolean;
  backHref?: string;
}) {
  return (
    <header className="flex-none sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
      <div className="flex items-center px-1 min-h-[56px] py-1">
        <div className="flex items-center gap-1 px-3 py-2">
          {showBack && (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/80 shrink-0"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
          {title ? (
            <span className="font-bold text-[15px] truncate">{title}</span>
          ) : (
            <div className="h-5 w-32 bg-white/20 rounded animate-pulse" />
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileKpiGridSkeleton({
  columns = 3,
  count = 3,
  className = '',
}: {
  columns?: 2 | 3 | 4;
  count?: number;
  className?: string;
}) {
  const colClass =
    columns === 2
      ? 'grid-cols-2'
      : columns === 4
      ? 'grid-cols-4'
      : 'grid-cols-3';

  return (
    <div className={`grid ${colClass} gap-2 shrink-0 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col gap-2"
        >
          <div className="h-2.5 w-14 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-5 w-12 bg-slate-200 rounded-md animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function MobileCardSkeleton({
  className = '',
  lines = 2,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div
      className={`bg-white rounded-[16px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center justify-between animate-pulse ${className}`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0 mr-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
          {lines > 1 && <div className="h-3 w-1/2 bg-slate-100 rounded-md" />}
        </div>
      </div>
      <div className="w-5 h-5 bg-slate-100 rounded-full shrink-0" />
    </div>
  );
}

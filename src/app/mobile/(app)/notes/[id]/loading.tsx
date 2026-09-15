import React from 'react';

export default function MobileNoteDetailLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-screen">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white/20 animate-pulse" />
            <div className="h-5 w-24 bg-white/20 rounded-md animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Detail Body Skeleton */}
      <main className="flex-1 px-5 py-6 max-w-[430px] mx-auto w-full flex flex-col animate-pulse">
        {/* Title */}
        <div className="h-7 w-3/4 bg-slate-200 rounded-lg mb-3" />
        
        {/* Metadata */}
        <div className="flex flex-col gap-1.5 mb-6 pb-4 border-b border-slate-200">
          <div className="h-3 w-48 bg-slate-200 rounded-md" />
          <div className="h-2.5 w-36 bg-slate-150 rounded-md" />
        </div>

        {/* Content lines */}
        <div className="flex flex-col gap-2.5 mb-8">
          <div className="h-4 w-full bg-slate-200 rounded-md" />
          <div className="h-4 w-5/6 bg-slate-200 rounded-md" />
          <div className="h-4 w-4/6 bg-slate-200 rounded-md" />
          <div className="h-4 w-3/6 bg-slate-150 rounded-md" />
        </div>

        {/* Footer info */}
        <div className="mt-auto pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="h-4 w-28 bg-slate-200 rounded-md" />
          <div className="h-4 w-20 bg-slate-200 rounded-md" />
        </div>
      </main>
    </div>
  );
}

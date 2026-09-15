import React from 'react';

export default function MobileNoteHistoryLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-screen">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white/20 animate-pulse" />
            <div className="h-5 w-32 bg-white/20 rounded-md animate-pulse" />
          </div>
        </div>
      </header>

      {/* Timeline Skeleton */}
      <main className="flex-1 px-4 py-6 max-w-[430px] mx-auto w-full flex flex-col animate-pulse">
        <div className="mb-4 px-1">
          <div className="h-3.5 w-36 bg-slate-200 rounded-md mb-1" />
          <div className="h-3 w-52 bg-slate-150 rounded-md" />
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="relative">
              <div className="absolute -left-6 top-3.5 w-5 h-5 rounded-full bg-slate-200" />
              <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col gap-2">
                <div className="flex justify-between">
                  <div className="h-4 w-20 bg-slate-200 rounded-md" />
                  <div className="h-4 w-4 bg-slate-200 rounded-md" />
                </div>
                <div className="h-3 w-40 bg-slate-200 rounded-md" />
                <div className="flex justify-between pt-1">
                  <div className="h-2.5 w-24 bg-slate-150 rounded-md" />
                  <div className="h-2.5 w-20 bg-slate-150 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

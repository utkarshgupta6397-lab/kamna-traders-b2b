import React from 'react';

export default function MobileNotesLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-screen">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white/20 animate-pulse" />
            <div className="h-5 w-20 bg-white/20 rounded-md animate-pulse" />
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-[430px] mx-auto w-full flex flex-col animate-pulse">
        {/* Search skeleton */}
        <div className="h-10 bg-slate-200 rounded-2xl mb-4" />

        {/* Filter pills skeleton */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-7 w-20 bg-slate-200 rounded-full" />
          <div className="h-7 w-20 bg-slate-100 rounded-full" />
          <div className="h-7 w-24 bg-slate-100 rounded-full" />
          <div className="h-7 w-16 bg-slate-100 rounded-full" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-36 rounded-[22px] bg-white border border-slate-100 p-4 flex flex-col justify-between shadow-xs"
            >
              <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
              <div className="flex flex-col gap-1.5 my-auto">
                <div className="h-3 w-full bg-slate-100 rounded-md" />
                <div className="h-3 w-4/5 bg-slate-100 rounded-md" />
              </div>
              <div className="h-3 w-1/2 bg-slate-200 rounded-md" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

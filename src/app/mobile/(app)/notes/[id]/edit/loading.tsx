import React from 'react';

export default function MobileEditNoteLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-screen">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white/20 animate-pulse" />
            <div className="h-5 w-20 bg-white/20 rounded-md animate-pulse" />
          </div>
          <div className="h-7 w-16 bg-white/20 rounded-full animate-pulse" />
        </div>
      </header>

      {/* Form Skeleton */}
      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full flex flex-col animate-pulse">
        {/* Title Input */}
        <div className="h-9 w-full bg-slate-200 rounded-lg mb-4" />

        {/* Note Type Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-10 bg-slate-200 rounded-md" />
          <div className="h-7 w-20 bg-slate-200 rounded-xl" />
          <div className="h-7 w-20 bg-slate-100 rounded-xl" />
        </div>

        {/* Content Area */}
        <div className="h-44 w-full bg-slate-200/70 rounded-xl mb-6" />

        {/* Color Picker */}
        <div className="pt-3 border-t border-slate-200 mb-5">
          <div className="h-3 w-16 bg-slate-200 rounded-md mb-2" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
            ))}
          </div>
        </div>

        {/* Sharing options */}
        <div className="pt-3 border-t border-slate-200">
          <div className="h-3 w-16 bg-slate-200 rounded-md mb-2" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-14 bg-slate-200 rounded-2xl" />
            <div className="h-14 bg-slate-200 rounded-2xl" />
            <div className="h-14 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </main>
    </div>
  );
}

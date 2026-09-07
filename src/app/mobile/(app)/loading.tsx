import React from 'react';

export default function MobileHomeLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <span className="font-bold tracking-wide text-sm">KAMNA ERP</span>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-[430px] mx-auto w-full flex flex-col animate-pulse">
        {/* Welcome Section */}
        <div className="mb-10">
          <div className="h-7 w-36 bg-slate-200 rounded-lg mb-2" />
          <div className="h-4 w-52 bg-slate-100 rounded-md" />
        </div>

        {/* Modules Section */}
        <div className="mb-4 text-[12px] font-black text-slate-400 tracking-widest uppercase">
          Modules
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-[340px] mx-auto w-full">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center aspect-square bg-white p-4 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 text-center"
            >
              <div className="w-[64px] h-[64px] rounded-[20px] bg-slate-100 flex items-center justify-center mb-3" />
              <div className="h-4 w-24 bg-slate-200 rounded-md" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

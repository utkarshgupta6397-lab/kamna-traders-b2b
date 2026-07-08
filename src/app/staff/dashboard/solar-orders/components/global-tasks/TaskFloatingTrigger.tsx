'use client';

import { useGlobalTaskDrawer } from './GlobalTaskDrawerProvider';
import { ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function TaskFloatingTrigger() {
  const { isOpen, toggleDrawer } = useGlobalTaskDrawer();
  const [badgeCount, setBadgeCount] = useState<number>(0);

  useEffect(() => {
    // Only fetch badge count periodically or initially when drawer is closed.
    // For MVP, we'll fetch once on mount.
    fetch('/api/solar-tasks?filter=ALL')
      .then(res => res.json())
      .then(data => {
        if (data.badgeCount !== undefined) setBadgeCount(data.badgeCount);
      })
      .catch(console.error);
  }, [isOpen]);

  if (isOpen) return null; // Hide trigger when drawer is open

  return (
    <button
      onClick={toggleDrawer}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1 bg-[#1A2766] hover:bg-blue-800 text-white p-2 py-4 rounded-l-lg shadow-lg border border-r-0 border-blue-900 transition-transform hover:-translate-x-1"
      title="Open Tasks"
    >
      <ClipboardList size={20} />
      <span className="text-xs font-bold [writing-mode:vertical-rl] tracking-widest mt-2">TASKS</span>
      {badgeCount > 0 && (
        <div className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow border-2 border-white">
          {badgeCount > 99 ? '99+' : badgeCount}
        </div>
      )}
    </button>
  );
}

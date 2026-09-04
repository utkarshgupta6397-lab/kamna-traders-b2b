'use client';
import { usePathname } from 'next/navigation';
import DispatchSidebar from './DispatchSidebar';
import React from 'react';

export default function DispatchLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReviewPage = pathname.includes('/review');
  const isIncomingPage = pathname.startsWith('/staff/dashboard/dispatch/incoming');

  if (isReviewPage || isIncomingPage) {
    return (
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 w-full">
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
      <DispatchSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}


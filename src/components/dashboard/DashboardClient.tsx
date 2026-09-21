'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardHeader from './DashboardHeader';
import DashboardKpiGrid from './DashboardKpiGrid';
import DashboardSectionTabs, { DashboardSectionId } from './DashboardSectionTabs';
import OverviewSection from './sections/OverviewSection';
import SalesSection from './sections/SalesSection';
import InventorySection from './sections/InventorySection';
import OperationsSection from './sections/OperationsSection';
import AccountsSection from './sections/AccountsSection';
import ActivitySection from './sections/ActivitySection';
import MotivationalQuoteBanner from './MotivationalQuoteBanner';

interface DashboardClientProps {
  userName?: string | null;
}

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function DashboardClient({ userName }: DashboardClientProps) {
  const [activeSection, setActiveSection] = useState<DashboardSectionId>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh handler: updates timestamp and shows subtle loading animation
  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    // Simulate architecture refresh call (ready for real API data fetching later)
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 500);
  }, [isRefreshing]);

  // Set up 5-minute auto refresh interval, and reset timer whenever handleRefresh is triggered
  useEffect(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }

    autoRefreshTimerRef.current = setInterval(() => {
      handleRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [handleRefresh]);

  return (
    <div className="w-full h-full flex flex-col justify-between gap-2 lg:gap-2.5 min-h-0">
      {/* 1. PERSISTENT TOP FRAME */}
      <div className="flex flex-col gap-2 shrink-0">
        {/* A. Header: Eyebrow Greeting + User Name + Subtle Last Updated & Refresh */}
        <DashboardHeader
          userName={userName}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {/* B. Persistent 6-KPI Row */}
        <section aria-label="Key Performance Indicators">
          <DashboardKpiGrid />
        </section>

        {/* C. Section Navigation Tabs (Left) + Compact Quick Actions (Right) */}
        <DashboardSectionTabs
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      {/* 2. DOMINANT MIDDLE AREA: SWITCHABLE SECTION WORKSPACE */}
      <main className="flex-1 min-h-0 overflow-hidden py-0.5" aria-label="Dashboard Content Area">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full w-full min-h-0"
          >
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'sales' && <SalesSection />}
            {activeSection === 'inventory' && <InventorySection />}
            {activeSection === 'operations' && <OperationsSection />}
            {activeSection === 'accounts' && <AccountsSection />}
            {activeSection === 'activity' && <ActivitySection />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 3. PERSISTENT STICKY BOTTOM FOOTER: PROMINENT MOTIVATIONAL QUOTE */}
      <footer aria-label="Today's Motivation" className="shrink-0 pt-0.5">
        <MotivationalQuoteBanner />
      </footer>
    </div>
  );
}

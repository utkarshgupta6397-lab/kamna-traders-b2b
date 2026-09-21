'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import {
  StaffSessionUser,
  getAccessibleDashboardSections,
  getNextRotatingSection,
} from '@/utils/dashboardSectionRotation';

interface DashboardClientProps {
  userName?: string | null;
  session?: StaffSessionUser | null;
}

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_THRESHOLD_MS = 60 * 1000; // 60 seconds
const ROTATION_INTERVAL_MS = 15 * 1000; // 15 seconds
const ACTIVITY_THROTTLE_MS = 1000; // Throttle mousemove listeners

export default function DashboardClient({ userName, session }: DashboardClientProps) {
  const [activeSection, setActiveSection] = useState<DashboardSectionId>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute authorized sections based on existing permissions
  const accessibleSections = useMemo(() => {
    return getAccessibleDashboardSections(session);
  }, [session]);

  // Keep a ref to accessibleSections and activeSection for timer callbacks without recreating intervals
  const accessibleSectionsRef = useRef<DashboardSectionId[]>(accessibleSections);
  accessibleSectionsRef.current = accessibleSections;

  const activeSectionRef = useRef<DashboardSectionId>(activeSection);
  activeSectionRef.current = activeSection;

  // Dedicated Idle & Auto-Rotation Controller Refs
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoRotatingRef = useRef<boolean>(false);
  const lastActivityTimeRef = useRef<number>(Date.now());

  // Function to stop rotation
  const stopAutoRotation = useCallback(() => {
    if (rotationIntervalRef.current) {
      clearInterval(rotationIntervalRef.current);
      rotationIntervalRef.current = null;
    }
    isAutoRotatingRef.current = false;
  }, []);

  // Function to advance to the next accessible section during auto-rotation
  const advanceToNextSection = useCallback(() => {
    const accessible = accessibleSectionsRef.current;
    if (accessible.length <= 1) {
      stopAutoRotation();
      return;
    }
    const nextSec = getNextRotatingSection(activeSectionRef.current, accessible);
    setActiveSection(nextSec);
  }, [stopAutoRotation]);

  // Function to start automatic rotation after 60s of inactivity
  const startAutoRotation = useCallback(() => {
    // Only rotate if there are at least 2 accessible sections
    if (accessibleSectionsRef.current.length <= 1) return;

    // Do not rotate if document is hidden
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    // Set flag and immediately advance to the next section
    isAutoRotatingRef.current = true;
    advanceToNextSection();

    // Setup 15-second rotation timer
    if (rotationIntervalRef.current) {
      clearInterval(rotationIntervalRef.current);
    }
    rotationIntervalRef.current = setInterval(() => {
      // Check visibility state before advancing
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        stopAutoRotation();
        return;
      }
      advanceToNextSection();
    }, ROTATION_INTERVAL_MS);
  }, [advanceToNextSection, stopAutoRotation]);

  // Function to schedule or reset the 60-second idle countdown
  const resetIdleTimer = useCallback(() => {
    // 1. Immediately stop any active rotation
    stopAutoRotation();

    // 2. Clear existing idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    // 3. Do not schedule if tab is hidden
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    // 4. Start fresh 60-second timer
    idleTimeoutRef.current = setTimeout(() => {
      startAutoRotation();
    }, IDLE_THRESHOLD_MS);
  }, [startAutoRotation, stopAutoRotation]);

  // Throttled activity handler for high-frequency user events (mousemove, keydown, touch, etc.)
  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    // If auto-rotation is running, stop immediately without waiting for throttle!
    if (isAutoRotatingRef.current) {
      lastActivityTimeRef.current = now;
      resetIdleTimer();
      return;
    }

    // Otherwise throttle the idle timer reset to once per second
    if (now - lastActivityTimeRef.current > ACTIVITY_THROTTLE_MS) {
      lastActivityTimeRef.current = now;
      resetIdleTimer();
    }
  }, [resetIdleTimer]);

  // Register user interaction and Page Visibility event listeners
  useEffect(() => {
    // Initial start of the 60-second idle timer
    resetIdleTimer();

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'pointerdown',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden: pause rotation and cancel idle countdown
        stopAutoRotation();
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = null;
        }
      } else {
        // Tab visible again: treat as user return and restart 60s countdown
        resetIdleTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
      }
    };
  }, [handleUserActivity, resetIdleTimer, stopAutoRotation]);

  // Section change handler (called on manual tab click)
  const handleSectionChange = useCallback(
    (newSection: DashboardSectionId) => {
      setActiveSection(newSection);
      resetIdleTimer();
    },
    [resetIdleTimer]
  );

  // Refresh handler: updates timestamp and shows subtle loading animation
  const handleRefresh = useCallback(() => {
    // User triggered refresh: reset idle timer
    resetIdleTimer();

    if (isRefreshing) return;

    setIsRefreshing(true);

    // Simulate architecture refresh call (ready for real API data fetching later)
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 500);
  }, [isRefreshing, resetIdleTimer]);

  // Set up 5-minute auto refresh interval
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
    <div className="w-full h-[calc(100vh-56px)] overflow-hidden flex flex-col gap-2 lg:gap-2.5 px-4 sm:px-6 py-2 min-h-0">
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
          onSectionChange={handleSectionChange}
        />
      </div>

      {/* 2. DOMINANT MIDDLE AREA: SWITCHABLE SECTION WORKSPACE */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col py-0.5" aria-label="Dashboard Content Area">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full w-full min-h-0 flex-1 flex flex-col motion-reduce:transition-none motion-reduce:transform-none"
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
      <footer aria-label="Today's Motivation" className="shrink-0 w-full pt-1.5 mt-auto">
        <MotivationalQuoteBanner />
      </footer>
    </div>
  );
}

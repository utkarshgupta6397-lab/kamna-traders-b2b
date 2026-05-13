'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Lightweight client-side component to maintain session heartbeat.
 * Triggers a non-blocking ping to /api/auth/session/heartbeat.
 * Throttle: Every 2 minutes while tab is active + on navigation.
 */
export default function SessionHeartbeat() {
  const pathname = usePathname();
  const lastPing = useRef<number>(0);

  const triggerHeartbeat = async () => {
    const now = Date.now();
    // Throttle client-side pings to once every 2 minutes
    if (now - lastPing.current < 120_000) return;

    try {
      lastPing.current = now;
      // Fire and forget (don't await)
      fetch('/api/auth/session/heartbeat', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
    } catch (err) {
      // Ignore
    }
  };

  // 1. Trigger on navigation
  useEffect(() => {
    triggerHeartbeat();
  }, [pathname]);

  // 2. Periodic trigger (every 2 mins)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerHeartbeat();
      }
    }, 120_000);

    return () => clearInterval(interval);
  }, []);

  return null; // Invisible component
}

'use client';

import { useState, useEffect } from 'react';

/**
 * Hook providing a single synchronized 1-second clock.
 * Eliminates per-row setInterval storms across large data tables.
 *
 * @param intervalMs Interval frequency in ms (defaults to 1000ms)
 * @param enabled Whether the ticker is actively running (defaults to true)
 * @returns Current timestamp in milliseconds (Date.now())
 */
export function useSharedClock(intervalMs: number = 1000, enabled: boolean = true): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    setNowMs(Date.now());

    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(timerId);
    };
  }, [intervalMs, enabled]);

  return nowMs;
}

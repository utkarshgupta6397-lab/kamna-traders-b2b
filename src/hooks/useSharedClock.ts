'use client';

import { useSyncExternalStore } from 'react';

// Singleton shared clock to ensure exactly ONE setInterval(1000) exists across the entire app
let sharedNow = Date.now();
const listeners = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (!timerId) {
    timerId = setInterval(() => {
      sharedNow = Date.now();
      listeners.forEach((cb) => cb());
    }, 1000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };
}

function getSnapshot() {
  return sharedNow;
}

function getServerSnapshot() {
  return 0;
}

const noopSubscribe = () => () => {};

/**
 * Hook providing a single synchronized 1-second clock across all subscribers.
 * Uses useSyncExternalStore backed by a singleton interval.
 * Eliminates per-component setInterval storms.
 *
 * @param _intervalMs Kept for backward compatibility (clock runs at 1000ms)
 * @param enabled Whether the ticker is actively subscribed (defaults to true)
 * @returns Current timestamp in milliseconds
 */
export function useSharedClock(_intervalMs: number = 1000, enabled: boolean = true): number {
  return useSyncExternalStore(
    enabled ? subscribe : noopSubscribe,
    getSnapshot,
    getServerSnapshot
  );
}


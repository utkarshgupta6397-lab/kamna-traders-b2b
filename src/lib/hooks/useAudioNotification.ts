'use client';

import { useCallback } from 'react';

/**
 * Reusable audio notification utility to play soft sounds safely in browsers.
 */
let hornAudio: HTMLAudioElement | null = null;

export function playTruckHornSound() {
  if (typeof window === 'undefined') return;

  try {
    if (!hornAudio) {
      hornAudio = new Audio('/sounds/truck-horn.wav');
      hornAudio.volume = 0.6; // soft and professional
    }

    hornAudio.currentTime = 0;
    const playPromise = hornAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay policy or user didn't interact yet - non-blocking
        console.warn('[useAudioNotification] Truck horn audio play restricted by browser:', err);
      });
    }
  } catch (e) {
    console.warn('[useAudioNotification] Error initializing truck horn audio:', e);
  }
}

export function useAudioNotification() {
  const playTruckHorn = useCallback(() => {
    playTruckHornSound();
  }, []);

  return { playTruckHorn };
}

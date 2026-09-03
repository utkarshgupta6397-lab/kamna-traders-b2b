'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export default function GlobalDispatchNotifier() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isEnabledRef = useRef(false);

  useEffect(() => {
    // Only run on client
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/dispatch-bell.wav');
      // Pre-load audio
      audioRef.current.load();
      
      // Auto-unlock audio on first interaction
      const handleInteraction = () => {
        isEnabledRef.current = true;
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
      };
      
      document.addEventListener('click', handleInteraction);
      document.addEventListener('keydown', handleInteraction);
      document.addEventListener('touchstart', handleInteraction);
      
      return () => {
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
      };
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isUnmounted = false;

    const connectSSE = () => {
      if (isUnmounted) return;
      
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === 'new_order' && data.order) {
            const order = data.order;
            
            // Deduplicate: Don't notify for the same ID twice in this session unless it's a repush
            const dedupeKey = order._isRePush ? `${order.zohoSalesorderId}_${order._rePushTimestamp}` : order.zohoSalesorderId;
            if (knownIdsRef.current.has(dedupeKey)) {
              return;
            }
            
            knownIdsRef.current.add(dedupeKey);

            // Toast Notification
            const soNum = order.salesorderNumber || order.zohoSalesorderId;
            toast.success(`New Sales Order Received\n${soNum} has been pushed to Dispatch.`, {
              duration: 5000,
              icon: '📥',
            });

            // Play Sound Twice
            if (audioRef.current) {
              audioRef.current.play().catch(err => {
                console.warn('[GlobalDispatchNotifier] Audio play restricted by browser:', err);
              });
              
              setTimeout(() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(err => {
                    console.warn('[GlobalDispatchNotifier] Second audio play restricted by browser:', err);
                  });
                }
              }, 800);
            }
          }
        } catch (err) {
          console.error('[GlobalDispatchNotifier] Message parse error:', err);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
        }
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      };
    };

    connectSSE();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return null;
}

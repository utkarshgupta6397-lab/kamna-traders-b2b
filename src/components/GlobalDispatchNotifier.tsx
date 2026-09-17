'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { playDispatchChime } from '@/lib/dispatch-audio';
import { speakInvoiceCreated } from '@/lib/voice-notifications';

export default function GlobalDispatchNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isDispatchQueuePage = pathname === '/staff/dashboard/dispatch/incoming';

  // Voice preloading and initialization when authenticated ERP app mounts
  useEffect(() => {
    console.log(`[VOICE DEBUG] GlobalDispatchNotifier mounted (pathname: ${pathname})`);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const voices = window.speechSynthesis.getVoices();
        console.log(`[VOICE DEBUG] Initial speech voice count: ${voices.length}`);
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => {
            const updated = window.speechSynthesis.getVoices();
            console.log(`[VOICE DEBUG] voiceschanged fired: ${updated.length} voices available`);
          };
        }
      } catch (err) {
        console.warn('[VOICE DEBUG] Voice preload error:', err);
      }
    }
  }, [pathname]);

  useEffect(() => {
    console.log(`[VOICE DEBUG] GlobalDispatchNotifier SSE effect running. isDispatchQueuePage=${isDispatchQueuePage}`);

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;
    let reconnectAttempts = 0;

    // 1. Establish baseline from existing queue so existing rows never play bell sound
    const initBaselineAndSSE = async () => {
      try {
        const res = await fetch('/api/dispatch/incoming-queue');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            json.data.forEach((o: { zohoSalesorderId?: string; id?: string }) => {
              if (o.zohoSalesorderId) knownIdsRef.current.add(o.zohoSalesorderId);
              if (o.id) knownIdsRef.current.add(o.id);
            });
          }
        }
      } catch (err) {
        console.warn('[GlobalDispatchNotifier] Baseline fetch failed:', err);
      } finally {
        if (!isUnmounted) {
          connectSSE();
        }
      }
    };

    const connectSSE = () => {
      if (isUnmounted) return;
      if (eventSource) {
        try { eventSource.close(); } catch {}
        eventSource = null;
      }
      
      console.log(`[VOICE DEBUG] Opening EventSource to /api/dispatch/incoming-queue/events`);
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');

      eventSource.onopen = () => {
        console.log(`[VOICE DEBUG] SSE EventSource connection opened on client`);
        reconnectAttempts = 0;
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === 'new_order' && data.order) {
            const order = data.order;
            
            // Deduplicate: Don't notify for the same ID twice in this session unless it's a repush
            const dedupeKey = order._isRePush ? `${order.zohoSalesorderId}_${order._rePushTimestamp}` : order.zohoSalesorderId;
            if (knownIdsRef.current.has(dedupeKey) || knownIdsRef.current.has(order.zohoSalesorderId)) {
              return;
            }
            
            knownIdsRef.current.add(dedupeKey);
            if (order.zohoSalesorderId) knownIdsRef.current.add(order.zohoSalesorderId);
            if (order.id) knownIdsRef.current.add(order.id);

            // If user is already on the dispatch incoming table, that table manages its own rows and chime
            if (isDispatchQueuePage) return;

            // Toast Notification
            const soNum = order.salesorderNumber || (order.zohoSalesorderId ? `SO-${order.zohoSalesorderId}` : 'New Sales Order');

            toast.custom(
              (t) => (
                <div
                  role="alert"
                  className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-white shadow-xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 border-l-4 border-[#1A2766] overflow-hidden cursor-pointer hover:bg-slate-50/80 transition-all`}
                  onClick={() => {
                    toast.dismiss(t.id);
                    const targetId = order.id || order.zohoSalesorderId;
                    router.push(`/staff/dashboard/dispatch/incoming?highlight=${encodeURIComponent(targetId)}`);
                  }}
                >
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5 text-2xl">
                        📥
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-bold text-gray-900">
                          New Sales Order Received
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#1A2766]">
                          {soNum}
                        </p>
                        <p className="text-xs text-gray-500">
                          Pushed to Dispatch. Click to open incoming queue.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-gray-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.dismiss(t.id);
                      }}
                      className="w-full border border-transparent rounded-none rounded-r-lg p-3 flex items-center justify-center text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ),
              {
                id: `so-${dedupeKey}`,
                duration: 8000,
              }
            );

            // Play Sound Twice using robust shared audio manager
            playDispatchChime();
          }

          if (data.type === 'update_order' && data.order) {
            const order = data.order;
            // If we previously displayed a placeholder with just zohoSalesorderId, update existing toast if open
            if (order.salesorderNumber && order.zohoSalesorderId) {
              const dedupeKey = order.zohoSalesorderId;
              const toastId = `so-${dedupeKey}`;
              const soNum = order.salesorderNumber;

              toast.custom(
                (t) => (
                  <div
                    role="alert"
                    className={`${
                      t.visible ? 'animate-enter' : 'animate-leave'
                    } max-w-md w-full bg-white shadow-xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 border-l-4 border-[#1A2766] overflow-hidden cursor-pointer hover:bg-slate-50/80 transition-all`}
                    onClick={() => {
                      toast.dismiss(t.id);
                      const targetId = order.id || order.zohoSalesorderId;
                      router.push(`/staff/dashboard/dispatch/incoming?highlight=${encodeURIComponent(targetId)}`);
                    }}
                  >
                    <div className="flex-1 w-0 p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5 text-2xl">
                          📥
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-bold text-gray-900">
                            New Sales Order Received
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#1A2766]">
                            {soNum}
                          </p>
                          <p className="text-xs text-gray-500">
                            Pushed to Dispatch. Click to open incoming queue.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-l border-gray-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.dismiss(t.id);
                        }}
                        className="w-full border border-transparent rounded-none rounded-r-lg p-3 flex items-center justify-center text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors"
                        title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ),
                {
                  id: toastId,
                  duration: 8000,
                }
              );
            }
          }

          if (data.type === 'truck_upload' && data.data) {
            const upload = data.data;
            const dedupeKey = `truck_${upload.uploadId || upload.salesOrderId}`;
            if (knownIdsRef.current.has(dedupeKey)) {
              return;
            }
            knownIdsRef.current.add(dedupeKey);

            if (isDispatchQueuePage) return;

            const soNum = upload.salesOrderNumber || 'Sales Order';
            const cust = upload.customerName ? ` - ${upload.customerName}` : '';
            toast.custom(
              (t) => (
                <div
                  role="alert"
                  className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-white shadow-xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 border-l-4 border-purple-600 overflow-hidden cursor-pointer hover:bg-slate-50/80 transition-all`}
                  onClick={() => {
                    toast.dismiss(t.id);
                    router.push('/staff/dashboard/dispatch/incoming');
                  }}
                >
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5 text-2xl">
                        🚚
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-bold text-gray-900">
                          Truck Details Uploaded
                        </p>
                        <p className="mt-1 text-xs font-semibold text-purple-700">
                          {soNum}{cust}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-gray-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.dismiss(t.id);
                      }}
                      className="w-full border border-transparent rounded-none rounded-r-lg p-3 flex items-center justify-center text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ),
              {
                id: dedupeKey,
                duration: 8000,
              }
            );

            // Play notification sound once
            playDispatchChime();
          }

          // [PHASE 1 RESET] Voice notification disabled in GlobalDispatchNotifier
          // if (data.type === 'invoice_created') { ... }
        } catch (err) {
          console.error('[GlobalDispatchNotifier] Message parse error:', err);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          try { eventSource.close(); } catch {}
          eventSource = null;
        }
        if (!isUnmounted) {
          reconnectAttempts++;
          const delay = Math.min(30000, 3000 * Math.pow(1.5, Math.min(reconnectAttempts, 6)));
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, delay);
        }
      };
    };

    initBaselineAndSSE();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        try { eventSource.close(); } catch {}
      }
    };
  }, [isDispatchQueuePage]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { playNotificationSound } from '@/lib/dispatch-audio';

/**
 * Bounded deduplication set to avoid unbounded memory growth
 * while providing reliable idempotency across route transitions.
 */
class BoundedDeduplicationSet {
  private maxSize: number;
  private set: Set<string>;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.set = new Set();
  }

  has(key: string): boolean {
    return this.set.has(key);
  }

  add(key: string): void {
    if (this.set.has(key)) return;
    if (this.set.size >= this.maxSize) {
      const firstKey = this.set.keys().next().value;
      if (firstKey !== undefined) {
        this.set.delete(firstKey);
      }
    }
    this.set.add(key);
  }

  clear(): void {
    this.set.clear();
  }
}

// Module-level deduplication cache persisting across component remounts within the browser tab session
const globalDedupeSet = new BoundedDeduplicationSet(500);

export default function GlobalDispatchNotifier() {
  const router = useRouter();
  const pathname = usePathname();

  // Voice preloading and initialization when authenticated ERP app mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
          };
        }
      } catch (err) {
        console.warn('[Voice] Voice preload error:', err);
      }
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;
    let reconnectAttempts = 0;

    // 1. Establish baseline from existing queue so existing rows never trigger notifications or sounds
    const initBaselineAndSSE = async () => {
      try {
        const res = await fetch('/api/dispatch/incoming-queue');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            json.data.forEach((o: { zohoSalesorderId?: string; id?: string }) => {
              if (o.zohoSalesorderId) {
                globalDedupeSet.add(o.zohoSalesorderId);
                globalDedupeSet.add(`new_so_${o.zohoSalesorderId}`);
              }
              if (o.id) {
                globalDedupeSet.add(o.id);
                globalDedupeSet.add(`new_so_${o.id}`);
              }
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
      
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // ==========================================
          // 1. NEW SALES ORDER / NEW PUSH EVENT
          // ==========================================
          if (data.type === 'new_order' && data.order) {
            const order = data.order;
            
            // Canonical Deduplication Key
            const dedupeKey = order._isRePush
              ? `new_so_${order.zohoSalesorderId}_${order._rePushTimestamp}`
              : `new_so_${order.zohoSalesorderId || order.id}`;

            if (
              globalDedupeSet.has(dedupeKey) ||
              (!order._isRePush && order.zohoSalesorderId && globalDedupeSet.has(`new_so_${order.zohoSalesorderId}`))
            ) {
              return;
            }
            
            globalDedupeSet.add(dedupeKey);
            if (order.zohoSalesorderId) globalDedupeSet.add(`new_so_${order.zohoSalesorderId}`);
            if (order.id) globalDedupeSet.add(`new_so_${order.id}`);

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
                id: dedupeKey,
                duration: 8000,
              }
            );

            // Play Sound Policy: TWO chimes for new push
            playNotificationSound('NEW_PUSH');
          }

          // ==========================================
          // 2. ORDER UPDATE EVENT (DATA SYNC ONLY)
          // ==========================================
          // update_order is purely for updating active row state on tables.
          // It MUST NEVER display a new sales order toast or play sounds.
          if (data.type === 'update_order') {
            return;
          }

          // ==========================================
          // 3. TRUCK PHOTO UPLOAD EVENT
          // ==========================================
          if (data.type === 'truck_upload' && data.data) {
            const upload = data.data;
            const dedupeKey = `truck_${upload.uploadId || upload.salesOrderId}`;
            if (globalDedupeSet.has(dedupeKey)) {
              return;
            }
            globalDedupeSet.add(dedupeKey);

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

            // Play Sound Policy: Exactly ONE chime for truck photo upload
            playNotificationSound('TRUCK_PHOTO_UPLOADED');
          }
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
  }, []); // Run once on layout mount, establishing a single stable SSE connection across page navigation

  return null;
}

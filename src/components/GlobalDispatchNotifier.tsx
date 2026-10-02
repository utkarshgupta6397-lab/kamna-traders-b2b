'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { playNotificationSound, getDispatchAudioManager } from '@/lib/dispatch-audio';
import { getOrderStage } from '@/lib/pre-dispatch-status';
import { updateFaviconBadge } from '@/lib/favicon-badge';

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

/**
 * Canonical test to determine if an order is currently in:
 * Dispatch -> Pre-Dispatch -> Active -> NOT YET ACCEPTED
 */
export function isUnacceptedActivePreDispatch(order: {
  status: string;
  total?: number | null;
  preDispatchWorkflow?: any | null;
}): boolean {
  if (order.status !== 'NEW') return false;
  if (getOrderStage(order) === 'archived') return false;
  return !order.preDispatchWorkflow?.acceptedAt;
}

export default function GlobalDispatchNotifier() {
  const router = useRouter();

  // Map of known orders: id/zohoSalesorderId -> order
  const ordersMapRef = useRef<Map<string, any>>(new Map());

  // Current unaccepted count in Pre-Dispatch -> Active
  const [unacceptedCount, setUnacceptedCount] = useState<number>(0);

  // Document title base
  const originalTitleRef = useRef<string>('Kamna Traders');

  // Permission prompt banner state
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  // Helper to recompute count from ordersMap
  const recalculateCount = useCallback(() => {
    let count = 0;
    ordersMapRef.current.forEach((order) => {
      if (isUnacceptedActivePreDispatch(order)) {
        count++;
      }
    });
    setUnacceptedCount(count);
  }, []);

  // Capture original title on mount if available
  useEffect(() => {
    if (typeof document !== 'undefined' && document.title && !document.title.startsWith('🚚')) {
      originalTitleRef.current = document.title;
    }
  }, []);

  // Synchronize document.title and Favicon Badge with unaccepted count
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const baseTitle = originalTitleRef.current || 'Kamna Traders';
    if (unacceptedCount > 0) {
      document.title = `🚚 ${unacceptedCount} — ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }

    // Update Favicon badge (Kamna logo + unaccepted count indicator)
    updateFaviconBadge(unacceptedCount);

    return () => {
      if (typeof document !== 'undefined') {
        document.title = originalTitleRef.current || 'Kamna Traders';
        updateFaviconBadge(0);
      }
    };
  }, [unacceptedCount]);

  // Check Notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Show non-intrusive prompt banner
        setShowPermissionBanner(true);
      }
    }
  }, []);

  // Request browser notification permission on user gesture
  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          toast.success('Browser notifications enabled for incoming orders.');
        }
      } catch (err) {
        console.warn('[Notification] Permission request error:', err);
      } finally {
        setShowPermissionBanner(false);
      }
    }
    // Also unlock audio via user gesture
    getDispatchAudioManager().unlockAudio();
  };

  // Helper to display native browser notification for genuine new order
  const showNativeBrowserNotification = (order: any, dedupeKey: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const soNum = order.salesorderNumber || (order.zohoSalesorderId ? `SO-${order.zohoSalesorderId}` : 'New Sales Order');
      const cust = order.customerName ? ` • ${order.customerName}` : '';
      const notification = new Notification(`🚚 New Incoming Sales Order`, {
        body: `${soNum}${cust}\nPushed to Pre-Dispatch. Click to review.`,
        icon: '/logo.svg',
        tag: dedupeKey,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        const targetId = order.id || order.zohoSalesorderId;
        router.push(`/staff/dashboard/dispatch/incoming?highlight=${encodeURIComponent(targetId)}`);
      };
    } catch (err) {
      console.warn('[Notification] Error creating native browser notification:', err);
    }
  };

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

  // Single persistent SSE connection + Queue Hydration
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;
    let reconnectAttempts = 0;

    // 1. Establish baseline queue state on load
    const initBaselineAndSSE = async () => {
      try {
        const res = await fetch('/api/dispatch/incoming-queue');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            // Populate ordersMap
            json.data.forEach((o: any) => {
              const key = o.id || o.zohoSalesorderId;
              ordersMapRef.current.set(key, o);

              // Mark baseline orders in dedupe set so they never trigger sounds/toasts/browser alerts
              if (o.zohoSalesorderId) {
                globalDedupeSet.add(o.zohoSalesorderId);
                globalDedupeSet.add(`new_so_${o.zohoSalesorderId}`);
              }
              if (o.id) {
                globalDedupeSet.add(o.id);
                globalDedupeSet.add(`new_so_${o.id}`);
              }
            });

            // Immediately set the canonical count from current queue state
            recalculateCount();
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
            const orderKey = order.id || order.zohoSalesorderId;

            // Update queue state first (authoritative source of truth)
            ordersMapRef.current.set(orderKey, order);
            recalculateCount();

            // Canonical Deduplication Key for notification event
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

            // In-app Toast Notification
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

            // Native Browser Notification API (if permission granted)
            showNativeBrowserNotification(order, dedupeKey);

            // Play Sound Policy: TWO chimes for new push
            playNotificationSound('NEW_PUSH');
          }

          // ==========================================
          // 2. ORDER UPDATE EVENT (STATE RECONCILIATION)
          // ==========================================
          if (data.type === 'update_order' && data.order) {
            const updated = data.order;
            const orderKey = updated.id || updated.zohoSalesorderId;

            // Merge update into ordersMap
            const existing = ordersMapRef.current.get(orderKey) || {};
            ordersMapRef.current.set(orderKey, {
              ...existing,
              ...updated,
              preDispatchWorkflow: updated.preDispatchWorkflow !== undefined
                ? updated.preDispatchWorkflow
                : existing.preDispatchWorkflow,
            });

            // Recalculate unaccepted active count (e.g. order accepted, archived, sent back)
            recalculateCount();
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
  }, [recalculateCount, router]);

  if (!showPermissionBanner) return null;

  // Permission prompt banner rendered discreetly at the bottom right
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-gray-200 rounded-xl shadow-xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-50 text-[#1A2766] flex items-center justify-center shrink-0 mt-0.5">
        <Bell size={16} />
      </div>
      <div className="flex-1 text-xs">
        <p className="font-bold text-gray-900">Enable Order Notifications</p>
        <p className="text-gray-500 mt-0.5">
          Get sound alerts and desktop notifications when new sales orders arrive in Dispatch.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-2.5 py-1 bg-[#1A2766] text-white rounded font-semibold text-xs hover:bg-[#152055] transition-colors"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={() => setShowPermissionBanner(false)}
            className="px-2 py-1 text-gray-500 hover:text-gray-700 font-medium text-xs transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowPermissionBanner(false)}
        className="text-gray-400 hover:text-gray-600 p-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

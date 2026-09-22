'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PieChart, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { formatElapsed, ActivePreDispatchOrderItem } from '@/lib/pre-dispatch-status';

interface OrderStatusCardProps {
  onRefreshParent?: () => void;
}

export default function OrderStatusCard({ onRefreshParent }: OrderStatusCardProps = {}) {
  const [orders, setOrders] = useState<ActivePreDispatchOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/pre-dispatch-active');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.orders)) {
          setOrders(json.orders);
          setIsError(false);
          setErrorMessage('');
        } else {
          setIsError(true);
          setErrorMessage('Unable to load active orders');
        }
      } else if (res.status === 403) {
        setIsError(true);
        setErrorMessage('Pre-Dispatch access required');
      } else {
        setIsError(true);
        setErrorMessage('Unable to load active orders');
      }
    } catch {
      setIsError(true);
      setErrorMessage('Unable to load active orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchActiveOrders();
  }, [fetchActiveOrders]);

  // 60-second dataset auto-refresh
  useEffect(() => {
    const dataInterval = setInterval(() => {
      fetchActiveOrders();
    }, 60 * 1000);

    return () => clearInterval(dataInterval);
  }, [fetchActiveOrders]);

  // 60-second live timer tick to increment elapsed durations
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);

    return () => clearInterval(clockInterval);
  }, []);

  return (
    <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
      {/* 1. Header: Icon, Title, Subtitle, Active Count Badge, and Link */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <PieChart size={14} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-800 truncate">Order Status</h2>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-slate-500 font-medium">Pre-Dispatch · Active</p>
              {!isLoading && !isError && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                  {orders.length}
                </span>
              )}
            </div>
          </div>
        </div>

        <Link
          href="/staff/dashboard/dispatch/incoming"
          className="text-[10px] font-semibold text-[#1A2766] hover:underline shrink-0"
        >
          View All →
        </Link>
      </div>

      {/* 2. Main Content Area: Scrollable Compact Operational Rows */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto divide-y divide-slate-100 pr-0.5 py-1">
        {isLoading ? (
          // Neutral Loading Skeleton State
          <div className="space-y-3 py-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-1 py-1">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="space-y-1.5 flex flex-col items-end shrink-0">
                  <div className="h-3.5 bg-slate-200 rounded w-16" />
                  <div className="h-2.5 bg-slate-100 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          // Error State
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center p-3">
            <AlertCircle size={18} className="text-amber-500" />
            <p className="text-xs font-semibold text-slate-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                fetchActiveOrders();
                onRefreshParent?.();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          </div>
        ) : orders.length === 0 ? (
          // Empty State (No active orders)
          <div className="h-full w-full flex items-center justify-center p-4">
            <p className="text-xs font-medium text-slate-500">No active orders</p>
          </div>
        ) : (
          // Active Pre-Dispatch Operational Rows
          orders.map((order) => {
            const baseMs = new Date(order.baseTimestamp).getTime();
            const elapsedSeconds = Math.max(0, Math.floor((nowMs - baseMs) / 1000));
            const elapsedText = formatElapsed(elapsedSeconds);

            return (
              <Link
                key={order.id}
                href={`/staff/dashboard/dispatch/incoming?highlight=${order.id}`}
                className="group block py-2 px-1 hover:bg-slate-50/90 rounded-lg transition-colors duration-150 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Left: Customer Name + Source Warehouse */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-xs font-semibold text-slate-800 group-hover:text-blue-900 truncate"
                      title={order.customerName}
                    >
                      {order.customerName}
                    </div>
                    <div
                      className="text-[10px] text-slate-500 font-medium truncate mt-0.5"
                      title={order.warehouse}
                    >
                      {order.warehouse}
                    </div>
                  </div>

                  {/* Right: Current Workflow Status + Waiting Timer */}
                  <div className="flex flex-col items-end shrink-0 pl-1">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${order.stageBadge.className}`}
                    >
                      {order.stageBadge.label}
                    </span>
                    <div className="flex items-center gap-1 mt-1 text-right">
                      <span className="text-[11px] font-bold font-mono text-slate-800 tabular-nums">
                        {elapsedText}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 tabular-nums">
                      {order.formattedTimestamp}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* 3. Footer: Live Sync Indicator */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <span>Real-time dispatch sync</span>
        <span className="text-[9px] text-slate-400">Updates every 60s</span>
      </div>
    </div>
  );
}

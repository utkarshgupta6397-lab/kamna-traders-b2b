'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  X,
  ExternalLink,
  Clock,
  Zap,
  User,
  AlertTriangle,
  CheckCircle2,
  GripVertical,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScheduledOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  systemSize: number;
  installationDate: string;
  salesman: string | null;
  currentStage: string;
  pct: number;
  status: string;
}

interface QueueOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phoneNumber: string;
  systemSize: number;
  orderDate: string;
  daysSinceOrder: number;
  salesman: string | null;
  currentStage: string;
  pct: number;
  status: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface DayDrawer {
  date: Date;
  orders: ScheduledOrder[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDateLabel(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

// Color palette for customer chips — cycles by hash of id
const CHIP_COLORS = [
  'bg-teal-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-teal-600',
  'bg-emerald-600',
  'bg-cyan-600',
  'bg-teal-400',
  'bg-emerald-400',
];
function chipColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xfffffff;
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

function priorityClass(days: number): string {
  if (days > 30) return 'border-red-300 bg-red-50';
  if (days > 14) return 'border-orange-300 bg-orange-50';
  return 'border-teal-200 bg-white';
}

function priorityDot(days: number): string {
  if (days > 30) return 'bg-red-500';
  if (days > 14) return 'bg-orange-400';
  return 'bg-teal-500';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CalendarPageClient({ canEdit }: { canEdit: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [scheduled, setScheduled] = useState<ScheduledOrder[]>([]);
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [drawer, setDrawer] = useState<DayDrawer | null>(null);
  const [dragSource, setDragSource] = useState<
    { type: 'queue'; orderId: string } | { type: 'calendar'; orderId: string; fromDate: string } | null
  >(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; orderId: string; fromDate: string;
  } | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helpers ────────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Data fetch ───────────────────────────────────────────────────────────
  const fetchData = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const params = new URLSearchParams({ from, to });
      if (searchQuery) params.set('search', searchQuery);

      try {
        const res = await fetch(`/api/solar-orders/calendar?${params}`);
        if (!res.ok) throw new Error('Failed to load calendar data');
        const data = await res.json();
        setScheduled(data.scheduled ?? []);
        setQueue(data.queue ?? []);
      } catch (e: any) {
        addToast(e.message, 'error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [viewDate, searchQuery, addToast]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Debounced search ─────────────────────────────────────────────────────
  const handleSearch = (val: string) => {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchData(), 400);
  };

  // ── Calendar grid ────────────────────────────────────────────────────────
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(year, month, d));
  while (calendarDays.length < totalCells) calendarDays.push(null);

  // Group scheduled orders by date string
  const scheduledByDate: Record<string, ScheduledOrder[]> = {};
  for (const o of scheduled) {
    const key = isoDate(new Date(o.installationDate));
    if (!scheduledByDate[key]) scheduledByDate[key] = [];
    scheduledByDate[key].push(o);
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = (
    e: React.DragEvent,
    source: typeof dragSource
  ) => {
    setDragSource(source);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  };

  const handleDragLeave = () => setDragOverDate(null);

  const handleDropOnDate = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!dragSource || !canEdit) return;

    const orderId = dragSource.orderId;
    const dateStr = isoDate(targetDate);

    // Optimistic update
    if (dragSource.type === 'queue') {
      const order = queue.find((o) => o.id === orderId);
      if (!order) return;
      setQueue((prev) => prev.filter((o) => o.id !== orderId));
      setScheduled((prev) => [
        ...prev,
        {
          ...order,
          installationDate: targetDate.toISOString(),
        } as ScheduledOrder,
      ]);
    } else {
      setScheduled((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, installationDate: targetDate.toISOString() } : o
        )
      );
      // Update drawer if open
      if (drawer) {
        setDrawer((d) =>
          d
            ? {
                ...d,
                orders: d.orders.map((o) =>
                  o.id === orderId ? { ...o, installationDate: targetDate.toISOString() } : o
                ),
              }
            : null
        );
      }
    }

    try {
      const res = await fetch('/api/solar-orders/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, installationDate: targetDate.toISOString() }),
      });
      if (!res.ok) throw new Error('Failed to schedule');
      addToast(`Installation scheduled for ${formatDateLabel(targetDate)}`);
    } catch {
      addToast('Failed to schedule installation', 'error');
      fetchData(true);
    }
    setDragSource(null);
  };

  const handleDropOnQueue = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!dragSource || dragSource.type !== 'calendar' || !canEdit) return;

    const orderId = dragSource.orderId;
    const order = scheduled.find((o) => o.id === orderId);
    if (!order) return;

    // Optimistic update
    setScheduled((prev) => prev.filter((o) => o.id !== orderId));
    setQueue((prev) => [
      {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phoneNumber: '',
        systemSize: order.systemSize,
        orderDate: new Date().toISOString(),
        daysSinceOrder: 0,
        salesman: order.salesman,
        currentStage: order.currentStage,
        pct: order.pct,
        status: order.status,
      },
      ...prev,
    ]);

    try {
      const res = await fetch('/api/solar-orders/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, installationDate: null }),
      });
      if (!res.ok) throw new Error('Failed to unschedule');
      addToast('Installation removed from calendar');
    } catch {
      addToast('Failed to unschedule', 'error');
      fetchData(true);
    }
    setDragSource(null);
  };

  // ── Context menu (right-click to unschedule) ──────────────────────────────
  const handleChipRightClick = (
    e: React.MouseEvent,
    orderId: string,
    fromDate: string
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, orderId, fromDate });
  };

  const dismissContextMenu = () => setContextMenu(null);

  const handleRemoveSchedule = async () => {
    if (!contextMenu || !canEdit) return;
    const { orderId } = contextMenu;
    dismissContextMenu();

    const order = scheduled.find((o) => o.id === orderId);
    if (!order) return;

    setScheduled((prev) => prev.filter((o) => o.id !== orderId));
    setQueue((prev) => [
      {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phoneNumber: '',
        systemSize: order.systemSize,
        orderDate: new Date().toISOString(),
        daysSinceOrder: 0,
        salesman: order.salesman,
        currentStage: order.currentStage,
        pct: order.pct,
        status: order.status,
      },
      ...prev,
    ]);
    if (drawer) {
      setDrawer((d) =>
        d ? { ...d, orders: d.orders.filter((o) => o.id !== orderId) } : null
      );
    }

    try {
      await fetch('/api/solar-orders/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, installationDate: null }),
      });
      addToast('Installation removed from calendar');
    } catch {
      addToast('Failed to remove', 'error');
      fetchData(true);
    }
  };

  // ── Prev / Next / Today ───────────────────────────────────────────────────
  const goPrev = () => setViewDate(new Date(year, month - 1, 1));
  const goNext = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex gap-4 relative"
      style={{ minHeight: '80vh' }}
      onClick={dismissContextMenu}
    >
      {/* ── LEFT: Calendar (70%) ──────────────────────────────────────────── */}
      <div className="flex-[7] min-w-0 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={goPrev}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 min-w-[180px] text-center">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              onClick={goNext}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="border-t border-r border-gray-100 bg-gray-50/50 min-h-[110px]"
                  />
                );
              }

              const dateStr = isoDate(date);
              const dayOrders = scheduledByDate[dateStr] ?? [];
              const isToday = dateStr === isoDate(today);
              const isPast = date < today;
              const isOver = dragOverDate === dateStr;

              return (
                <div
                  key={dateStr}
                  className={`border-t border-r border-gray-100 min-h-[110px] p-2 transition-colors
                    ${isOver ? 'bg-teal-50 ring-2 ring-inset ring-teal-400' : ''}
                    ${!isOver && isPast ? 'bg-gray-50/30' : ''}
                    ${!isOver && !isPast ? 'hover:bg-emerald-50/30' : ''}
                  `}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDate(e, date)}
                  onClick={() => {
                    if (dayOrders.length > 0) {
                      setDrawer({ date, orders: dayOrders });
                    }
                  }}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors
                        ${isToday ? 'bg-teal-600 text-white' : 'text-gray-700'}
                      `}
                    >
                      {date.getDate()}
                    </span>
                    {dayOrders.length > 0 && (
                      <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100">
                        {dayOrders.length}
                      </span>
                    )}
                  </div>

                  {/* Chips */}
                  <div className="flex flex-col gap-1">
                    {dayOrders.slice(0, 3).map((o) => (
                      <div
                        key={o.id}
                        draggable={canEdit}
                        onDragStart={(e) =>
                          handleDragStart(e, {
                            type: 'calendar',
                            orderId: o.id,
                            fromDate: dateStr,
                          })
                        }
                        onContextMenu={(e) =>
                          canEdit && handleChipRightClick(e, o.id, dateStr)
                        }
                        onClick={(e) => e.stopPropagation()}
                        title={`${o.customerName} — ${o.systemSize} kW\n${o.currentStage}`}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-[10px] font-semibold truncate cursor-grab active:cursor-grabbing select-none ${chipColor(o.id)}`}
                      >
                        <span className="truncate">{o.customerName}</span>
                      </div>
                    ))}
                    {dayOrders.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawer({ date, orders: dayOrders });
                        }}
                        className="text-[10px] font-semibold text-teal-700 hover:underline text-left"
                      >
                        +{dayOrders.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Queue (30%) ────────────────────────────────────────────── */}
      <div className="flex-[3] min-w-0 flex flex-col gap-3">
        {/* Queue header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-teal-50 rounded-lg">
              <CalendarDays size={16} className="text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Installation Queue</h3>
              <p className="text-[11px] text-gray-500">Unscheduled orders</p>
            </div>
            <span className="ml-auto text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
              {queue.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="Search customer, order, phone..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all"
            />
          </div>
        </div>

        {/* Drop zone for unscheduling */}
        <div
          className={`rounded-xl border-2 border-dashed transition-all text-center py-2 text-xs font-semibold
            ${dragSource?.type === 'calendar'
              ? 'border-orange-400 bg-orange-50 text-orange-600'
              : 'border-gray-200 bg-gray-50/50 text-gray-400'
            }`}
          onDragOver={(e) => {
            if (dragSource?.type === 'calendar') e.preventDefault();
          }}
          onDrop={handleDropOnQueue}
        >
          {dragSource?.type === 'calendar' ? '⬅ Drop here to unschedule' : 'Drop here to remove from calendar'}
        </div>

        {/* Queue cards */}
        <div
          className="flex flex-col gap-2 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 320px)' }}
        >
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" />
              Loading...
            </div>
          )}
          {!isLoading && queue.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <CheckCircle2 size={32} className="text-teal-400" />
              <p className="text-sm font-semibold text-gray-500">All orders scheduled!</p>
            </div>
          )}
          {queue.map((order) => (
            <div
              key={order.id}
              draggable={canEdit}
              onDragStart={(e) =>
                handleDragStart(e, { type: 'queue', orderId: order.id })
              }
              className={`rounded-xl border p-3 cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-md ${priorityClass(order.daysSinceOrder)}`}
            >
              <div className="flex items-start gap-2">
                <GripVertical size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  {/* Name + priority dot */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot(order.daysSinceOrder)}`} />
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {order.customerName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
                    <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[10px]">
                      {order.orderNumber}
                    </span>
                    <span>·</span>
                    <Zap size={10} className="text-amber-500" />
                    <span className="font-semibold text-gray-700">{order.systemSize} kW</span>
                  </div>

                  {order.salesman && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-1">
                      <User size={10} />
                      <span className="truncate">{order.salesman}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-teal-700 font-medium truncate mb-1">
                    <span className="truncate">{order.currentStage}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Progress bar */}
                    <div className="flex items-center gap-1.5 flex-1">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all"
                          style={{ width: `${order.pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{order.pct}%</span>
                    </div>

                    <div className="flex items-center gap-1 ml-2 text-[10px] text-gray-400">
                      <Clock size={9} />
                      <span>{order.daysSinceOrder}d</span>
                      {order.daysSinceOrder > 30 && (
                        <AlertTriangle size={10} className="text-red-500 ml-0.5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Day Drawer ────────────────────────────────────────────────────── */}
      {drawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={() => setDrawer(null)}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-emerald-50">
              <div>
                <div className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-0.5">
                  Installations
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {formatDateLabel(drawer.date)}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {drawer.orders.length} scheduled
                </p>
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {drawer.orders.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                  No installations on this date.
                </div>
              )}
              {drawer.orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`w-2 h-2 rounded-full ${chipColor(o.id)}`} />
                        <span className="font-bold text-gray-900 text-sm">{o.customerName}</span>
                      </div>
                      <span className="text-[11px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {o.orderNumber}
                      </span>
                    </div>
                    <Link
                      href={`/staff/dashboard/solar-orders/orders/${o.id}`}
                      target="_blank"
                      className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-800 font-semibold shrink-0"
                    >
                      Open <ExternalLink size={10} />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Zap size={12} className="text-amber-500" />
                      <span className="font-semibold">{o.systemSize} kW</span>
                    </div>
                    {o.salesman && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <User size={12} className="text-gray-400" />
                        <span className="truncate">{o.salesman}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-teal-700 truncate">
                      {o.currentStage}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${o.pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{o.pct}%</span>
                    </div>
                  </div>

                  {/* Placeholder for assigned installer */}
                  <div className="mt-2 text-[11px] text-gray-400 italic">
                    Assigned Installer: —
                  </div>

                  {canEdit && (
                    <button
                      onClick={async () => {
                        const orderId = o.id;
                        setDrawer((d) =>
                          d ? { ...d, orders: d.orders.filter((x) => x.id !== orderId) } : null
                        );
                        setScheduled((prev) => prev.filter((x) => x.id !== orderId));
                        setQueue((prev) => [
                          {
                            id: o.id,
                            orderNumber: o.orderNumber,
                            customerName: o.customerName,
                            phoneNumber: '',
                            systemSize: o.systemSize,
                            orderDate: new Date().toISOString(),
                            daysSinceOrder: 0,
                            salesman: o.salesman,
                            currentStage: o.currentStage,
                            pct: o.pct,
                            status: o.status,
                          },
                          ...prev,
                        ]);
                        try {
                          await fetch('/api/solar-orders/calendar', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId, installationDate: null }),
                          });
                          addToast('Installation removed from calendar');
                        } catch {
                          addToast('Failed to remove', 'error');
                          fetchData(true);
                        }
                      }}
                      className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Remove Schedule
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Context Menu ──────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-[60] bg-white rounded-xl border border-gray-200 shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleRemoveSchedule}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
          >
            Remove Schedule
          </button>
          <button
            onClick={dismissContextMenu}
            className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Toasts ────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[70] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold animate-in slide-in-from-bottom-2 duration-200
              ${t.type === 'success'
                ? 'bg-teal-600 text-white border-teal-700'
                : 'bg-red-600 text-white border-red-700'
              }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

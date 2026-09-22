'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  PackageCheck,
  ClipboardList,
  Boxes,
  Layers,
  RefreshCw,
  ExternalLink,
  X,
  Search,
  AlertCircle,
  Clock,
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import {
  OperationsWorkflowSummary,
  OperationsCellInvoiceItem,
  OperationsStage,
} from '@/lib/operations-workflow-summary';

interface ActiveCellSelection {
  warehouse: string;
  bucketKey: string;
  bucketLabel: string;
  stage: OperationsStage;
  stageTitle: string;
  count: number;
}

const AUTO_REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds

export default function OperationsSection() {
  const [summary, setSummary] = useState<OperationsWorkflowSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  // Filter States
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [showTotalsOnly, setShowTotalsOnly] = useState<boolean>(false);
  const [expandedWarehouses, setExpandedWarehouses] = useState<Record<string, boolean>>({});

  // Modal State
  const [selectedCell, setSelectedCell] = useState<ActiveCellSelection | null>(null);
  const [modalInvoices, setModalInvoices] = useState<OperationsCellInvoiceItem[]>([]);
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPageSize, setModalPageSize] = useState<number>(10);

  // Fetch Summary Data
  const fetchSummary = useCallback(async (background: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!background) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch('/api/dashboard/operations-workflow');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSummary(json.data);
          setIsError(false);

          // Initialize expanded warehouses on first load
          setExpandedWarehouses((prev) => {
            const next = { ...prev };
            json.data.warehouses?.forEach((w: any) => {
              if (next[w.name] === undefined) {
                next[w.name] = true; // Expanded by default
              }
            });
            return next;
          });
        } else {
          setIsError(true);
        }
      } else {
        setIsError(true);
      }
    } catch (err) {
      console.error('[OperationsSection fetch error]', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // 60-second auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSummary(true);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [fetchSummary]);

  // Toggle single warehouse expand/collapse
  const toggleWarehouseExpand = (whName: string) => {
    setExpandedWarehouses((prev) => ({
      ...prev,
      [whName]: !prev[whName],
    }));
  };

  // Toggle expand/collapse all
  const areAllExpanded = useMemo(() => {
    if (!summary?.warehouses || summary.warehouses.length === 0) return false;
    return summary.warehouses.every((w) => expandedWarehouses[w.name] !== false);
  }, [summary, expandedWarehouses]);

  const toggleExpandAll = () => {
    if (!summary?.warehouses) return;
    const targetState = !areAllExpanded;
    const next: Record<string, boolean> = {};
    summary.warehouses.forEach((w) => {
      next[w.name] = targetState;
    });
    setExpandedWarehouses(next);
  };

  // Cell Click Handler
  const handleCellClick = useCallback(
    async (
      warehouse: string,
      bucketKey: string,
      bucketLabel: string,
      stage: OperationsStage,
      count: number
    ) => {
      if (count <= 0) return;

      const stageTitles: Record<OperationsStage, string> = {
        RECEIVING: 'Receiving Pending',
        CHECK: 'Check Pending',
        INVENTORY: 'Inventory Pending',
        TOTAL: 'Total Pending',
      };

      const selection: ActiveCellSelection = {
        warehouse,
        bucketKey,
        bucketLabel,
        stage,
        stageTitle: stageTitles[stage] || stage,
        count,
      };

      setSelectedCell(selection);
      setModalInvoices([]);
      setIsModalLoading(true);
      setModalSearch('');
      setModalPageSize(10); // Reset page size

      try {
        const params = new URLSearchParams({
          detail: 'true',
          warehouse,
          bucketKey,
          stage,
        });
        const res = await fetch(`/api/dashboard/operations-workflow?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.invoices) {
            setModalInvoices(json.data.invoices);
          }
        }
      } catch (err) {
        console.error('[Cell Invoices Fetch Error]', err);
      } finally {
        setIsModalLoading(false);
      }
    },
    []
  );

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCell(null);
      }
    };
    if (selectedCell) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCell]);

  // Filtered warehouses by the Warehouse dropdown selection
  const displayedWarehouses = useMemo(() => {
    if (!summary?.warehouses) return [];
    if (selectedWarehouse === 'ALL') {
      return summary.warehouses;
    }
    return summary.warehouses.filter((w) => w.name === selectedWarehouse);
  }, [summary, selectedWarehouse]);

  // Computed KPI Counts (reflecting selected warehouse)
  const kpiCounts = useMemo(() => {
    if (!summary) {
      return { receiving: 0, check: 0, inventory: 0, total: 0 };
    }
    if (selectedWarehouse === 'ALL') {
      return {
        receiving: summary.totals.receivingPending,
        check: summary.totals.checkPending,
        inventory: summary.totals.inventoryPending,
        total: summary.totals.totalPending,
      };
    }
    const wh = summary.warehouses.find((w) => w.name === selectedWarehouse);
    if (!wh) {
      return { receiving: 0, check: 0, inventory: 0, total: 0 };
    }
    return {
      receiving: wh.receiving.total,
      check: wh.check.total,
      inventory: wh.inventory.total,
      total: wh.totalPending,
    };
  }, [summary, selectedWarehouse]);

  // Filtered modal invoices by search term
  const filteredModalInvoices = useMemo(() => {
    if (!modalSearch.trim()) return modalInvoices;
    const q = modalSearch.toLowerCase();
    return modalInvoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.warehouse.toLowerCase().includes(q)
    );
  }, [modalInvoices, modalSearch]);

  const pagedModalInvoices = useMemo(() => {
    return filteredModalInvoices.slice(0, modalPageSize);
  }, [filteredModalInvoices, modalPageSize]);

  // Date range display string
  const dateRangeDisplay = useMemo(() => {
    if (!summary?.dateBuckets || summary.dateBuckets.length === 0) return '';
    const latest = summary.dateBuckets[0].label;
    const oldestInd = summary.dateBuckets[summary.dateBuckets.length - 2]?.label;
    return `Last 7 days + before • ${oldestInd} – ${latest} 2026 (IST)`;
  }, [summary]);

  // ─── SKELETON LOADING STATE ───────────────────────────────────────────────
  if (isLoading && !summary) {
    return (
      <div className="h-full w-full flex flex-col gap-3 p-1 animate-pulse">
        {/* Top Controls Skeleton */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
          <div className="space-y-1">
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-3 w-56 bg-slate-100 rounded" />
          </div>
          <div className="h-7 w-40 bg-slate-200 rounded-lg" />
        </div>

        {/* 4 KPI Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-2.5 w-20 bg-slate-200 rounded" />
                <div className="h-4 w-12 bg-slate-300 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="h-4 w-44 bg-slate-200 rounded" />
          <div className="h-6 w-full bg-slate-100 rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-full bg-slate-50 border border-slate-100 rounded flex items-center px-3" />
          ))}
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ─────────────────────────────────────────────────────────
  if (isError && !summary) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-white/60 rounded-xl border border-rose-200">
        <AlertCircle className="text-rose-500 mb-3" size={28} />
        <p className="text-sm font-bold text-rose-800">Unable to load operations data</p>
        <p className="text-xs text-slate-500 mt-1">Please check your network connection or permissions.</p>
        <button
          onClick={() => fetchSummary()}
          className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1A2766] text-white rounded-lg text-xs font-semibold hover:bg-[#151f52] transition cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const dateBuckets = summary?.dateBuckets || [];
  const grandTotal = summary?.grandTotal;
  const isAllQueuesClear = (summary?.totals.totalPending || 0) === 0;

  return (
    <div className="h-full w-full flex flex-col gap-2 overflow-y-auto pr-0.5 min-h-0">
      {/* 1. OPERATIONS HEADER & CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-slate-200/80 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-extrabold tracking-wider text-slate-900 uppercase">OPERATIONS</h2>
            <span className="text-[11px] text-slate-400 font-normal">|</span>
            <span className="text-[11px] font-medium text-slate-500">{dateRangeDisplay}</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Pending invoices by operational workflow and warehouse.
            <span className="text-slate-400 ml-1.5 italic hidden sm:inline">Click any number to view invoices.</span>
          </p>
        </div>

        {/* Right Controls: Warehouse Filter + Show Totals Only + Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Warehouse Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 shadow-2xs rounded-lg px-2.5 py-1 text-xs">
            <Filter size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-500 text-[11px] font-medium">Warehouse:</span>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="font-semibold text-slate-800 bg-transparent outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Warehouses</option>
              {summary?.availableWarehouses.map((wh) => (
                <option key={wh} value={wh}>
                  {wh}
                </option>
              ))}
            </select>
          </div>

          {/* Show Totals Only Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 shadow-2xs rounded-lg px-2.5 py-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTotalsOnly}
              onChange={(e) => setShowTotalsOnly(e.target.checked)}
              className="rounded text-[#1A2766] focus:ring-0 cursor-pointer h-3.5 w-3.5"
            />
            <span className="text-[11px] font-medium">Show Totals Only</span>
          </label>

          {/* Refresh Button */}
          <button
            onClick={() => fetchSummary(true)}
            title="Refresh Operational Data"
            className="p-1.5 bg-white text-slate-500 hover:text-[#1A2766] rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#1A2766]' : ''} />
          </button>
        </div>
      </div>

      {/* 2. 4 WORKFLOW KPI CARDS (Dynamically updates when warehouse filter is selected) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0">
        {/* Card 1: Receiving Pending */}
        <div
          onClick={() => handleCellClick(selectedWarehouse, 'ALL', 'All Dates', 'RECEIVING', kpiCounts.receiving)}
          className={`bg-white rounded-xl p-3 border border-amber-200/90 shadow-2xs flex items-center justify-between transition ${
            kpiCounts.receiving > 0 ? 'hover:border-amber-400 hover:shadow-xs cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <PackageCheck size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-amber-700 uppercase block">
                RECEIVING PENDING
              </span>
              <span className="text-lg font-black text-slate-900 tracking-tight block">
                {kpiCounts.receiving.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 shrink-0">
            Stage 1
          </span>
        </div>

        {/* Card 2: Check Pending */}
        <div
          onClick={() => handleCellClick(selectedWarehouse, 'ALL', 'All Dates', 'CHECK', kpiCounts.check)}
          className={`bg-white rounded-xl p-3 border border-indigo-200/90 shadow-2xs flex items-center justify-between transition ${
            kpiCounts.check > 0 ? 'hover:border-indigo-400 hover:shadow-xs cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shrink-0">
              <ClipboardList size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-indigo-700 uppercase block">
                CHECK PENDING
              </span>
              <span className="text-lg font-black text-slate-900 tracking-tight block">
                {kpiCounts.check.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
            Stage 2
          </span>
        </div>

        {/* Card 3: Inventory Pending */}
        <div
          onClick={() => handleCellClick(selectedWarehouse, 'ALL', 'All Dates', 'INVENTORY', kpiCounts.inventory)}
          className={`bg-white rounded-xl p-3 border border-emerald-200/90 shadow-2xs flex items-center justify-between transition ${
            kpiCounts.inventory > 0 ? 'hover:border-emerald-400 hover:shadow-xs cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <Boxes size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase block">
                INVENTORY PENDING
              </span>
              <span className="text-lg font-black text-slate-900 tracking-tight block">
                {kpiCounts.inventory.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">
            Stage 3
          </span>
        </div>

        {/* Card 4: Total Pending (Distinct actionable invoices) */}
        <div
          onClick={() => handleCellClick(selectedWarehouse, 'ALL', 'All Dates', 'TOTAL', kpiCounts.total)}
          className={`bg-white rounded-xl p-3 border border-blue-200/90 shadow-2xs flex items-center justify-between transition ${
            kpiCounts.total > 0 ? 'hover:border-blue-400 hover:shadow-xs cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1A2766] flex items-center justify-center border border-blue-200 shrink-0">
              <Layers size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-[#1A2766] uppercase block">
                TOTAL PENDING
              </span>
              <span className="text-lg font-black text-slate-900 tracking-tight block">
                {kpiCounts.total.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[#1A2766] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 shrink-0">
            Distinct
          </span>
        </div>
      </div>

      {/* 3. MAIN PIVOT TABLE: WAREHOUSE-WISE PENDING INVOICES */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Table Title Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/70 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              WAREHOUSE-WISE PENDING INVOICES
            </h3>
            <p className="text-[11px] text-slate-500">
              {selectedWarehouse === 'ALL'
                ? 'All warehouses categorized by operational workflow and date.'
                : `Filtered view for ${selectedWarehouse}.`}
            </p>
          </div>

          {!showTotalsOnly && displayedWarehouses.length > 0 && (
            <button
              onClick={toggleExpandAll}
              className="text-[11px] font-semibold text-[#1A2766] hover:underline px-2 py-0.5 rounded cursor-pointer"
            >
              {areAllExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>

        {/* Pivot Table Container */}
        <div className="overflow-x-auto overflow-y-auto flex-1 relative">
          {isAllQueuesClear ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <CheckCircle2 size={36} className="text-emerald-500 mb-2.5" />
              <h4 className="text-sm font-bold text-slate-800">No pending operational invoices</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                All current Receiving, Check, and Inventory queues are clear for the selected criteria.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              {/* Sticky Table Header (Dates ordered latest first) */}
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs text-[11px] font-semibold text-slate-700">
                <tr>
                  <th className="py-2.5 px-3 sticky left-0 z-30 bg-slate-100 min-w-[200px] border-r border-slate-200/80">
                    Warehouse / Workflow
                  </th>
                  {dateBuckets.map((b) => (
                    <th key={b.key} className="py-2.5 px-2.5 text-center min-w-[76px] whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={b.isToday ? 'font-bold text-[#1A2766]' : ''}>{b.label}</span>
                        {b.isToday && (
                          <span className="text-[8px] font-extrabold bg-[#1A2766] text-white px-1 py-0.1 rounded tracking-wider mt-0.5">
                            TODAY
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-center min-w-[80px] bg-slate-200/50 border-l border-slate-200 font-bold text-slate-900">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {displayedWarehouses.map((wh) => {
                  const isExpanded = !showTotalsOnly && (expandedWarehouses[wh.name] ?? true);

                  return (
                    <React.Fragment key={wh.name}>
                      {/* Warehouse Parent Row */}
                      <tr className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors font-bold text-slate-900 border-t border-slate-200/80">
                        {/* Warehouse Name (Sticky left column) */}
                        <td className="py-2 px-3 sticky left-0 z-10 bg-slate-50/90 border-r border-slate-200/80 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {!showTotalsOnly ? (
                                <button
                                  type="button"
                                  onClick={() => toggleWarehouseExpand(wh.name)}
                                  className="p-0.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                >
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : (
                                <Building2 size={13} className="text-slate-500 shrink-0 ml-1" />
                              )}
                              <span className="text-xs uppercase tracking-wide">{wh.name}</span>
                            </div>

                            <Link
                              href={`/staff/dashboard/dispatch/post-dispatch?warehouse=${encodeURIComponent(wh.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-[#1A2766] transition p-0.5"
                              title={`Open Post-Dispatch for ${wh.name}`}
                            >
                              <ExternalLink size={11} />
                            </Link>
                          </div>
                        </td>

                        {/* Warehouse Total Count per Date */}
                        {dateBuckets.map((b) => {
                          const count = wh.totalPendingByDate[b.key] || 0;
                          return (
                            <td key={b.key} className="py-2 px-2.5 text-center font-bold">
                              {count > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(wh.name, b.key, b.label, 'TOTAL', count)}
                                  className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 text-xs font-bold text-[#1A2766] bg-blue-50/80 hover:bg-blue-100 border border-blue-200/70 rounded-md transition shadow-2xs hover:scale-105 cursor-pointer"
                                  title={`View ${count} total pending invoices for ${wh.name} on ${b.label}`}
                                >
                                  {count}
                                </button>
                              ) : (
                                <span className="text-slate-300 font-normal select-none">0</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Warehouse Overall Total */}
                        <td className="py-2 px-3 text-center bg-slate-100/50 border-l border-slate-200 font-black text-slate-900">
                          {wh.totalPending > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleCellClick(wh.name, 'ALL', 'All Dates', 'TOTAL', wh.totalPending)}
                              className="inline-flex items-center justify-center min-w-[30px] h-6 px-2 text-xs font-black text-slate-900 bg-white hover:bg-slate-200 border border-slate-300 rounded-md transition shadow-2xs hover:scale-105 cursor-pointer"
                              title={`View all ${wh.totalPending} pending invoices for ${wh.name}`}
                            >
                              {wh.totalPending}
                            </button>
                          ) : (
                            <span className="text-slate-300 font-normal select-none">0</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Child Rows */}
                      {isExpanded && (
                        <>
                          {/* Child 1: Receiving Pending */}
                          <tr className="hover:bg-amber-50/30 transition-colors text-slate-700 text-xs">
                            <td className="py-1.5 pl-7 pr-3 sticky left-0 z-10 bg-white border-r border-slate-200/80 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span className="font-medium text-amber-900">Receiving Pending</span>
                              </div>
                            </td>
                            {dateBuckets.map((b) => {
                              const count = wh.receiving.byDate[b.key] || 0;
                              return (
                                <td key={b.key} className="py-1.5 px-2.5 text-center">
                                  {count > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCellClick(wh.name, b.key, b.label, 'RECEIVING', count)}
                                      className="inline-flex items-center justify-center min-w-[26px] h-5.5 px-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded transition shadow-2xs hover:scale-105 cursor-pointer"
                                      title={`View ${count} receiving pending for ${wh.name} on ${b.label}`}
                                    >
                                      {count}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 font-normal select-none">0</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-1.5 px-3 text-center bg-slate-50/40 border-l border-slate-200 font-bold text-amber-800">
                              {wh.receiving.total > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCellClick(wh.name, 'ALL', 'All Dates', 'RECEIVING', wh.receiving.total)
                                  }
                                  className="text-amber-800 hover:underline cursor-pointer"
                                >
                                  {wh.receiving.total}
                                </button>
                              ) : (
                                <span className="text-slate-300 font-normal select-none">0</span>
                              )}
                            </td>
                          </tr>

                          {/* Child 2: Check Pending */}
                          <tr className="hover:bg-indigo-50/30 transition-colors text-slate-700 text-xs">
                            <td className="py-1.5 pl-7 pr-3 sticky left-0 z-10 bg-white border-r border-slate-200/80 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                <span className="font-medium text-indigo-900">Check Pending</span>
                              </div>
                            </td>
                            {dateBuckets.map((b) => {
                              const count = wh.check.byDate[b.key] || 0;
                              return (
                                <td key={b.key} className="py-1.5 px-2.5 text-center">
                                  {count > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCellClick(wh.name, b.key, b.label, 'CHECK', count)}
                                      className="inline-flex items-center justify-center min-w-[26px] h-5.5 px-1.5 text-[11px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded transition shadow-2xs hover:scale-105 cursor-pointer"
                                      title={`View ${count} check pending for ${wh.name} on ${b.label}`}
                                    >
                                      {count}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 font-normal select-none">0</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-1.5 px-3 text-center bg-slate-50/40 border-l border-slate-200 font-bold text-indigo-800">
                              {wh.check.total > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCellClick(wh.name, 'ALL', 'All Dates', 'CHECK', wh.check.total)
                                  }
                                  className="text-indigo-800 hover:underline cursor-pointer"
                                >
                                  {wh.check.total}
                                </button>
                              ) : (
                                <span className="text-slate-300 font-normal select-none">0</span>
                              )}
                            </td>
                          </tr>

                          {/* Child 3: Inventory Pending */}
                          <tr className="hover:bg-emerald-50/30 transition-colors text-slate-700 text-xs">
                            <td className="py-1.5 pl-7 pr-3 sticky left-0 z-10 bg-white border-r border-slate-200/80 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-medium text-emerald-900">Inventory Pending</span>
                              </div>
                            </td>
                            {dateBuckets.map((b) => {
                              const count = wh.inventory.byDate[b.key] || 0;
                              return (
                                <td key={b.key} className="py-1.5 px-2.5 text-center">
                                  {count > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCellClick(wh.name, b.key, b.label, 'INVENTORY', count)}
                                      className="inline-flex items-center justify-center min-w-[26px] h-5.5 px-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded transition shadow-2xs hover:scale-105 cursor-pointer"
                                      title={`View ${count} inventory pending for ${wh.name} on ${b.label}`}
                                    >
                                      {count}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 font-normal select-none">0</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-1.5 px-3 text-center bg-slate-50/40 border-l border-slate-200 font-bold text-emerald-800">
                              {wh.inventory.total > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCellClick(wh.name, 'ALL', 'All Dates', 'INVENTORY', wh.inventory.total)
                                  }
                                  className="text-emerald-800 hover:underline cursor-pointer"
                                >
                                  {wh.inventory.total}
                                </button>
                              ) : (
                                <span className="text-slate-300 font-normal select-none">0</span>
                              )}
                            </td>
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Sticky Grand Total Footer Row */}
              {grandTotal && (
                <tfoot className="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 shadow-xs font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="py-2.5 px-3 sticky left-0 z-30 bg-slate-100 border-r border-slate-200 font-black tracking-wider uppercase">
                      GRAND TOTAL
                    </td>
                    {dateBuckets.map((b) => {
                      const count = grandTotal.totalPendingByDate[b.key] || 0;
                      return (
                        <td key={b.key} className="py-2.5 px-2.5 text-center font-extrabold text-slate-900">
                          {count > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleCellClick('ALL', b.key, b.label, 'TOTAL', count)}
                              className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 text-xs font-black text-[#1A2766] bg-white hover:bg-slate-200 border border-slate-300 rounded shadow-2xs hover:scale-105 cursor-pointer"
                              title={`View all ${count} pending invoices on ${b.label}`}
                            >
                              {count}
                            </button>
                          ) : (
                            <span className="text-slate-300 font-normal select-none">0</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center bg-slate-200/70 border-l border-slate-200 font-black text-sm text-[#1A2766]">
                      {grandTotal.totalPending > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleCellClick('ALL', 'ALL', 'All Dates', 'TOTAL', grandTotal.totalPending)}
                          className="hover:underline cursor-pointer font-black"
                          title="View all distinct pending operational invoices"
                        >
                          {grandTotal.totalPending.toLocaleString('en-IN')}
                        </button>
                      ) : (
                        <span className="text-slate-300 font-normal select-none">0</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {/* 4. INVOICE DRILLDOWN POPUP MODAL */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedCell.count} Invoices — {selectedCell.stageTitle}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#1A2766] text-white">
                    {selectedCell.stage}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCell.warehouse} · <span className="font-semibold text-slate-700">{selectedCell.bucketLabel}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="px-5 py-2 border-b border-slate-100 bg-white shrink-0 flex items-center gap-2">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by invoice number, customer name, warehouse..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full text-xs text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                autoFocus
              />
              {modalSearch && (
                <button
                  onClick={() => setModalSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Modal Content Table */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
              {isModalLoading ? (
                <div className="flex flex-col items-center justify-center py-14">
                  <RefreshCw className="animate-spin text-[#1A2766] mb-3" size={24} />
                  <p className="text-xs font-semibold text-slate-600">Loading invoice details...</p>
                </div>
              ) : filteredModalInvoices.length === 0 ? (
                <div className="text-center py-14">
                  <p className="text-xs text-slate-500">
                    {modalSearch ? 'No invoices found matching your search term.' : 'No invoices in this view.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/70 text-[11px]">
                        <th className="py-2.5 px-3">Invoice No.</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Warehouse</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Invoice Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Age</th>
                        <th className="py-2.5 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedModalInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-semibold text-[#1A2766] whitespace-nowrap">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-800 max-w-[180px] truncate" title={inv.customerName}>
                            {inv.customerName}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {inv.warehouse}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {inv.formattedAmount}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {inv.invoiceDate}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {inv.currentStatus}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <Clock size={11} className="text-slate-400" />
                              <span>{inv.ageFormatted}</span>
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <Link
                              href={`/staff/dashboard/dispatch/post-dispatch/${inv.id}/review`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A2766] hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span>Review</span>
                              <ExternalLink size={10} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer (with Pagination / View All) */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
              <span className="text-slate-500 text-[11px]">
                Showing {Math.min(filteredModalInvoices.length, modalPageSize)} of {filteredModalInvoices.length} invoices
              </span>

              <div className="flex items-center gap-2">
                {filteredModalInvoices.length > modalPageSize && (
                  <button
                    type="button"
                    onClick={() => setModalPageSize((prev) => prev + 25)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 text-[#1A2766] border border-slate-300 rounded-lg font-semibold transition cursor-pointer text-xs"
                  >
                    Show More (+25)
                  </button>
                )}

                {filteredModalInvoices.length > 10 && modalPageSize < filteredModalInvoices.length && (
                  <button
                    type="button"
                    onClick={() => setModalPageSize(filteredModalInvoices.length)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-medium transition cursor-pointer text-xs"
                  >
                    View All
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="px-3.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition cursor-pointer text-xs ml-1"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

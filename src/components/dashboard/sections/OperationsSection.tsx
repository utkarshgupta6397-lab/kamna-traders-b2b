'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PackageCheck,
  ClipboardList,
  Boxes,
  RefreshCw,
  ExternalLink,
  X,
  Search,
  AlertCircle,
  Clock,
  Layers,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import {
  OperationsWorkflowSummary,
  OperationsCellInvoiceItem,
  OperationsRow,
} from '@/lib/operations-workflow-summary';

interface ActiveCellSelection {
  warehouse: string;
  bucketKey: string;
  bucketLabel: string;
  state: 'RECEIVING' | 'CHECK' | 'INVENTORY';
  stateLabel: string;
  count: number;
}

const AUTO_REFRESH_INTERVAL_MS = 60 * 1000; // 60 seconds

export default function OperationsSection() {
  const [summary, setSummary] = useState<OperationsWorkflowSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  // Modal State
  const [selectedCell, setSelectedCell] = useState<ActiveCellSelection | null>(null);
  const [modalInvoices, setModalInvoices] = useState<OperationsCellInvoiceItem[]>([]);
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');

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

  // Initial Load
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

  // Cell Click -> Load Invoices Modal
  const handleCellClick = useCallback(
    async (
      warehouse: string,
      bucketKey: string,
      bucketLabel: string,
      state: 'RECEIVING' | 'CHECK' | 'INVENTORY',
      count: number
    ) => {
      if (count <= 0) return;

      const stateLabels: Record<string, string> = {
        RECEIVING: 'Receiving Pending',
        CHECK: 'Check Pending',
        INVENTORY: 'Inventory Pending',
      };

      const selection: ActiveCellSelection = {
        warehouse,
        bucketKey,
        bucketLabel,
        state,
        stateLabel: stateLabels[state] || state,
        count,
      };

      setSelectedCell(selection);
      setModalInvoices([]);
      setIsModalLoading(true);
      setModalSearch('');

      try {
        const params = new URLSearchParams({
          detail: 'true',
          warehouse,
          bucketKey,
          state,
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

  // Close Modal on Escape Key
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

  // Filtered modal invoices by search term
  const filteredModalInvoices = modalInvoices.filter((inv) => {
    if (!modalSearch.trim()) return true;
    const q = modalSearch.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.warehouse.toLowerCase().includes(q)
    );
  });

  if (isLoading && !summary) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-white/60 rounded-xl border border-slate-200">
        <RefreshCw className="animate-spin text-[#1A2766] mb-3" size={26} />
        <p className="text-xs font-semibold text-slate-700">Loading Operational Workflow...</p>
        <p className="text-[11px] text-slate-400 mt-1">Aggregating warehouse stages across rolling IST dates</p>
      </div>
    );
  }

  if (isError && !summary) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-white/60 rounded-xl border border-rose-200">
        <AlertCircle className="text-rose-500 mb-3" size={26} />
        <p className="text-xs font-bold text-rose-800">Failed to load operations workflow data</p>
        <p className="text-[11px] text-slate-500 mt-1">Please check your permissions or network connection.</p>
        <button
          onClick={() => fetchSummary()}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A2766] text-white rounded-lg text-xs font-semibold hover:bg-[#151f52] transition cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const totals = summary?.totals || {
    receivingPending: 0,
    checkPending: 0,
    inventoryPending: 0,
    grandTotal: 0,
  };

  const warehouses = summary?.warehouses || [];

  return (
    <div className="h-full w-full flex flex-col gap-2.5 overflow-y-auto pr-0.5">
      {/* 1. TOP SUMMARY CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
        {/* Card 1: Receiving Pending */}
        <div className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <PackageCheck size={17} />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-amber-700 uppercase block">
                RECEIVING PENDING
              </span>
              <span className="text-lg font-black text-slate-900 tracking-tight block">
                {totals.receivingPending.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-medium text-amber-600 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-100">
            Stage 1
          </span>
        </div>

        {/* Card 2: Check Pending */}
        <div className="bg-white rounded-xl p-3 border border-indigo-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shrink-0">
              <ClipboardList size={17} />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-indigo-700 uppercase block">
                CHECK PENDING
              </span>
              <span className="text-lg font-black text-slate-900 tracking-tight block">
                {totals.checkPending.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
            Stage 2
          </span>
        </div>

        {/* Card 3: Inventory Pending */}
        <div className="bg-white rounded-xl p-3 border border-emerald-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <Boxes size={17} />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase block">
                INVENTORY PENDING
              </span>
              <span className="text-lg font-black text-slate-900 tracking-tight block">
                {totals.inventoryPending.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100">
              Stage 3
            </span>
            <button
              onClick={() => fetchSummary(true)}
              title="Refresh Operations Workflow"
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#1A2766]' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. PIVOT TABLES BY WAREHOUSE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        {warehouses.map((wh) => (
          <div
            key={wh.warehouse}
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col overflow-hidden"
          >
            {/* Warehouse Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/70 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {wh.warehouse}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                  {wh.totals.total} pending
                </span>
                <Link
                  href={`/staff/dashboard/dispatch/post-dispatch?warehouse=${encodeURIComponent(wh.warehouse)}`}
                  className="text-slate-400 hover:text-[#1A2766] transition p-0.5"
                  title={`Open Post-Dispatch for ${wh.warehouse}`}
                >
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>

            {/* Pivot Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/40 text-[11px] font-semibold text-slate-600 border-b border-slate-200/80">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-2.5 text-center text-amber-800">Receiving</th>
                    <th className="py-2 px-2.5 text-center text-indigo-800">Check</th>
                    <th className="py-2 px-2.5 text-center text-emerald-800">Inventory</th>
                    <th className="py-2 px-2.5 text-center text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wh.rows.map((row) => (
                    <tr
                      key={row.bucketKey}
                      className={`transition-colors ${
                        row.isToday ? 'bg-blue-50/40 font-semibold' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Date Column */}
                      <td className="py-1.5 px-3 whitespace-nowrap text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{row.label}</span>
                          {row.isToday && (
                            <span className="text-[9px] font-extrabold bg-[#1A2766] text-white px-1.5 py-0.2 rounded tracking-wider">
                              TODAY
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Receiving Pending Cell */}
                      <td className="py-1.5 px-2.5 text-center">
                        {row.receiving > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleCellClick(wh.warehouse, row.bucketKey, row.label, 'RECEIVING', row.receiving)
                            }
                            className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-md transition shadow-2xs hover:scale-105 cursor-pointer"
                            title={`Click to view ${row.receiving} invoices pending Receiving for ${row.label}`}
                          >
                            {row.receiving}
                          </button>
                        ) : (
                          <span className="text-slate-300 select-none">0</span>
                        )}
                      </td>

                      {/* Check Pending Cell */}
                      <td className="py-1.5 px-2.5 text-center">
                        {row.check > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleCellClick(wh.warehouse, row.bucketKey, row.label, 'CHECK', row.check)
                            }
                            className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-md transition shadow-2xs hover:scale-105 cursor-pointer"
                            title={`Click to view ${row.check} invoices pending Check for ${row.label}`}
                          >
                            {row.check}
                          </button>
                        ) : (
                          <span className="text-slate-300 select-none">0</span>
                        )}
                      </td>

                      {/* Inventory Pending Cell */}
                      <td className="py-1.5 px-2.5 text-center">
                        {row.inventory > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleCellClick(wh.warehouse, row.bucketKey, row.label, 'INVENTORY', row.inventory)
                            }
                            className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition shadow-2xs hover:scale-105 cursor-pointer"
                            title={`Click to view ${row.inventory} invoices pending Inventory for ${row.label}`}
                          >
                            {row.inventory}
                          </button>
                        ) : (
                          <span className="text-slate-300 select-none">0</span>
                        )}
                      </td>

                      {/* Row Total */}
                      <td className="py-1.5 px-2.5 text-center font-bold text-slate-700">
                        {row.total > 0 ? row.total : <span className="text-slate-300 font-normal">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/70 border-t border-slate-200 text-xs font-bold text-slate-900">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-2.5 text-center text-amber-800 font-extrabold">
                      {wh.totals.receiving}
                    </td>
                    <td className="py-2 px-2.5 text-center text-indigo-800 font-extrabold">
                      {wh.totals.check}
                    </td>
                    <td className="py-2 px-2.5 text-center text-emerald-800 font-extrabold">
                      {wh.totals.inventory}
                    </td>
                    <td className="py-2 px-2.5 text-center text-slate-900 font-extrabold">
                      {wh.totals.total}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* 3. CELL CLICK DRILL-DOWN MODAL */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedCell.warehouse} • {selectedCell.stateLabel}
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#1A2766] text-white">
                    {selectedCell.count} invoices
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Date Bucket: <span className="font-semibold text-slate-700">{selectedCell.bucketLabel}</span>
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
            <div className="px-5 py-2.5 border-b border-slate-100 bg-white shrink-0 flex items-center gap-2">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by invoice number, customer name..."
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

            {/* Modal Content / Table */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {isModalLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="animate-spin text-[#1A2766] mb-3" size={24} />
                  <p className="text-xs font-semibold text-slate-600">Loading invoices...</p>
                </div>
              ) : filteredModalInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xs text-slate-500">
                    {modalSearch ? 'No matching invoices found for your search query.' : 'No invoices in this stage.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/60 text-[11px]">
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Warehouse</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Invoice Date</th>
                      <th className="py-2.5 px-3">Current Status</th>
                      <th className="py-2.5 px-3 text-right">Age / Waiting</th>
                      <th className="py-2.5 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredModalInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-semibold text-[#1A2766]">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-800 max-w-[200px] truncate" title={inv.customerName}>
                          {inv.customerName}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {inv.warehouse}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                          {inv.formattedAmount}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {inv.invoiceDate}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {inv.currentStatus}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Clock size={11} className="text-slate-400" />
                            <span>{inv.ageFormatted}</span>
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Link
                            href={`/staff/dashboard/dispatch/post-dispatch/${inv.id}/review`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A2766] hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span>Open</span>
                            <ExternalLink size={11} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-500">
                Showing {filteredModalInvoices.length} of {modalInvoices.length} invoices
              </span>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

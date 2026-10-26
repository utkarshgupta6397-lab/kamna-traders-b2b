'use client';

import React, { useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  Image as ImageIcon, 
  RefreshCw, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronRight, 
  ChevronsUpDown,
  Package,
  FileText
} from 'lucide-react';
import { toJpeg } from 'html-to-image';
import {
  PivotOrientation,
  buildNormalizedPivotRows,
  buildInvoicePivotGroups,
  buildItemPivotGroups,
  calculatePivotTotals,
  generateGroupedPivotCsv,
  formatBillDate,
  sanitizeFilenamePart,
  RawDcrInvoice,
} from '@/lib/dcr-pivot';

interface CustomerDcrPivotSectionProps {
  customer: {
    id: string;
    name: string;
    gstNumber?: string | null;
  } | null;
  invoices: RawDcrInvoice[];
  isLoading?: boolean;
}

export default function CustomerDcrPivotSection({
  customer,
  invoices,
  isLoading = false,
}: CustomerDcrPivotSectionProps) {
  // Default selection is Invoice No -> Item (Option 2A)
  const [orientation, setOrientation] = useState<PivotOrientation>('INVOICE_FIRST');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingJpeg, setIsExportingJpeg] = useState(false);

  // Hidden export container ref for pristine JPEG rendering
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Build normalized pivot dataset from filtered invoices
  const normalizedRows = useMemo(() => {
    return buildNormalizedPivotRows(invoices);
  }, [invoices]);

  // Invoice-grouped structure (Invoice No -> Item)
  const invoiceGroups = useMemo(() => {
    return buildInvoicePivotGroups(normalizedRows);
  }, [normalizedRows]);

  // Item-grouped structure (Item -> Invoice No)
  const itemGroups = useMemo(() => {
    return buildItemPivotGroups(normalizedRows);
  }, [normalizedRows]);

  // Grand totals across all filtered rows (authoritative, matching across views)
  const totals = useMemo(() => {
    return calculatePivotTotals(normalizedRows);
  }, [normalizedRows]);

  // Safe filename prefix
  const customerPrefix = useMemo(() => {
    return sanitizeFilenamePart(customer?.name || 'customer');
  }, [customer?.name]);

  const orientationSuffix = orientation === 'INVOICE_FIRST' ? 'invoice-item' : 'item-invoice';
  const orientationLabel = orientation === 'INVOICE_FIRST' ? 'Invoice No → Item' : 'Item → Invoice No';

  // Toggle single group collapse/expand
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Expand / collapse all groups
  const currentKeys = useMemo(() => {
    return orientation === 'INVOICE_FIRST'
      ? invoiceGroups.map((g) => g.invoiceId)
      : itemGroups.map((g) => g.productKey);
  }, [orientation, invoiceGroups, itemGroups]);

  const allCollapsed = currentKeys.length > 0 && currentKeys.every((k) => collapsedGroups[k]);

  const handleToggleExpandAll = () => {
    if (allCollapsed) {
      // Expand all
      setCollapsedGroups({});
    } else {
      // Collapse all
      const nextCollapsed: Record<string, boolean> = {};
      for (const k of currentKeys) {
        nextCollapsed[k] = true;
      }
      setCollapsedGroups(nextCollapsed);
    }
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    if (isExportingCsv) return;
    if (normalizedRows.length === 0) {
      toast.error('No records available to export.');
      return;
    }

    try {
      setIsExportingCsv(true);
      const csvContent = generateGroupedPivotCsv(orientation, invoiceGroups, itemGroups, totals);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${customerPrefix}_customer-dcr-pivot-${orientationSuffix}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('CSV export downloaded successfully');
    } catch (err: unknown) {
      console.error('CSV export failed:', err);
      toast.error('Failed to export CSV: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsExportingCsv(false);
    }
  };

  // JPEG Export Handler
  const handleExportJpeg = async () => {
    if (isExportingJpeg) return;
    if (normalizedRows.length === 0) {
      toast.error('No records available to export.');
      return;
    }

    if (!exportContainerRef.current) {
      toast.error('Export container not ready.');
      return;
    }

    setIsExportingJpeg(true);
    const toastId = toast.loading('Generating JPEG export...');

    try {
      // Ensure hidden export container has laid out completely
      await new Promise((resolve) => setTimeout(resolve, 200));

      const dataUrl = await toJpeg(exportContainerRef.current, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${customerPrefix}_customer-dcr-pivot-${orientationSuffix}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('JPEG export downloaded successfully', { id: toastId });
    } catch (err: unknown) {
      console.error('JPEG export failed:', err);
      toast.error('Failed to export JPEG: ' + (err instanceof Error ? err.message : 'Unknown error'), { id: toastId });
    } finally {
      setIsExportingJpeg(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col gap-0">
      {/* SECTION HEADER & CONTROLS */}
      <div className="px-4 py-3 bg-blue-50/30 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h4 className="font-bold text-[#1A2766] text-sm uppercase tracking-wider flex items-center gap-2">
            DCR Item &amp; Invoice Pivot
          </h4>
          <span className="text-xs text-gray-500 font-semibold bg-white border border-gray-200 px-2.5 py-0.5 rounded-full shadow-xs">
            Rows: {normalizedRows.length}
          </span>
          <span className="text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full shadow-xs hidden sm:inline-flex">
            {orientation === 'INVOICE_FIRST'
              ? `${invoiceGroups.length} Invoices`
              : `${itemGroups.length} Products`}
          </span>
        </div>

        {/* CONTROLS: EXPAND ALL + VIEW SELECTOR + EXPORT BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Expand/Collapse All Button */}
          {((orientation === 'INVOICE_FIRST' && invoiceGroups.length > 0) ||
            (orientation === 'ITEM_FIRST' && itemGroups.length > 0)) && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="px-2.5 py-1 text-xs font-semibold text-[#1A2766] hover:bg-blue-50 border border-blue-200/80 rounded-md transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
              title={allCollapsed ? 'Expand all groups' : 'Collapse all groups'}
            >
              <ChevronsUpDown size={12} className="text-[#1A2766]" />
              <span>{allCollapsed ? 'Expand All' : 'Collapse All'}</span>
            </button>
          )}

          {/* Segmented View Selector */}
          <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setOrientation('ITEM_FIRST')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                orientation === 'ITEM_FIRST'
                  ? 'bg-[#1A2766] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Item → Invoice No
            </button>
            <button
              type="button"
              onClick={() => setOrientation('INVOICE_FIRST')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                orientation === 'INVOICE_FIRST'
                  ? 'bg-[#1A2766] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Invoice No → Item
            </button>
          </div>

          <div className="h-5 w-[1px] bg-gray-300 mx-1 hidden sm:block" />

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExportingCsv || normalizedRows.length === 0 || isLoading}
            title="Export grouped pivot table to CSV"
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            {isExportingCsv ? (
              <RefreshCw size={12} className="animate-spin text-gray-400" />
            ) : (
              <FileSpreadsheet size={13} className="text-emerald-600" />
            )}
            <span>Export CSV</span>
          </button>

          {/* Export JPEG Button */}
          <button
            type="button"
            onClick={handleExportJpeg}
            disabled={isExportingJpeg || normalizedRows.length === 0 || isLoading}
            title="Export high-resolution JPEG image of grouped pivot"
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            {isExportingJpeg ? (
              <RefreshCw size={12} className="animate-spin text-gray-400" />
            ) : (
              <ImageIcon size={13} className="text-blue-600" />
            )}
            <span>Export JPEG</span>
          </button>
        </div>
      </div>

      {/* VISIBLE INTERACTIVE GROUPED TABLE */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-left text-xs table-fixed min-w-[1240px]">
          {orientation === 'INVOICE_FIRST' ? (
            /* VIEW A: INVOICE NO -> ITEM TABLE HEAD */
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 font-bold uppercase w-16 text-center tracking-wider">#</th>
                <th className="px-3 py-2.5 font-bold uppercase w-44 tracking-wider">Invoice No</th>
                <th className="px-3 py-2.5 font-bold uppercase w-28 tracking-wider">Bill Date</th>
                <th className="px-3 py-2.5 font-bold uppercase w-32 tracking-wider">Items</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-24 tracking-wider">Billed Qty</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-28 tracking-wider">Issued Qty</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-36 tracking-wider">Serial Entry Pending</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-36 tracking-wider">Vendor DCR Pending</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-24 tracking-wider">On Hold</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-28 tracking-wider">Ready to Issue</th>
              </tr>
            </thead>
          ) : (
            /* VIEW B: ITEM -> INVOICE NO TABLE HEAD */
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 font-bold uppercase w-16 text-center tracking-wider">#</th>
                <th className="px-3 py-2.5 font-bold uppercase w-96 tracking-wider">Item (SKU)</th>
                <th className="px-3 py-2.5 font-bold uppercase w-32 tracking-wider">Invoices</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-24 tracking-wider">Billed Qty</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-28 tracking-wider">Issued Qty</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-36 tracking-wider">Serial Entry Pending</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-36 tracking-wider">Vendor DCR Pending</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-24 tracking-wider">On Hold</th>
                <th className="px-3 py-2.5 font-bold uppercase text-right w-28 tracking-wider">Ready to Issue</th>
              </tr>
            </thead>
          )}

          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-400 italic">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-[#1A2766]" />
                    <span>Loading pivot records...</span>
                  </div>
                </td>
              </tr>
            ) : normalizedRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-500 italic bg-gray-50/50">
                  No DCR item records found for current filters.
                </td>
              </tr>
            ) : orientation === 'INVOICE_FIRST' ? (
              /* VIEW A: INVOICE GROUPED ROWS */
              invoiceGroups.map((group) => {
                const isExpanded = !collapsedGroups[group.invoiceId];
                return (
                  <React.Fragment key={`inv-group-${group.invoiceId}`}>
                    {/* INVOICE GROUP HEADER */}
                    <tr
                      onClick={() => toggleGroup(group.invoiceId)}
                      className="bg-slate-50/90 hover:bg-blue-50/30 transition-colors border-t border-b border-gray-200/90 cursor-pointer select-none"
                    >
                      {/* Index + Chevron */}
                      <td className="px-3 py-2.5 text-center align-middle font-mono">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-gray-500 hover:text-gray-900 transition-transform">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-[#1A2766]" />
                            ) : (
                              <ChevronRight size={14} className="text-gray-400" />
                            )}
                          </span>
                          <span className="font-bold text-gray-700">{group.groupIndex}</span>
                        </div>
                      </td>

                      {/* Invoice No */}
                      <td className="px-3 py-2.5 font-bold text-[#1A2766] align-middle whitespace-nowrap">
                        <span className="hover:underline">{group.invoiceNumber}</span>
                      </td>

                      {/* Bill Date */}
                      <td className="px-3 py-2.5 text-gray-600 align-middle whitespace-nowrap font-medium">
                        {formatBillDate(group.billDate)}
                      </td>

                      {/* Item count badge */}
                      <td className="px-3 py-2.5 align-middle">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100/70 text-blue-900 border border-blue-200/50">
                          <Package size={11} className="text-blue-700" />
                          <span>{group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}</span>
                        </span>
                      </td>

                      {/* Billed Qty */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-gray-900 align-middle">
                        {group.billedQty}
                      </td>

                      {/* Issued Qty */}
                      <td className="px-3 py-2.5 text-right align-middle">
                        <div className="flex flex-col items-end">
                          <span className="font-extrabold text-emerald-700">{group.issuedQty}</span>
                          {group.billedQty > 0 && group.issuedQty > 0 && (
                            <span className="text-[10px] text-emerald-600 font-semibold leading-tight">
                              {((group.issuedQty / group.billedQty) * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Serial Entry Pending */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-orange-700 align-middle">
                        {group.serialEntryPending}
                      </td>

                      {/* Vendor DCR Pending */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-amber-700 align-middle">
                        {group.vendorDcrPending}
                      </td>

                      {/* On Hold */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-red-700 align-middle">
                        {group.onHold}
                      </td>

                      {/* Ready to Issue */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-teal-700 align-middle">
                        {group.readyToIssue}
                      </td>
                    </tr>

                    {/* EXPANDED ITEM DETAIL ROWS */}
                    {isExpanded &&
                      group.items.map((item) => (
                        <tr
                          key={`inv-${group.invoiceId}-item-${item.productKey}`}
                          className="bg-white hover:bg-blue-50/20 transition-colors border-b border-gray-100/90"
                        >
                          {/* Subordinate Index */}
                          <td className="px-3 py-2 text-center text-gray-400 font-mono text-[11px] align-middle pl-5">
                            {item.childIndex}
                          </td>

                          {/* Item (SKU) - Spans invoice, date, item columns */}
                          <td
                            colSpan={3}
                            className="px-3 py-2 font-medium text-gray-800 align-middle truncate"
                            title={item.itemDisplayName}
                          >
                            <div className="flex items-center gap-2 pl-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              <span className="truncate">{item.itemDisplayName}</span>
                            </div>
                          </td>

                          {/* Detail quantities aligned with header columns */}
                          <td className="px-3 py-2 text-right font-semibold text-gray-800 align-middle">
                            {item.billedQty}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600 align-middle">
                            {item.issuedQty}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-orange-600 align-middle">
                            {item.serialEntryPending}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-amber-700 align-middle">
                            {item.vendorDcrPending}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600 align-middle">
                            {item.onHold}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-teal-600 align-middle">
                            {item.readyToIssue}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })
            ) : (
              /* VIEW B: ITEM GROUPED ROWS */
              itemGroups.map((group) => {
                const isExpanded = !collapsedGroups[group.productKey];
                return (
                  <React.Fragment key={`item-group-${group.productKey}`}>
                    {/* ITEM GROUP HEADER */}
                    <tr
                      onClick={() => toggleGroup(group.productKey)}
                      className="bg-slate-50/90 hover:bg-blue-50/30 transition-colors border-t border-b border-gray-200/90 cursor-pointer select-none"
                    >
                      {/* Index + Chevron */}
                      <td className="px-3 py-2.5 text-center align-middle font-mono">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-gray-500 hover:text-gray-900 transition-transform">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-[#1A2766]" />
                            ) : (
                              <ChevronRight size={14} className="text-gray-400" />
                            )}
                          </span>
                          <span className="font-bold text-gray-700">{group.groupIndex}</span>
                        </div>
                      </td>

                      {/* Product Name & SKU */}
                      <td className="px-3 py-2.5 font-bold text-gray-900 align-middle truncate" title={group.itemDisplayName}>
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-blue-700 flex-shrink-0" />
                          <span className="truncate">{group.itemDisplayName}</span>
                        </div>
                      </td>

                      {/* Invoice count badge */}
                      <td className="px-3 py-2.5 align-middle">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100/70 text-blue-900 border border-blue-200/50">
                          <FileText size={11} className="text-blue-700" />
                          <span>{group.invoiceCount} {group.invoiceCount === 1 ? 'invoice' : 'invoices'}</span>
                        </span>
                      </td>

                      {/* Billed Qty */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-gray-900 align-middle">
                        {group.billedQty}
                      </td>

                      {/* Issued Qty */}
                      <td className="px-3 py-2.5 text-right align-middle">
                        <div className="flex flex-col items-end">
                          <span className="font-extrabold text-emerald-700">{group.issuedQty}</span>
                          {group.billedQty > 0 && group.issuedQty > 0 && (
                            <span className="text-[10px] text-emerald-600 font-semibold leading-tight">
                              {((group.issuedQty / group.billedQty) * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Serial Entry Pending */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-orange-700 align-middle">
                        {group.serialEntryPending}
                      </td>

                      {/* Vendor DCR Pending */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-amber-700 align-middle">
                        {group.vendorDcrPending}
                      </td>

                      {/* On Hold */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-red-700 align-middle">
                        {group.onHold}
                      </td>

                      {/* Ready to Issue */}
                      <td className="px-3 py-2.5 text-right font-extrabold text-teal-700 align-middle">
                        {group.readyToIssue}
                      </td>
                    </tr>

                    {/* EXPANDED INVOICE DETAIL ROWS */}
                    {isExpanded &&
                      group.invoices.map((inv) => (
                        <tr
                          key={`item-${group.productKey}-inv-${inv.invoiceId}`}
                          className="bg-white hover:bg-blue-50/20 transition-colors border-b border-gray-100/90"
                        >
                          {/* Subordinate Index */}
                          <td className="px-3 py-2 text-center text-gray-400 font-mono text-[11px] align-middle pl-5">
                            {inv.childIndex}
                          </td>

                          {/* Invoice No & Bill Date - Spans item and invoice columns */}
                          <td
                            colSpan={2}
                            className="px-3 py-2 align-middle truncate"
                          >
                            <div className="flex items-center gap-3 pl-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              <span className="font-bold text-[#1A2766] whitespace-nowrap">{inv.invoiceNumber}</span>
                              <span className="text-gray-500 text-[11px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200/60 font-medium whitespace-nowrap">
                                {formatBillDate(inv.billDate)}
                              </span>
                            </div>
                          </td>

                          {/* Detail quantities aligned with header columns */}
                          <td className="px-3 py-2 text-right font-semibold text-gray-800 align-middle">
                            {inv.billedQty}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600 align-middle">
                            {inv.issuedQty}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-orange-600 align-middle">
                            {inv.serialEntryPending}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-amber-700 align-middle">
                            {inv.vendorDcrPending}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600 align-middle">
                            {inv.onHold}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-teal-600 align-middle">
                            {inv.readyToIssue}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* VISUALLY DISTINCT GRAND TOTAL ROW */}
          {!isLoading && normalizedRows.length > 0 && (
            <tfoot className="border-t-2 border-gray-300 bg-gray-100/90 font-bold text-gray-900">
              <tr>
                <td
                  colSpan={orientation === 'INVOICE_FIRST' ? 4 : 3}
                  className="px-4 py-3 uppercase tracking-wider text-xs font-extrabold text-[#1A2766]"
                >
                  Grand Total
                </td>
                <td className="px-3 py-3 text-right text-xs font-extrabold text-gray-950">
                  {totals.billedQty}
                </td>
                <td className="px-3 py-3 text-right text-xs font-extrabold text-emerald-700">
                  {totals.issuedQty}
                </td>
                <td className="px-3 py-3 text-right text-xs font-extrabold text-orange-700">
                  {totals.serialEntryPending}
                </td>
                <td className="px-3 py-3 text-right text-xs font-extrabold text-amber-800">
                  {totals.vendorDcrPending}
                </td>
                <td className="px-3 py-3 text-right text-xs font-extrabold text-red-700">
                  {totals.onHold}
                </td>
                <td className="px-3 py-3 text-right text-xs font-extrabold text-teal-700">
                  {totals.readyToIssue}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* OFF-SCREEN CLEAN EXPORT CONTAINER (USED BY html-to-image FOR JPEG EXPORT) */}
      <div
        style={{
          position: 'fixed',
          left: '-99999px',
          top: '0',
          width: '1360px',
          backgroundColor: '#ffffff',
          padding: '24px',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <div ref={exportContainerRef} className="bg-white p-6 border border-gray-200 rounded-lg">
          {/* Header in Image */}
          <div className="border-b border-gray-200 pb-4 mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1A2766] tracking-tight uppercase">
                DCR Item &amp; Invoice Pivot
              </h2>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                <span>
                  Customer: <strong className="text-gray-800">{customer?.name || 'All'}</strong>
                </span>
                {customer?.gstNumber && (
                  <span>
                    GST: <strong className="text-gray-800">{customer.gstNumber}</strong>
                  </span>
                )}
                <span>
                  View: <strong className="text-[#1A2766]">{orientationLabel}</strong>
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-gray-400">
              Kamna Traders B2B ERP
            </div>
          </div>

          {/* Grouped Table in Export Image (All Groups Fully Expanded) */}
          <table className="w-full text-left text-xs table-fixed border-collapse">
            {orientation === 'INVOICE_FIRST' ? (
              <thead className="bg-gray-100 text-gray-700 border-b border-gray-300">
                <tr>
                  <th className="px-3 py-2 font-bold uppercase w-14 text-center">#</th>
                  <th className="px-3 py-2 font-bold uppercase w-44">Invoice No</th>
                  <th className="px-3 py-2 font-bold uppercase w-28">Bill Date</th>
                  <th className="px-3 py-2 font-bold uppercase w-32">Items</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">Billed Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-28">Issued Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Serial Entry Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Vendor DCR Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">On Hold</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-28">Ready to Issue</th>
                </tr>
              </thead>
            ) : (
              <thead className="bg-gray-100 text-gray-700 border-b border-gray-300">
                <tr>
                  <th className="px-3 py-2 font-bold uppercase w-14 text-center">#</th>
                  <th className="px-3 py-2 font-bold uppercase w-96">Item (SKU)</th>
                  <th className="px-3 py-2 font-bold uppercase w-32">Invoices</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">Billed Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-28">Issued Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Serial Entry Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Vendor DCR Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">On Hold</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-28">Ready to Issue</th>
                </tr>
              </thead>
            )}

            <tbody className="divide-y divide-gray-200">
              {orientation === 'INVOICE_FIRST'
                ? invoiceGroups.map((group) => (
                    <React.Fragment key={`exp-inv-group-${group.invoiceId}`}>
                      {/* Group Header in Export */}
                      <tr className="bg-slate-100/90 font-semibold border-t border-b border-gray-300">
                        <td className="px-3 py-2 text-center text-gray-700 font-mono font-bold">
                          {group.groupIndex}
                        </td>
                        <td className="px-3 py-2 font-bold text-[#1A2766]">
                          {group.invoiceNumber}
                        </td>
                        <td className="px-3 py-2 text-gray-600 font-medium">
                          {formatBillDate(group.billDate)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-gray-900">
                          {group.billedQty}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-emerald-700">
                          {group.issuedQty}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-orange-700">
                          {group.serialEntryPending}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-amber-700">
                          {group.vendorDcrPending}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-red-700">
                          {group.onHold}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-teal-700">
                          {group.readyToIssue}
                        </td>
                      </tr>

                      {/* Detail Rows in Export */}
                      {group.items.map((item) => (
                        <tr key={`exp-inv-${group.invoiceId}-item-${item.productKey}`} className="bg-white">
                          <td className="px-3 py-1.5 text-center text-gray-400 font-mono text-[11px] pl-4">
                            {item.childIndex}
                          </td>
                          <td colSpan={3} className="px-3 py-1.5 text-gray-800 font-medium truncate pl-4">
                            {item.itemDisplayName}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-gray-800">
                            {item.billedQty}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">
                            {item.issuedQty}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-orange-600">
                            {item.serialEntryPending}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-amber-700">
                            {item.vendorDcrPending}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-red-600">
                            {item.onHold}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-teal-600">
                            {item.readyToIssue}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                : itemGroups.map((group) => (
                    <React.Fragment key={`exp-item-group-${group.productKey}`}>
                      {/* Group Header in Export */}
                      <tr className="bg-slate-100/90 font-semibold border-t border-b border-gray-300">
                        <td className="px-3 py-2 text-center text-gray-700 font-mono font-bold">
                          {group.groupIndex}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-900 truncate">
                          {group.itemDisplayName}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {group.invoiceCount} {group.invoiceCount === 1 ? 'invoice' : 'invoices'}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-gray-900">
                          {group.billedQty}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-emerald-700">
                          {group.issuedQty}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-orange-700">
                          {group.serialEntryPending}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-amber-700">
                          {group.vendorDcrPending}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-red-700">
                          {group.onHold}
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-teal-700">
                          {group.readyToIssue}
                        </td>
                      </tr>

                      {/* Detail Rows in Export */}
                      {group.invoices.map((inv) => (
                        <tr key={`exp-item-${group.productKey}-inv-${inv.invoiceId}`} className="bg-white">
                          <td className="px-3 py-1.5 text-center text-gray-400 font-mono text-[11px] pl-4">
                            {inv.childIndex}
                          </td>
                          <td colSpan={2} className="px-3 py-1.5 pl-4">
                            <span className="font-bold text-[#1A2766]">{inv.invoiceNumber}</span>
                            <span className="text-gray-500 text-[11px] ml-2">({formatBillDate(inv.billDate)})</span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-gray-800">
                            {inv.billedQty}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">
                            {inv.issuedQty}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-orange-600">
                            {inv.serialEntryPending}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-amber-700">
                            {inv.vendorDcrPending}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-red-600">
                            {inv.onHold}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-teal-600">
                            {inv.readyToIssue}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
            </tbody>

            {/* Grand Total Row in Export */}
            <tfoot className="border-t-2 border-gray-400 bg-gray-100 font-bold text-gray-900">
              <tr>
                <td
                  colSpan={orientation === 'INVOICE_FIRST' ? 4 : 3}
                  className="px-3 py-2.5 uppercase tracking-wider text-xs font-extrabold text-[#1A2766]"
                >
                  Grand Total
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-extrabold text-gray-950">
                  {totals.billedQty}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-extrabold text-emerald-700">
                  {totals.issuedQty}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-extrabold text-orange-700">
                  {totals.serialEntryPending}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-extrabold text-amber-800">
                  {totals.vendorDcrPending}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-extrabold text-red-700">
                  {totals.onHold}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-extrabold text-teal-700">
                  {totals.readyToIssue}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

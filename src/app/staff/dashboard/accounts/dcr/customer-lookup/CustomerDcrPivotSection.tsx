'use client';

import React, { useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { Download, Image as ImageIcon, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import {
  NormalizedPivotRow,
  PivotOrientation,
  buildNormalizedPivotRows,
  sortPivotRows,
  calculatePivotTotals,
  generatePivotCsv,
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
  const [orientation, setOrientation] = useState<PivotOrientation>('ITEM_FIRST');
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingJpeg, setIsExportingJpeg] = useState(false);

  // Hidden export container ref for pristine JPEG rendering
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Build normalized pivot dataset from filtered invoices
  const normalizedRows = useMemo(() => {
    return buildNormalizedPivotRows(invoices);
  }, [invoices]);

  // Sort rows based on selected orientation (default: Bill Date descending)
  const sortedRows = useMemo(() => {
    return sortPivotRows(normalizedRows, orientation);
  }, [normalizedRows, orientation]);

  // Calculate grand totals across all filtered rows
  const totals = useMemo(() => {
    return calculatePivotTotals(normalizedRows);
  }, [normalizedRows]);

  // Safe filename prefix
  const customerPrefix = useMemo(() => {
    return sanitizeFilenamePart(customer?.name || 'customer');
  }, [customer?.name]);

  const orientationSuffix = orientation === 'ITEM_FIRST' ? 'item-invoice' : 'invoice-item';
  const orientationLabel = orientation === 'ITEM_FIRST' ? 'Item → Invoice No' : 'Invoice No → Item';

  // CSV Export Handler
  const handleExportCsv = () => {
    if (isExportingCsv) return;
    if (sortedRows.length === 0) {
      toast.error('No records available to export.');
      return;
    }

    try {
      setIsExportingCsv(true);
      const csvContent = generatePivotCsv(sortedRows, orientation, totals);
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
    } catch (err: any) {
      console.error('CSV export failed:', err);
      toast.error('Failed to export CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingCsv(false);
    }
  };

  // JPEG Export Handler
  const handleExportJpeg = async () => {
    if (isExportingJpeg) return;
    if (sortedRows.length === 0) {
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
      // Ensure container has had a moment to lay out completely
      await new Promise((resolve) => setTimeout(resolve, 150));

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
    } catch (err: any) {
      console.error('JPEG export failed:', err);
      toast.error('Failed to export JPEG: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsExportingJpeg(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col gap-0">
      {/* SECTION HEADER & CONTROLS */}
      <div className="px-4 py-3 bg-blue-50/30 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h4 className="font-bold text-[#1A2766] text-sm uppercase tracking-wider flex items-center gap-2">
            DCR Item &amp; Invoice Pivot
          </h4>
          <span className="text-xs text-gray-500 font-semibold bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-sm">
            Rows: {sortedRows.length}
          </span>
        </div>

        {/* CONTROLS: VIEW SELECTOR + EXPORT BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact View Selector */}
          <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setOrientation('ITEM_FIRST')}
              className={`px-3 py-1 rounded-md transition-all ${
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
              className={`px-3 py-1 rounded-md transition-all ${
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
            disabled={isExportingCsv || sortedRows.length === 0 || isLoading}
            title="Export full filtered table to CSV"
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
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
            disabled={isExportingJpeg || sortedRows.length === 0 || isLoading}
            title="Export high-resolution JPEG image of the pivot table"
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
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

      {/* VISIBLE TABLE */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-left text-xs table-fixed min-w-[1200px]">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
            {orientation === 'ITEM_FIRST' ? (
              <tr>
                <th className="px-3 py-2 font-semibold uppercase w-12 text-center">#</th>
                <th className="px-3 py-2 font-semibold uppercase w-64">Item</th>
                <th className="px-3 py-2 font-semibold uppercase w-32">Invoice No</th>
                <th className="px-3 py-2 font-semibold uppercase w-28">Bill Date</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-24">Billed Qty</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-24">Issued Qty</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-36">Serial Entry Pending</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-36">Vendor DCR Pending</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-24">On Hold</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-28">Ready to Issue</th>
              </tr>
            ) : (
              <tr>
                <th className="px-3 py-2 font-semibold uppercase w-12 text-center">#</th>
                <th className="px-3 py-2 font-semibold uppercase w-32">Invoice No</th>
                <th className="px-3 py-2 font-semibold uppercase w-28">Bill Date</th>
                <th className="px-3 py-2 font-semibold uppercase w-64">Item</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-24">Billed Qty</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-24">Issued Qty</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-36">Serial Entry Pending</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-36">Vendor DCR Pending</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-24">On Hold</th>
                <th className="px-3 py-2 font-semibold uppercase text-right w-28">Ready to Issue</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-400 italic">
                  Loading pivot records...
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-500 italic bg-gray-50/50">
                  No DCR item records found for current filters.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => (
                <tr key={`${row.invoiceId}__${row.productKey}__${idx}`} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-3 py-2 text-gray-500 align-middle text-center font-mono">
                    {idx + 1}
                  </td>
                  {orientation === 'ITEM_FIRST' ? (
                    <>
                      <td className="px-3 py-2 font-medium text-gray-900 align-middle truncate" title={row.itemDisplayName}>
                        {row.itemDisplayName}
                      </td>
                      <td className="px-3 py-2 font-bold text-[#1A2766] align-middle whitespace-nowrap">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 text-gray-600 align-middle whitespace-nowrap">
                        {formatBillDate(row.billDate || row.invoiceDate)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-bold text-[#1A2766] align-middle whitespace-nowrap">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 text-gray-600 align-middle whitespace-nowrap">
                        {formatBillDate(row.billDate || row.invoiceDate)}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 align-middle truncate" title={row.itemDisplayName}>
                        {row.itemDisplayName}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right font-bold text-gray-900 align-middle">
                    {row.billedQty}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-green-600 align-middle">
                    {row.issuedQty}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-orange-600 align-middle">
                    {row.serialEntryPending}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-yellow-700 align-middle">
                    {row.vendorDcrPending}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-red-600 align-middle">
                    {row.onHold}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-teal-600 align-middle">
                    {row.readyToIssue}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* GRAND TOTAL ROW */}
          {!isLoading && sortedRows.length > 0 && (
            <tfoot className="border-t-2 border-gray-300 bg-gray-100/80 font-bold text-gray-900">
              <tr>
                <td colSpan={4} className="px-3 py-2 uppercase tracking-wider text-xs font-extrabold text-[#1A2766]">
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-gray-950">
                  {totals.billedQty}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-green-700">
                  {totals.issuedQty}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-orange-700">
                  {totals.serialEntryPending}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-yellow-800">
                  {totals.vendorDcrPending}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-red-700">
                  {totals.onHold}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-teal-700">
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
              <h2 className="text-xl font-bold text-[#1A2766] tracking-tight">
                DCR Item &amp; Invoice Pivot
              </h2>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                <span>Customer: <strong className="text-gray-800">{customer?.name || 'All'}</strong></span>
                {customer?.gstNumber && <span>GST: <strong className="text-gray-800">{customer.gstNumber}</strong></span>}
                <span>View: <strong className="text-[#1A2766]">{orientationLabel}</strong></span>
              </div>
            </div>
            <div className="text-right text-[11px] text-gray-400">
              Kamna Traders B2B ERP
            </div>
          </div>

          {/* Clean Flat Table in Image */}
          <table className="w-full text-left text-xs table-fixed border-collapse">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-300">
              {orientation === 'ITEM_FIRST' ? (
                <tr>
                  <th className="px-3 py-2 font-bold uppercase w-12 text-center">#</th>
                  <th className="px-3 py-2 font-bold uppercase w-80">Item</th>
                  <th className="px-3 py-2 font-bold uppercase w-36">Invoice No</th>
                  <th className="px-3 py-2 font-bold uppercase w-28">Bill Date</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">Billed Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">Issued Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Serial Entry Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Vendor DCR Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">On Hold</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-28">Ready to Issue</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2 font-bold uppercase w-12 text-center">#</th>
                  <th className="px-3 py-2 font-bold uppercase w-36">Invoice No</th>
                  <th className="px-3 py-2 font-bold uppercase w-28">Bill Date</th>
                  <th className="px-3 py-2 font-bold uppercase w-80">Item</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">Billed Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">Issued Qty</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Serial Entry Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-36">Vendor DCR Pending</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-24">On Hold</th>
                  <th className="px-3 py-2 font-bold uppercase text-right w-28">Ready to Issue</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedRows.map((row, idx) => (
                <tr key={`export__${row.invoiceId}__${row.productKey}__${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 text-gray-500 font-mono text-center">
                    {idx + 1}
                  </td>
                  {orientation === 'ITEM_FIRST' ? (
                    <>
                      <td className="px-3 py-2 font-medium text-gray-900 truncate">
                        {row.itemDisplayName}
                      </td>
                      <td className="px-3 py-2 font-bold text-[#1A2766] whitespace-nowrap">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {formatBillDate(row.billDate || row.invoiceDate)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-bold text-[#1A2766] whitespace-nowrap">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {formatBillDate(row.billDate || row.invoiceDate)}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 truncate">
                        {row.itemDisplayName}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right font-bold text-gray-900">
                    {row.billedQty}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-green-600">
                    {row.issuedQty}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-orange-600">
                    {row.serialEntryPending}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-yellow-700">
                    {row.vendorDcrPending}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">
                    {row.onHold}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-teal-600">
                    {row.readyToIssue}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Grand Total Row in Export */}
            <tfoot className="border-t-2 border-gray-400 bg-gray-100 font-bold text-gray-900">
              <tr>
                <td colSpan={4} className="px-3 py-2 uppercase tracking-wider text-xs font-extrabold text-[#1A2766]">
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-gray-950">
                  {totals.billedQty}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-green-700">
                  {totals.issuedQty}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-orange-700">
                  {totals.serialEntryPending}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-yellow-800">
                  {totals.vendorDcrPending}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-red-700">
                  {totals.onHold}
                </td>
                <td className="px-3 py-2 text-right text-xs font-extrabold text-teal-700">
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

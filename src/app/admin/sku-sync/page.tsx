'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { RefreshCw, AlertCircle, CheckCircle2, Download, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

type PreviewSku = {
  skuId: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  caseSize: number;
  uom: string;
  status: string;
  zohoBookItemId: string | null;
};

export default function SkuSyncPage() {
  const [skus, setSkus] = useState<PreviewSku[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ created: number; updated: number; failed: number } | null>(null);
  const [lastSync, setLastSync] = useState<{ startedAt: string; completedAt: string | null; totalReceived: number; createdCount: number; updatedCount: number; failedCount: number } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/sku-sync/last-run');
      const json = await res.json();
      if (res.ok && json.lastLog) {
        setLastSync(json.lastLog);
      }
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    }
  };

  const formatDateIST = (dateStr: string) => {
    const date = new Date(dateStr);
    
    // Format parts to construct specific string: 07-May-2026 03:30 PM IST
    const day = date.toLocaleString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' });
    const month = date.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
    const year = date.toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' });
    const time = date.toLocaleString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Kolkata' 
    }).toUpperCase();

    return `${day}-${month}-${year} ${time} IST`;
  };

  const runSync = async () => {
    if (!confirm('Are you sure you want to run the full catalog sync from Zoho? This will update your local database.')) return;
    
    setIsSyncing(true);
    setSyncSummary(null);
    try {
      const res = await fetch('/api/admin/sku-sync/run', { method: 'POST' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to sync SKUs from Zoho');
      }

      setSyncSummary(json.summary);
      toast.success('Catalog synchronization completed successfully');
      
      // Refresh status and preview
      fetchStatus();
      fetchSkus();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchSkus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/sku-sync/preview');
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch SKUs from Zoho');
      }

      setSkus(json.data || []);
      setHasFetched(true);
      toast.success(`Successfully fetched ${json.count} SKUs`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Network error occurred');
      setSkus([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zoho SKU Sync</h1>
          <p className="text-sm text-gray-500 mt-1">
            Preview active SKUs directly from the Zoho inventory system.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSkus}
            disabled={isLoading || isSyncing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw size={18} className={isLoading && !isSyncing ? 'animate-spin' : ''} />
            {isLoading && !isSyncing ? 'Fetching...' : 'Preview Data'}
          </button>
          
          <button
            onClick={runSync}
            disabled={isLoading || isSyncing}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1A2766] text-white rounded-lg font-medium hover:bg-[#003347] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            <Download size={18} className={isSyncing ? 'animate-bounce' : ''} />
            {isSyncing ? 'Syncing Catalog...' : 'Run SKU Sync'}
          </button>
        </div>
      </div>

      {/* Status & Last Synced Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Sync Status</p>
              {lastSync ? (
                <div className="mt-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDateIST(lastSync.startedAt)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lastSync.totalReceived} items processed • {lastSync.createdCount} new • {lastSync.updatedCount} updated
                  </p>
                </div>
              ) : (
                <p className="text-sm font-medium text-gray-500 mt-1 italic">Never synced yet</p>
              )}
            </div>
          </div>
          {lastSync && (
            <div className="hidden sm:block">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                <CheckCircle2 size={12} />
                SUCCESSFUL
              </span>
            </div>
          )}
        </div>

        <div className="bg-[#1A2766] rounded-xl p-5 shadow-sm text-white flex flex-col justify-center">
          <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Auto-Sync Schedule</p>
          <p className="text-lg font-bold mt-1">Every 30 Minutes</p>
          <p className="text-xs text-blue-200 mt-1 opacity-80">9:00 AM — 8:00 PM IST</p>
        </div>
      </div>

      {/* Sync Summary Alert */}
      {syncSummary && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-emerald-800 font-semibold">Sync Completed Successfully</h3>
              <p className="text-emerald-600 text-sm">Your POS catalog is now up to date with Zoho.</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <div className="flex flex-col items-center bg-white px-4 py-2 rounded shadow-sm border border-emerald-100 min-w-[80px]">
              <span className="text-emerald-600 text-lg font-bold">{syncSummary.created}</span>
              <span className="text-gray-500 text-[10px] uppercase tracking-wider">Created</span>
            </div>
            <div className="flex flex-col items-center bg-white px-4 py-2 rounded shadow-sm border border-emerald-100 min-w-[80px]">
              <span className="text-blue-600 text-lg font-bold">{syncSummary.updated}</span>
              <span className="text-gray-500 text-[10px] uppercase tracking-wider">Updated</span>
            </div>
            <div className="flex flex-col items-center bg-white px-4 py-2 rounded shadow-sm border border-emerald-100 min-w-[80px]">
              <span className="text-red-600 text-lg font-bold">{syncSummary.failed}</span>
              <span className="text-gray-500 text-[10px] uppercase tracking-wider">Failed</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        {/* State: Loading */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
            <RefreshCw size={40} className="animate-spin mb-4 text-[#1A2766]" />
            <p className="text-lg font-medium text-gray-600">Connecting to Zoho API...</p>
            <p className="text-sm mt-2">This might take a few seconds.</p>
          </div>
        )}

        {/* State: Empty / Initial */}
        {!isLoading && !hasFetched && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
            <Download size={48} strokeWidth={1.5} className="mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600">No Data Fetched</p>
            <p className="text-sm mt-2 max-w-sm text-center">
              Click the "Fetch Zoho SKUs" button above to preview the current catalog. 
              This action is read-only and will not modify your database.
            </p>
          </div>
        )}

        {/* State: Fetched but Empty Array */}
        {!isLoading && hasFetched && skus.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
            <CheckCircle2 size={48} strokeWidth={1.5} className="mb-4 text-emerald-500" />
            <p className="text-lg font-medium text-gray-600">Sync Complete</p>
            <p className="text-sm mt-2">Zoho API returned an empty list. No active SKUs found.</p>
          </div>
        )}

        {/* State: Data Ready */}
        {!isLoading && hasFetched && skus.length > 0 && (
          <>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1A2766]/10 text-[#1A2766] text-xs font-bold">
                  {skus.length}
                </span>
                <span className="text-sm font-semibold text-gray-700">SKUs Ready for Preview</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/50 text-xs font-medium">
                <AlertCircle size={14} />
                Read-Only Mode
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-white sticky top-0 z-10 shadow-sm outline outline-1 outline-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">SKU ID</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Product Info</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Category</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-[120px]">Price</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-[100px]">Case Size</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-[80px]">UOM</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-[100px]">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-[160px]">Zoho Item ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {skus.map((sku, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-mono text-sm font-semibold text-[#1A2766]">{sku.skuId}</span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900 line-clamp-1" title={sku.name}>
                            {sku.name}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            Brand: {sku.brand || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {sku.category || '—'}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums">
                        {formatCurrency(sku.price)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 text-center">
                        <span className="inline-flex items-center justify-center bg-gray-100 px-2 py-0.5 rounded font-medium">
                          {sku.caseSize}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-center tracking-wider">
                        {sku.uom || '—'}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          sku.status.toLowerCase() === 'active' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {sku.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 font-mono text-right tabular-nums">
                        {sku.zohoBookItemId || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Truck, Loader2, Eye, X, ZoomIn, Calendar, User, IndianRupee, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface TruckUploadItem {
  id: string;
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;
  customerGst: string;
  total: number;
  currencyCode: string;
  imageUrl: string;
  imageFilename: string;
  imageSizeBytes: number;
  imageMimeType: string;
  uploadedAt: string;
  uploadedByUserName: string;
  orderStatus: string;
}

function formatINR(val: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

export default function TruckDetailsPage() {
  const [uploads, setUploads] = useState<TruckUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<TruckUploadItem | null>(null);

  const fetchUploads = async (showToast = false) => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/dispatch/truck-details');
      const json = await res.json();
      if (res.ok && json.success) {
        setUploads(json.data || []);
        if (showToast) {
          toast.success('Truck details updated');
        }
      }
    } catch (err) {
      console.error('Failed to load truck details', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUploads();

    // 15-second polling fallback
    const pollInterval = setInterval(() => {
      fetchUploads();
    }, 15000);

    // SSE Realtime listener for immediate sync
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'truck_upload') {
            fetchUploads();
          }
        } catch {
          // ignore heartbeat parse
        }
      };
    } catch (err) {
      console.warn('[TruckDetails SSE] Connection failed', err);
    }

    return () => {
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const filteredUploads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uploads;
    return uploads.filter(
      u =>
        u.salesOrderNumber.toLowerCase().includes(q) ||
        u.customerName.toLowerCase().includes(q) ||
        u.uploadedByUserName.toLowerCase().includes(q) ||
        (u.customerGst && u.customerGst.toLowerCase().includes(q))
    );
  }, [uploads, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1A2766]/10 text-[#1A2766] flex items-center justify-center">
              <Truck size={18} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Truck Details</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review captured truck registration photos and order dispatch authorizations.
          </p>
        </div>
        <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Sync Active
        </div>
      </div>

      {/* Controls Area */}
      <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100 bg-white">
        <div className="relative w-full sm:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search SO number, customer, GST, or staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="text-xs text-gray-500 font-medium">
            Total Uploads: <span className="font-bold text-gray-800">{filteredUploads.length}</span>
          </div>
          <button
            onClick={() => fetchUploads(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-[#1A2766]' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50/20">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 h-full text-gray-400">
            <Loader2 size={36} className="animate-spin text-[#1A2766] mb-3" />
            <p className="text-sm font-medium">Loading uploaded truck records...</p>
          </div>
        ) : filteredUploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 mb-4 text-gray-400">
              <Truck size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {searchQuery ? 'No matching truck details found' : 'No Sales Orders currently have truck photos uploaded'}
            </h3>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md">
              {searchQuery
                ? 'Try adjusting your search criteria.'
                : 'When warehouse staff capture truck numbers via the Mobile ERP, the records and photos will instantly appear here.'}
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50/75 text-gray-700 font-semibold text-xs uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3.5">Truck Photo</th>
                      <th className="px-5 py-3.5">Sales Order</th>
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5 text-right">Order Value</th>
                      <th className="px-5 py-3.5">Uploaded By</th>
                      <th className="px-5 py-3.5">Uploaded Time</th>
                      <th className="px-5 py-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUploads.map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        {/* Thumbnail */}
                        <td className="px-5 py-3.5">
                          <div
                            onClick={() => setPreviewImage(item)}
                            className="relative w-20 h-14 rounded-lg overflow-hidden border border-gray-200 bg-slate-100 cursor-pointer group shadow-sm flex-shrink-0"
                          >
                            <img
                              src={item.imageUrl}
                              alt={`Truck photo for ${item.salesOrderNumber}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye size={16} className="text-white" />
                            </div>
                          </div>
                        </td>

                        {/* SO Number */}
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          <div className="font-bold text-[14px] text-[#1A2766]">{item.salesOrderNumber}</div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50 mt-1">
                            <ShieldCheck size={12} /> Photo Verified
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-gray-900">{item.customerName}</div>
                          {item.customerGst && (
                            <div className="text-xs text-gray-400 font-mono mt-0.5">GST: {item.customerGst}</div>
                          )}
                        </td>

                        {/* Value */}
                        <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                          {formatINR(item.total)}
                        </td>

                        {/* Uploaded By */}
                        <td className="px-5 py-3.5 text-gray-700">
                          <div className="flex items-center gap-1.5 font-medium text-gray-800">
                            <User size={14} className="text-gray-400" />
                            {item.uploadedByUserName}
                          </div>
                        </td>

                        {/* Uploaded Time */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-gray-500 text-xs">
                          <div className="font-medium text-gray-800">
                            {format(new Date(item.uploadedAt), 'dd MMM yyyy')}
                          </div>
                          <div className="text-gray-400 mt-0.5">
                            {format(new Date(item.uploadedAt), 'hh:mm:ss a')}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => setPreviewImage(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A2766]/5 text-[#1A2766] hover:bg-[#1A2766]/10 font-semibold text-xs transition-colors"
                          >
                            <ZoomIn size={14} />
                            View Photo
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <span>Truck Photo</span>
                  <span className="text-sm font-normal text-gray-500">({previewImage.salesOrderNumber})</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {previewImage.customerName} • {formatINR(previewImage.total)}
                </p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Image Display */}
            <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4 min-h-[300px]">
              <img
                src={previewImage.imageUrl}
                alt={`Full truck view for ${previewImage.salesOrderNumber}`}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-md"
              />
            </div>

            {/* Modal Footer with Metadata */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <User size={14} className="text-gray-400" />
                  Uploaded by: <strong className="text-gray-800 ml-1">{previewImage.uploadedByUserName}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} className="text-gray-400" />
                  Timestamp: <strong className="text-gray-800 ml-1">{format(new Date(previewImage.uploadedAt), 'dd MMM yyyy, hh:mm a')}</strong>
                </span>
              </div>
              <div className="text-gray-400 font-mono text-[11px]">
                {Math.round(previewImage.imageSizeBytes / 1024)} KB • {previewImage.imageMimeType}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

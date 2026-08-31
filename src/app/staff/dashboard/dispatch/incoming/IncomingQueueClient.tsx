'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, RefreshCw, Inbox, FileDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface DispatchIncomingOrder {
  id: string;
  zohoSalesorderId: string;
  salesorderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerGst: string | null;
  total: number | null;
  currencyCode: string | null;
  totalItems: number | null;
  totalUniqueRows: number | null;
  totalTax: number | null;
  status: string;
  receivedAt: string;
  detailsStatus?: string;
  detailsFetchError?: string | null;
}


const formatCurrency = (amount: number, currency: string = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

export default function IncomingQueueClient() {
  const [orders, setOrders] = useState<DispatchIncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sseConnected, setSseConnected] = useState(false);
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());

  // Keep a reference to currently known IDs to prevent duplicate alerts
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Audio object initialization (created lazily to respect browser policies if needed)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/dispatch-bell.wav');
    }
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/incoming-queue');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setOrders(json.data);
          
          // Initialize known IDs
          const idSet = new Set<string>();
          json.data.forEach((o: DispatchIncomingOrder) => idSet.add(o.zohoSalesorderId));
          knownIdsRef.current = idSet;
        }
      } else {
        toast.error('Failed to load incoming queue.');
      }
    } catch (err) {
      toast.error('Network error while loading queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Setup SSE
    let eventSource: EventSource;
    let reconnectTimeout: NodeJS.Timeout;
    let isUnmounted = false;

    const connectSSE = () => {
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onerror = (err) => {
        console.error('[SSE] Error:', err);
        setSseConnected(false);
        eventSource.close();
        // Reconnect after 5s
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_order') {
            const order: DispatchIncomingOrder = data.order;
            
            // Check for duplicates
            if (!knownIdsRef.current.has(order.zohoSalesorderId)) {
              knownIdsRef.current.add(order.zohoSalesorderId);
              
              // Add to state at the top
              setOrders(prev => [order, ...prev]);
              
              // Highlight
              setHighlightedRow(order.id);
              setTimeout(() => setHighlightedRow(null), 3000);

              // Notification
              const soNum = order.salesorderNumber || order.zohoSalesorderId;
              toast.success(`New Sales Order Received\n${soNum} has been pushed to Dispatch.`, {
                duration: 5000,
                icon: '📥',
              });

              // Play sound
              if (audioRef.current) {
                audioRef.current.play().catch(e => {
                  console.warn('Audio play restricted by browser:', e);
                });
                
                // Play second time after a short natural gap
                setTimeout(() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.warn('Second audio play restricted:', e));
                  }
                }, 800); // 800ms gap
              }
            }
          }
        } catch (err) {
          console.error('[SSE] Message parse error:', err);
        }
      };
    };

    connectSSE();

  
  const handleManualFetch = async (id: string) => {
    try {
      setFetchingIds(prev => new Set(prev).add(id));
      const response = await fetch(`/api/dispatch/incoming-queue/${id}/fetch`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to fetch details');
      
      const result = await response.json();
      const updatedOrder = result.order;
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
      toast.success('Order details fetched successfully');
    } catch (err: any) {
      toast.error(err.message || 'Fetch failed');
    } finally {
      setFetchingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const lowerQ = searchQuery.toLowerCase();
    return orders.filter(o => 
      (o.salesorderNumber?.toLowerCase() || '').includes(lowerQ) ||
      (o.customerName?.toLowerCase() || '').includes(lowerQ) ||
      o.zohoSalesorderId.toLowerCase().includes(lowerQ)
    );
  }, [orders, searchQuery]);

    const handleFetchDetails = async (id: string) => {
    setFetchingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/dispatch/incoming-queue/${id}/fetch`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch details');
      }
      toast.success('Sales Order details fetched successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to fetch Sales Order details from Zoho Books. Please try again.');
    } finally {
      setFetchingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const newCount = orders.filter(o => o.status === 'NEW').length;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Incoming Orders
            {sseConnected ? (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Reconnecting
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Live queue of Sales Orders freshly pushed from Zoho Books.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 border-b border-gray-100 bg-white">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Received</span>
            <Inbox size={16} />
          </div>
          <span className="text-2xl font-black text-blue-900">{orders.length}</span>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">New</span>
            <AlertTriangle size={16} className="rotate-180" />
          </div>
          <span className="text-2xl font-black text-emerald-900">{newCount}</span>
        </div>
      </div>

      {/* Controls Area */}
      <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100">
        <div className="relative w-full sm:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search SO No. or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={fetchInitialData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-full sm:w-auto justify-center disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-gray-50/30 relative">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Sales Order</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Customer</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Amount</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Total Items</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Received At</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-gray-400" />
                      <span className="text-sm">Loading incoming queue...</span>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center max-w-md mx-auto">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                        <Inbox size={32} className="text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">Queue is empty</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Sales Orders pushed from Zoho Books will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm">No results match your search.</span>
                  )}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  className={`hover:bg-gray-50/50 transition-colors duration-1000 ${highlightedRow === order.id ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-6 py-4">
                    {order.salesorderNumber ? (
                      <a href={`https://books.zoho.in/app#/salesorders/${order.zohoSalesorderId}`} target="_blank" rel="noreferrer" className="font-bold text-[#1A2766] hover:underline cursor-pointer">
                        {order.salesorderNumber}
                      </a>
                    ) : (
                      <div className="font-bold text-gray-900">{order.zohoSalesorderId}</div>
                    )}
                    <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {order.zohoSalesorderId}</div>
                  </td>
                  <td className="px-6 py-4">
                    {order.customerName ? (
                      <a href={`https://books.zoho.in/app#/contacts/${order.customerId || ''}`} target="_blank" rel="noreferrer" className="font-medium text-[#1A2766] hover:underline cursor-pointer">
                        {order.customerName}
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Unknown Customer</span>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {order.customerGst ? `GST: ${order.customerGst}` : 'GST: —'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-gray-900">
                      {order.total !== null ? formatCurrency(order.total, order.currencyCode || 'INR') : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Tax: {order.totalTax !== null ? formatCurrency(order.totalTax, order.currencyCode || 'INR') : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-gray-900">
                      {order.totalItems !== null ? order.totalItems : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Unique Rows: {order.totalUniqueRows !== null ? order.totalUniqueRows : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(order.receivedAt), 'dd-MMM-yyyy hh:mm a')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2 items-start">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        {order.status}
                      </span>
                      {(!order.detailsStatus || order.detailsStatus === 'PENDING' || order.detailsStatus === 'FAILED') && (
                        <button
                          onClick={() => handleFetchDetails(order.id)}
                          disabled={fetchingIds.has(order.id)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mt-1"
                        >
                          <RefreshCw size={12} className={fetchingIds.has(order.id) ? 'animate-spin text-blue-600' : 'text-gray-400'} />
                          {fetchingIds.has(order.id) ? 'Fetching...' : 'Fetch Details'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, RefreshCw, Inbox, FileDown, AlertTriangle, ArrowLeftCircle, X, Loader2 } from 'lucide-react';
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
  const [sendBackModalOrder, setSendBackModalOrder] = useState<DispatchIncomingOrder | null>(null);
  const [sendBackComment, setSendBackComment] = useState('');
  const [submittingSendBack, setSubmittingSendBack] = useState(false);
  const [sendBackError, setSendBackError] = useState<string | null>(null);

  // Keep a reference to currently known IDs to prevent duplicate alerts
  const knownIdsRef = useRef<Set<string>>(new Set());

  

  const handleOpenSendBackModal = (order: DispatchIncomingOrder) => {
    setSendBackModalOrder(order);
    setSendBackComment('');
    setSendBackError(null);
  };

  const handleSendBack = async () => {
    if (!sendBackModalOrder) return;
    if (!sendBackComment.trim()) {
      setSendBackError('Reason / Comments are required.');
      return;
    }
    
    setSubmittingSendBack(true);
    setSendBackError(null);
    
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${sendBackModalOrder.id}/send-back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: sendBackComment })
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        setSendBackError(data.message || data.error || 'Failed to send back to Operations.');
        if (data.details) {
          console.error('Send Back Details:', data.details);
        }
      } else {
        setSendBackModalOrder(null);
        // Let SSE or initial fetch handle the status update, or manually update
      }
    } catch (err: any) {
      setSendBackError(err.message || 'Network error.');
    } finally {
      setSubmittingSendBack(false);
    }
  };

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

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource.close();
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_order') {
            const order: DispatchIncomingOrder = data.order;
            
            // Check for duplicates
            const dedupeKey = (order as any)._isRePush ? `${order.zohoSalesorderId}_${(order as any)._rePushTimestamp}` : order.zohoSalesorderId;
            if (!knownIdsRef.current.has(dedupeKey)) {
              knownIdsRef.current.add(dedupeKey);
              
              // Add to state at the top (and remove old instance if it's a repush)
              setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
              
              // Highlight
              setHighlightedRow(order.id);
              setTimeout(() => setHighlightedRow(null), 3000);

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
                      
                      {order.status === 'NEW' && (
                        <button
                          onClick={() => handleOpenSendBackModal(order)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-red-200 rounded-md text-xs font-medium text-red-700 hover:bg-red-50 transition-colors mt-1"
                        >
                          <ArrowLeftCircle size={12} className="text-red-500" />
                          Send Back to Operations Team
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

      {sendBackModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/30">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ArrowLeftCircle size={18} className="text-red-600" />
                Send Sales Order Back for Editing?
              </h3>
              <button 
                onClick={() => !submittingSendBack && setSendBackModalOrder(null)}
                disabled={submittingSendBack}
                className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                This will release the Sales Order <span className="font-bold text-gray-900">{sendBackModalOrder.salesorderNumber || sendBackModalOrder.zohoSalesorderId}</span> for correction and send it back to the Operations team.
              </p>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Reason / Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 min-h-[100px]"
                  placeholder="Explain why this order is being sent back..."
                  value={sendBackComment}
                  onChange={(e) => setSendBackComment(e.target.value)}
                  disabled={submittingSendBack}
                />
              </div>
              
              {sendBackError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>{sendBackError}</div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setSendBackModalOrder(null)}
                disabled={submittingSendBack}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendBack}
                disabled={submittingSendBack || !sendBackComment.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {submittingSendBack ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftCircle size={16} />}
                Send Back to Operations Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

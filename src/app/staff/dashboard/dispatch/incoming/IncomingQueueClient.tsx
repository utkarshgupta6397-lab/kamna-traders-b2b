'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, RefreshCw, Inbox, FileDown, AlertTriangle, Lock, Unlock, AlertCircle, Loader2, X } from 'lucide-react';
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
  zohoLockStatus?: string;
  zohoLockValue?: boolean;
  zohoLockAttemptedAt?: string;
  zohoLockVerifiedAt?: string;
  zohoLockHttpStatus?: number;
  zohoLockError?: string;
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
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());
  const [lockModalOrder, setLockModalOrder] = useState<DispatchIncomingOrder | null>(null);
  const [lockDetails, setLockDetails] = useState<any>(null);
  const [loadingLockDetails, setLoadingLockDetails] = useState(false);

  // Keep a reference to currently known IDs to prevent duplicate alerts
  const knownIdsRef = useRef<Set<string>>(new Set());

  
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
            if (!knownIdsRef.current.has(order.zohoSalesorderId)) {
              knownIdsRef.current.add(order.zohoSalesorderId);
              
              // Add to state at the top
              setOrders(prev => [order, ...prev]);
              
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


  const handleLockOrder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLockingIds(prev => new Set(prev).add(id));
      const res = await fetch(`/api/dispatch/incoming-orders/${id}/lock`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to lock order');
      }
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
      toast.success('Zoho lock verification completed.');
    } catch (err: any) {
      toast.error(err.message || 'Lock operation failed');
    } finally {
      setLockingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openLockModal = async (order: DispatchIncomingOrder) => {
    setLockModalOrder(order);
    setLoadingLockDetails(true);
    setLockDetails(null);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/lock-details`);
      if (res.ok) {
        const json = await res.json();
        setLockDetails(json);
      } else {
        toast.error('Failed to load lock diagnostics');
      }
    } catch (err) {
      toast.error('Network error loading lock details');
    } finally {
      setLoadingLockDetails(false);
    }
  };

  const renderLockIcon = (order: DispatchIncomingOrder) => {
    const status = order.zohoLockStatus;
    
    let Icon = Lock;
    let iconClass = "text-gray-400";
    let tooltip = "Lock has not been attempted";
    
    if (status === 'SUCCESS') {
      Icon = Lock;
      iconClass = "text-emerald-500 bg-emerald-50 border-emerald-200";
      tooltip = "Zoho Books lock verified";
    } else if (status === 'VERIFICATION_FAILED') {
      Icon = Unlock;
      iconClass = "text-amber-500 bg-amber-50 border-amber-200";
      tooltip = "Lock update was not verified in Zoho Books";
    } else if (status === 'FAILED') {
      Icon = AlertCircle;
      iconClass = "text-red-500 bg-red-50 border-red-200";
      tooltip = "Zoho Books lock update failed";
    } else if (status === 'PENDING') {
      Icon = Loader2;
      iconClass = "text-blue-500 bg-blue-50 border-blue-200 animate-spin";
      tooltip = "Lock operation in progress";
    }

    return (
      <button 
        onClick={(e) => { e.stopPropagation(); openLockModal(order); }}
        className={`p-1 rounded-md border flex items-center justify-center transition-colors ${iconClass}`}
        title={tooltip}
      >
        <Icon size={14} className={status !== 'PENDING' ? '' : 'animate-spin'} />
      </button>
    );
  };

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
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                          {order.status}
                        </span>
                        {renderLockIcon(order)}
                      </div>
                      
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
                      
                      {order.zohoLockStatus !== 'SUCCESS' && order.zohoLockStatus !== 'PENDING' && (
                        <button
                          onClick={(e) => handleLockOrder(order.id, e)}
                          disabled={lockingIds.has(order.id)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mt-1"
                        >
                          <Lock size={12} className={lockingIds.has(order.id) ? 'animate-pulse text-amber-500' : 'text-gray-400'} />
                          {lockingIds.has(order.id) ? 'Locking...' : (order.zohoLockStatus === 'NOT_ATTEMPTED' || !order.zohoLockStatus) ? 'Lock in Zoho' : 'Retry Lock'}
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

      {lockModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Lock size={18} className="text-[#1A2766]" />
                Lock Diagnostics: {lockModalOrder.salesorderNumber || lockModalOrder.zohoSalesorderId}
              </h3>
              <button 
                onClick={() => setLockModalOrder(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors bg-white hover:bg-gray-100 rounded-full p-1 border border-gray-200"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingLockDetails ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                  <Loader2 size={24} className="animate-spin text-[#1A2766]" />
                  <p>Loading diagnostic details from secure vault...</p>
                </div>
              ) : lockDetails ? (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg border flex flex-col gap-1 ${
                    lockDetails.zohoLockStatus === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    lockDetails.zohoLockStatus === 'VERIFICATION_FAILED' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    lockDetails.zohoLockStatus === 'FAILED' ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-gray-50 border-gray-200 text-gray-800'
                  }`}>
                    <div className="font-bold text-sm uppercase tracking-wide">
                      Status: {lockDetails.zohoLockStatus || 'NOT_ATTEMPTED'}
                    </div>
                    {lockDetails.zohoLockError && (
                      <div className="text-sm mt-1">{lockDetails.zohoLockError}</div>
                    )}
                  </div>
                  
                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border rounded-lg p-3 shadow-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Last Attempted</div>
                      <div className="mt-1 text-sm text-gray-900">
                        {lockDetails.zohoLockAttemptedAt ? format(new Date(lockDetails.zohoLockAttemptedAt), 'dd MMM yyyy, hh:mm:ss a') : 'Never'}
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg p-3 shadow-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Last Verified</div>
                      <div className="mt-1 text-sm text-gray-900">
                        {lockDetails.zohoLockVerifiedAt ? format(new Date(lockDetails.zohoLockVerifiedAt), 'dd MMM yyyy, hh:mm:ss a') : 'Never'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Value: {lockDetails.zohoLockValue === true ? 'true' : lockDetails.zohoLockValue === false ? 'false' : 'null'}</div>
                    </div>
                  </div>
                  
                  {/* JSON Payloads */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                        <FileDown size={14} /> PUT Request Payload
                      </h4>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-40">
                        {lockDetails.zohoLockRequestJson ? JSON.stringify(lockDetails.zohoLockRequestJson, null, 2) : 'No payload recorded'}
                      </pre>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                        <FileDown size={14} /> PUT Response (HTTP {lockDetails.zohoLockHttpStatus || '—'})
                      </h4>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-40">
                        {lockDetails.zohoLockPutResponseJson ? JSON.stringify(lockDetails.zohoLockPutResponseJson, null, 2) : 'No response recorded'}
                      </pre>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                        <FileDown size={14} /> Verification GET Response
                      </h4>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-64">
                        {lockDetails.zohoLockVerificationResponseJson ? JSON.stringify(lockDetails.zohoLockVerificationResponseJson, null, 2) : 'No verification response recorded'}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-red-500 font-medium">Failed to load details.</div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setLockModalOrder(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

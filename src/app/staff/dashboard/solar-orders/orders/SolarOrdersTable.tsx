'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Plus, ChevronLeft, ChevronRight, ArrowRight, Lock } from 'lucide-react';

interface SolarOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  customerName: string;
  phoneNumber: string;
  systemSize: number;
  systemType: string;
  totalOrderAmount: number;
  leadSource: string;
  salesman: { name: string } | null;
  callingExecutive: { name: string } | null;
  subVendor: { name: string } | null;
  payments: { amount: number }[];
  createdById: string;
}

interface Counts {
  all: number;
  draft: number;
  pendingApproval: number;
  execution: number;
  completed: number;
  rejected: number;
}

interface SolarOrdersTableProps {
  currentUserId: string;
  canApprove: boolean;
  canCreate: boolean;
}

export default function SolarOrdersTable({ currentUserId, canApprove, canCreate }: SolarOrdersTableProps) {
  const [orders, setOrders] = useState<SolarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [counts, setCounts] = useState<Counts>({
    all: 0, draft: 0, pendingApproval: 0, execution: 0, completed: 0, rejected: 0
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: statusFilter,
        search,
      });

      const [res, countRes] = await Promise.all([
        fetch(`/api/solar-orders?${query}`),
        fetch(`/api/solar-orders/counts`)
      ]);

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setTotalPages(data.pagination.pages || 1);
      }
      
      if (countRes.ok) {
        const countData = await countRes.json();
        setCounts(countData);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, limit, statusFilter]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchOrders();
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string, text: string, dot: string, progress: number }> = {
      DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', progress: 5 },
      PENDING_APPROVAL: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', progress: 15 },
      APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', progress: 25 },
      EXECUTION: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', progress: 65 },
      COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', progress: 100 },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', progress: 100 },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', progress: 0 },
    };
    return configs[status] || configs.DRAFT;
  };

  const getLeadSourceBadge = (source: string) => {
    switch(source) {
      case 'WALK_IN': return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'WALK-IN' };
      case 'WHATSAPP': return { bg: 'bg-green-50', text: 'text-green-700', label: 'WHATSAPP' };
      case 'REFERRAL': return { bg: 'bg-purple-50', text: 'text-purple-700', label: 'REFERRAL' };
      case 'CALLING_ACTIVITY': return { bg: 'bg-orange-50', text: 'text-orange-700', label: 'CALLING' };
      case 'SUB_VENDOR': return { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'SUB-VENDOR' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'OTHER' };
    }
  };

  const formatSystemType = (type: string) => {
    if (!type) return '';
    return type.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join('-');
  };

  const handleRowClick = (order: SolarOrder) => {
    if (order.status === 'PENDING_APPROVAL' || order.status === 'REJECTED') {
      if (order.createdById !== currentUserId && !canApprove) {
        alert("This order is awaiting approval and cannot be opened yet.");
        return;
      }
    }
    window.location.href = `/staff/dashboard/solar-orders/orders/${order.id}`;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* Filters and Actions Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
            />
          </div>
          <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 xl:pb-0">
            {[
              { id: 'All', label: 'All', count: counts.all },
              { id: 'DRAFT', label: 'Draft', count: counts.draft },
              { id: 'PENDING_APPROVAL', label: 'Pending Approval', count: counts.pendingApproval },
              { id: 'EXECUTION', label: 'Execution', count: counts.execution },
              { id: 'COMPLETED', label: 'Completed', count: counts.completed },
              { id: 'REJECTED', label: 'Rejected', count: counts.rejected }
            ].map(status => (
              <button
                key={status.id}
                onClick={() => { setStatusFilter(status.id); setPage(1); }}
                className={`whitespace-nowrap px-3 py-1 text-[11px] font-medium rounded-full transition-all border flex items-center gap-1.5 ${
                  statusFilter === status.id 
                    ? 'bg-[#1A2766] text-white border-[#1A2766] shadow-sm' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                  statusFilter === status.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                }`}>
                  {status.count}
                </span>
              </button>
            ))}
          </div>
        </div>
        {canCreate ? (
          <Link
            href="/staff/dashboard/solar-orders/orders/new"
            className="flex items-center justify-center gap-2 bg-[#1A2766] text-white px-4 py-1.5 text-xs font-medium rounded-lg shadow-sm hover:bg-[#152054] transition-all w-full xl:w-auto active:scale-[0.98]"
          >
            <Plus size={14} />
            <span>New Order</span>
          </Link>
        ) : (
          <button
            disabled
            title="You do not have permission to create Solar Orders. Please contact your administrator."
            className="flex items-center justify-center gap-2 bg-[#1A2766] text-white px-4 py-1.5 text-xs font-medium rounded-lg shadow-sm w-full xl:w-auto opacity-50 cursor-not-allowed"
          >
            <Plus size={14} />
            <span>New Order</span>
          </button>
        )}
      </div>

      {/* Modern Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold tracking-wide text-[13.5px]">
              <tr>
                <th className="px-4 py-2 pl-6 w-10 text-center">#</th>
                <th className="px-4 py-2">Customer & Order</th>
                <th className="px-4 py-2">Lead Source</th>
                <th className="px-4 py-2">Assigned To</th>
                <th className="px-4 py-2">System Spec</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Pending Payment</th>
                <th className="px-4 py-2 w-40">Workflow %</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right pr-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[14px]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      <span className="text-sm">Fetching orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                      <Filter className="text-gray-300 mb-2" size={24} />
                      <p className="font-medium text-gray-900 text-sm">No orders found</p>
                      <p className="text-xs text-gray-500">Try adjusting your filters or search query.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const config = getStatusConfig(order.status);
                  const leadConfig = getLeadSourceBadge(order.leadSource);
                  const initials = order.customerName.substring(0, 2).toUpperCase();
                  const isLocked = (order.status === 'PENDING_APPROVAL' || order.status === 'REJECTED') && order.createdById !== currentUserId && !canApprove;
                  
                  const totalReceived = order.payments ? order.payments.reduce((acc, p) => acc + p.amount, 0) : 0;
                  const outstanding = order.totalOrderAmount - totalReceived;
                  const pendingPct = order.totalOrderAmount > 0 ? (outstanding / order.totalOrderAmount) * 100 : 0;
                  
                  return (
                    <tr key={order.id} className="group hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => handleRowClick(order)}>
                      <td className="px-4 py-2 pl-6 text-center font-medium text-gray-400">
                        {(page - 1) * limit + index + 1}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center text-[12px] font-bold text-gray-600 flex-shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{order.customerName}</div>
                            <div className="text-[12px] font-medium text-gray-500 mt-0.5">{order.orderNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${leadConfig.bg} ${leadConfig.text}`}>
                          {leadConfig.label}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {(() => {
                          if (order.leadSource === 'CALLING_ACTIVITY') {
                            return order.callingExecutive ? (
                              <div>
                                <div className="font-medium text-gray-900">{order.callingExecutive.name}</div>
                                <div className="text-[12px] text-gray-500">Calling Executive</div>
                              </div>
                            ) : '—';
                          }
                          if (order.leadSource === 'SUB_VENDOR') {
                            return order.subVendor ? (
                              <div>
                                <div className="font-medium text-gray-900">{order.subVendor.name}</div>
                                <div className="text-[12px] text-gray-500">Sub-Vendor</div>
                              </div>
                            ) : '—';
                          }
                          return order.salesman ? (
                            <div className="font-medium text-gray-900">{order.salesman.name}</div>
                          ) : '—';
                        })()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-gray-900">{order.systemSize} <span className="text-gray-500 text-[12px] font-medium">kW</span></div>
                        <div className="text-[12px] text-gray-500">{formatSystemType(order.systemType)}</div>
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        ₹{order.totalOrderAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2">
                        {outstanding <= 0 ? (
                          <>
                            <div className="font-semibold text-gray-900">₹0</div>
                            <div className="text-[12px] text-emerald-600 font-medium mt-0.5">Paid</div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-gray-900">₹{outstanding.toLocaleString('en-IN')}</div>
                            <div className="text-[12px] text-orange-600 font-medium mt-0.5">{pendingPct.toFixed(1)}% Pending</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="w-full max-w-[120px]">
                          <div className="flex items-center justify-between text-[9px] font-medium text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{config.progress}%</span>
                          </div>
                          <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${config.bg.replace('bg-', 'bg-').replace('-100', '-500')}`}
                              style={{ width: `${config.progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.text}`}>
                          <span className={`w-1 h-1 rounded-full ${config.dot}`}></span>
                          {order.status.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-4 py-2 pr-6 text-right">
                        {isLocked ? (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-300">
                            <Lock size={12} />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:bg-white hover:text-blue-600 hover:shadow-sm border border-transparent hover:border-gray-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <ArrowRight size={14} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {!loading && totalPages > 0 && (
          <div className="px-6 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
              <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, counts[statusFilter === 'All' ? 'all' : statusFilter === 'PENDING_APPROVAL' ? 'pendingApproval' : statusFilter.toLowerCase() as keyof Counts])} of {counts[statusFilter === 'All' ? 'all' : statusFilter === 'PENDING_APPROVAL' ? 'pendingApproval' : statusFilter.toLowerCase() as keyof Counts]}</span>
              <div className="h-3 w-px bg-gray-300"></div>
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select 
                  value={limit} 
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="bg-transparent border-none text-gray-700 font-semibold focus:ring-0 cursor-pointer text-[11px] py-0 pr-6"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="inline-flex items-center justify-center w-6 h-6 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[11px] font-medium px-2 text-gray-600">{page} / {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="inline-flex items-center justify-center w-6 h-6 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

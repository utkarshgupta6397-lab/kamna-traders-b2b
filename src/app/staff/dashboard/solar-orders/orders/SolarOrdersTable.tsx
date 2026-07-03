'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Plus, ChevronLeft, ChevronRight, ArrowRight, Lock, X, RefreshCw, Check } from 'lucide-react';
import { SOLAR_ORDER_STATUS_UI } from '@/lib/solar-workflow-config';

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
  receivedAmount: number;
  pendingAmount: number;
  leadSource: string;
  salesman: { name: string } | null;
  callingExecutive: { name: string } | null;
  subVendor: { name: string } | null;
  createdById: string;
  zohoBooksCustomerId?: string | null;
  zohoCustomerLinked?: boolean;
  pendingPaymentReason?: string | null;
  lastPaymentSyncAt?: string | null;
  workflowPercentage?: number;
  payments?: { amount: number }[];
}

interface SolarOrdersTableProps {
  currentUserId: string;
  canApprove: boolean;
  canCreate: boolean;
}

// Utility to determine Quarter
const getQuarter = (dateString: string): string => {
  const d = new Date(dateString);
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m < 3) return `Q1 ${y}`;
  if (m < 6) return `Q2 ${y}`;
  if (m < 9) return `Q3 ${y}`;
  return `Q4 ${y}`;
};

// UI helpers
const formatSystemType = (type: string) => {
  if (!type) return '';
  return type.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join('-');
};

const getLeadSourceBadge = (source: string) => {
  switch(source?.toUpperCase()) {
    case 'WALK_IN': 
    case 'WALK-IN': 
      return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Walk-in' };
    case 'WHATSAPP': 
    case 'ONLINE':
      return { bg: 'bg-green-50', text: 'text-green-700', label: 'Online' };
    case 'REFERRAL': 
      return { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Referral' };
    case 'FRIENDS & FAMILY':
    case 'FRIENDS_AND_FAMILY':
      return { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Friends & Family' };
    case 'CALLING_ACTIVITY': 
    case 'CALLING ACTIVITY': 
      return { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Calling Activity' };
    case 'SUB_VENDOR': 
    case 'SUB-VENDOR': 
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Sub-Vendor' };
    default: 
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Other' };
  }
};

export default function SolarOrdersTable({ currentUserId, canApprove, canCreate }: SolarOrdersTableProps) {
  const router = useRouter();

  // Data State
  const [allOrders, setAllOrders] = useState<SolarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingRows, setSyncingRows] = useState<Record<string, boolean>>({});
  const [bulkSyncProgress, setBulkSyncProgress] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{text: string, type: 'success'|'error'} | null>(null);

  // Filter State (Client-Side)
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Multi-select filters
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  
  // Search within filters
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [leadSourceSearch, setLeadSourceSearch] = useState('');

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortField, setSortField] = useState('orderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch all orders once
  const fetchAllOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/solar-orders?limit=all');
      if (res.ok) {
        const data = await res.json();
        setAllOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setToastMsg({ text: 'Failed to load orders', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, []);

  // Compute Filter Options and Counts dynamically
  const filteredOrders = useMemo(() => {
    let result = allOrders;

    // Apply Search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(o => 
        o.orderNumber.toLowerCase().includes(s) ||
        o.customerName.toLowerCase().includes(s) ||
        o.phoneNumber.includes(s) ||
        (o.zohoBooksCustomerId && o.zohoBooksCustomerId.toLowerCase().includes(s))
      );
    }

    // Apply Status Filter
    if (statusFilter !== 'All') {
      result = result.filter(o => {
        if (statusFilter === 'PENDING_APPROVAL') return o.status === 'PENDING_APPROVAL';
        if (statusFilter === 'EXECUTION') return ['APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS'].includes(o.status);
        if (statusFilter === 'COMPLETED') return o.status === 'COMPLETED';
        if (statusFilter === 'REJECTED') return ['REJECTED', 'CANCELLED'].includes(o.status);
        return true;
      });
    }

    // Apply Multi-select Filters
    if (systemTypes.length > 0) {
      result = result.filter(o => systemTypes.includes(o.systemType));
    }
    if (quarters.length > 0) {
      result = result.filter(o => quarters.includes(getQuarter(o.orderDate)));
    }
    if (leadSources.length > 0) {
      result = result.filter(o => leadSources.includes(o.leadSource));
    }
    if (assignedTo.length > 0) {
      result = result.filter(o => {
        const assignee = o.salesman?.name || o.callingExecutive?.name || o.subVendor?.name || 'Unassigned';
        return assignedTo.includes(assignee);
      });
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField as keyof SolarOrder];
      let valB: any = b[sortField as keyof SolarOrder];
      
      if (sortField === 'customerName') {
        valA = a.customerName.toLowerCase();
        valB = b.customerName.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allOrders, search, statusFilter, systemTypes, quarters, leadSources, assignedTo, sortField, sortDirection]);

  // Compute status counts based ONLY on search (not on active multi-filters, to match standard tab behavior)
  const statusCounts = useMemo(() => {
    let base = allOrders;
    if (search.trim()) {
      const s = search.toLowerCase();
      base = base.filter(o => 
        o.orderNumber.toLowerCase().includes(s) ||
        o.customerName.toLowerCase().includes(s) ||
        o.phoneNumber.includes(s)
      );
    }
    
    return {
      all: base.length,
      pendingApproval: base.filter(o => o.status === 'PENDING_APPROVAL').length,
      execution: base.filter(o => ['APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS'].includes(o.status)).length,
      completed: base.filter(o => o.status === 'COMPLETED').length,
      rejected: base.filter(o => ['REJECTED', 'CANCELLED'].includes(o.status)).length,
    };
  }, [allOrders, search]);

  // Generate dynamic filter options with counts based on current filtered dataset
  // We calculate counts for the options that would be visible if we apply them.
  const filterOptions = useMemo(() => {
    const opts = {
      systemTypes: {} as Record<string, number>,
      quarters: {} as Record<string, number>,
      leadSources: {} as Record<string, number>,
      assignees: {} as Record<string, number>
    };

    // Calculate dynamic counts. A standard pattern is:
    // For a filter category, count occurrences in the dataset filtered by ALL OTHER categories.
    // For simplicity, we just count based on the current filtered dataset, 
    // PLUS the currently selected options even if their count becomes 0, so they don't disappear while selected.
    
    // Actually, to make it exactly as user requested: 
    // "Every filter option should display record count... These counts should update dynamically based on the current filtered dataset. Only show relevant filter options... If there are no Hybrid systems currently visible, do NOT show Hybrid."
    
    filteredOrders.forEach(o => {
      // System Types
      const st = formatSystemType(o.systemType);
      opts.systemTypes[st] = (opts.systemTypes[st] || 0) + 1;
      
      // Quarters
      const q = getQuarter(o.orderDate);
      opts.quarters[q] = (opts.quarters[q] || 0) + 1;
      
      // Lead Sources
      const ls = o.leadSource || 'OTHER';
      opts.leadSources[ls] = (opts.leadSources[ls] || 0) + 1;
      
      // Assignees
      const assignee = o.salesman?.name || o.callingExecutive?.name || o.subVendor?.name || 'Unassigned';
      opts.assignees[assignee] = (opts.assignees[assignee] || 0) + 1;
    });

    // Ensure selected options remain visible even if count is 0 (so they can be deselected)
    systemTypes.forEach(t => { if (opts.systemTypes[formatSystemType(t)] === undefined) opts.systemTypes[formatSystemType(t)] = 0; });
    quarters.forEach(q => { if (opts.quarters[q] === undefined) opts.quarters[q] = 0; });
    leadSources.forEach(ls => { if (opts.leadSources[ls] === undefined) opts.leadSources[ls] = 0; });
    assignedTo.forEach(a => { if (opts.assignees[a] === undefined) opts.assignees[a] = 0; });

    return {
      systemTypes: Object.entries(opts.systemTypes).map(([k, v]) => ({ label: k, value: k.toUpperCase().replace('-', '_'), count: v })).sort((a,b) => b.count - a.count),
      quarters: Object.entries(opts.quarters).map(([k, v]) => ({ label: k, value: k, count: v })).sort((a,b) => {
        const [qA, yA] = a.label.split(' ');
        const [qB, yB] = b.label.split(' ');
        if (yA !== yB) return parseInt(yB) - parseInt(yA);
        return qA.localeCompare(qB);
      }),
      leadSources: Object.entries(opts.leadSources).map(([k, v]) => ({ label: getLeadSourceBadge(k).label, value: k, count: v })).sort((a,b) => b.count - a.count),
      assignees: Object.entries(opts.assignees).map(([k, v]) => ({ label: k, value: k, count: v })).sort((a,b) => b.count - a.count)
    };
  }, [filteredOrders, systemTypes, quarters, leadSources, assignedTo]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / limit);
  // Ensure page is valid after filtering
  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [totalPages, page]);
  
  const paginatedOrders = filteredOrders.slice((page - 1) * limit, page * limit);

  const activeFilterCount = systemTypes.length + quarters.length + leadSources.length + assignedTo.length;

  const resetFilters = () => {
    setSystemTypes([]);
    setQuarters([]);
    setLeadSources([]);
    setAssignedTo([]);
    setSearch('');
    setStatusFilter('All');
    setSortField('orderDate');
    setSortDirection('desc');
    setPage(1);
    setAssigneeSearch('');
    setLeadSourceSearch('');
  };

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    setPage(1);
  };

  // Click Handlers
  const handleRowClick = (order: SolarOrder) => {
    if (order.status === 'PENDING_APPROVAL' || order.status === 'REJECTED') {
      if (order.createdById !== currentUserId && !canApprove) {
        setToastMsg({ text: "This order is awaiting approval and cannot be opened yet.", type: 'error' });
        setTimeout(() => setToastMsg(null), 3000);
        return;
      }
    }
    router.push(`/staff/dashboard/solar-orders/orders/${order.id}`);
  };

  const handleSyncRow = async (e: React.MouseEvent, order: SolarOrder) => {
    e.stopPropagation();
    if (!order.zohoBooksCustomerId) {
      setToastMsg({ text: 'Order not mapped to Zoho yet.', type: 'error' });
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    setSyncingRows(prev => ({ ...prev, [order.id]: true }));
    try {
      const res = await fetch(`/api/solar-orders/${order.id}/sync-payments`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync');
      await fetchAllOrders();
      setToastMsg({ text: 'Payments updated.', type: 'success' });
    } catch (err) {
      console.error(err);
      setToastMsg({ text: 'Failed to sync payments.', type: 'error' });
    } finally {
      setSyncingRows(prev => ({ ...prev, [order.id]: false }));
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleBulkSync = async () => {
    try {
      setBulkSyncProgress("Fetching pending orders...");
      const res = await fetch('/api/solar-orders/pending-sync-list');
      const data = await res.json();
      const ids = data.ids || [];
      if (ids.length === 0) {
        setBulkSyncProgress(null);
        setToastMsg({ text: 'No pending orders to sync.', type: 'success' });
        setTimeout(() => setToastMsg(null), 3000);
        return;
      }
      for (let i = 0; i < ids.length; i++) {
        setBulkSyncProgress(`Updating ${i + 1} of ${ids.length}...`);
        await fetch(`/api/solar-orders/${ids[i]}/sync-payments`, { method: 'POST' });
      }
      setBulkSyncProgress("Pending payments updated successfully.");
      setTimeout(() => {
        setBulkSyncProgress(null);
        fetchAllOrders();
      }, 2000);
    } catch (err) {
      console.error(err);
      setBulkSyncProgress(null);
      setToastMsg({ text: 'Bulk sync failed.', type: 'error' });
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${toastMsg.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toastMsg.text}
        </div>
      )}
      
      {/* Filters and Actions Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-4 py-1.5 text-xs bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${showFilters || activeFilterCount > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            <Filter size={14} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`} {showFilters ? '▲' : '▼'}
          </button>

          <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 xl:pb-0">
            {[
              { id: 'All', label: 'All', count: statusCounts.all },
              { id: 'PENDING_APPROVAL', label: 'Pending Approval', count: statusCounts.pendingApproval },
              { id: 'EXECUTION', label: 'Execution', count: statusCounts.execution },
              { id: 'COMPLETED', label: 'Completed', count: statusCounts.completed },
              { id: 'REJECTED', label: 'Rejected', count: statusCounts.rejected }
            ].map(status => (
              <button
                key={status.id}
                onClick={() => { setStatusFilter(status.id); setPage(1); }}
                className={`whitespace-nowrap px-3 py-1 text-[11px] font-medium rounded-full transition-all border flex items-center gap-1.5 ${
                  statusFilter === status.id 
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                  statusFilter === status.id ? 'bg-blue-100' : 'bg-gray-100 text-gray-500'
                }`}>
                  {status.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto hide-scrollbar mt-2 xl:mt-0">
          {bulkSyncProgress ? (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-100 flex-shrink-0">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {bulkSyncProgress}
            </div>
          ) : (
            <button
              onClick={handleBulkSync}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shadow-sm flex-shrink-0"
            >
              <RefreshCw size={12} />
              Refresh Payments
            </button>
          )}

          {canCreate && (
            <Link href="/staff/dashboard/solar-orders/orders/new" className="flex-shrink-0">
              <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-medium text-xs transition-colors shadow-sm justify-center whitespace-nowrap">
                <Plus size={14} />
                <span>New Order</span>
              </button>
            </Link>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
          
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Filter size={16} className="text-blue-500" />
              Advanced Filters
            </h3>
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-orange-200">
                <X size={12} /> Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* System Type */}
            {filterOptions.systemTypes.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">System Type</label>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {filterOptions.systemTypes.map(opt => (
                    <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={systemTypes.includes(opt.value)} onChange={() => toggleArrayItem(setSystemTypes, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors">{opt.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Quarter */}
            {filterOptions.quarters.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Quarter</label>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {filterOptions.quarters.map(opt => (
                    <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={quarters.includes(opt.value)} onChange={() => toggleArrayItem(setQuarters, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors">{opt.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Lead Source */}
            {filterOptions.leadSources.length > 0 && (
              <div className="space-y-2 flex flex-col h-full">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Lead Source</label>
                <input 
                  type="text" 
                  placeholder="Search sources..." 
                  value={leadSourceSearch}
                  onChange={(e) => setLeadSourceSearch(e.target.value)}
                  className="w-full text-[10px] p-1.5 border border-gray-200 rounded mb-2 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400"
                />
                <div className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {filterOptions.leadSources.filter(o => o.label.toLowerCase().includes(leadSourceSearch.toLowerCase())).map(opt => (
                    <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={leadSources.includes(opt.value)} onChange={() => toggleArrayItem(setLeadSources, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors truncate max-w-[120px]">{opt.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned To */}
            {filterOptions.assignees.length > 0 && (
              <div className="space-y-2 flex flex-col h-full">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Assigned To</label>
                <input 
                  type="text" 
                  placeholder="Search assignees..." 
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  className="w-full text-[10px] p-1.5 border border-gray-200 rounded mb-2 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400"
                />
                <div className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {filterOptions.assignees.filter(o => o.label.toLowerCase().includes(assigneeSearch.toLowerCase())).map(opt => (
                    <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={assignedTo.includes(opt.value)} onChange={() => toggleArrayItem(setAssignedTo, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors truncate max-w-[120px]" title={opt.label}>{opt.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modern Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50/50">
          <div className="text-xs text-gray-500 font-medium">
            Sort By
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={sortField} 
              onChange={(e) => setSortField(e.target.value)}
              className="text-xs p-1.5 bg-transparent border-none focus:ring-0 text-gray-700 font-medium cursor-pointer"
            >
              <option value="orderDate">Order Date (Default)</option>
              <option value="orderAmount">Order Amount</option>
              <option value="pendingAmount">Pending Amount</option>
              <option value="customerName">Customer Name</option>
              <option value="systemSize">System Size</option>
            </select>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
              className="text-xs p-1.5 bg-transparent border-none focus:ring-0 text-gray-700 font-medium cursor-pointer"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap table-fixed">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold tracking-wide text-[13.5px]">
              <tr>
                <th className="px-4 py-2 pl-6 w-12 text-center">#</th>
                <th className="px-4 py-2 w-[250px]">Customer & Order</th>
                <th className="px-4 py-2 w-32">Lead Source</th>
                <th className="px-4 py-2 w-36">Assigned To</th>
                <th className="px-4 py-2 w-28">System Spec</th>
                <th className="px-4 py-2 w-28">Amount</th>
                <th className="px-4 py-2 w-36">Pending Payment</th>
                <th className="px-4 py-2 w-36">Workflow %</th>
                <th className="px-4 py-2 w-40">Status</th>
                <th className="px-4 py-2 text-right pr-6 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[14px]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium">Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                      <div className="bg-gray-50 p-4 rounded-full mb-2 border border-gray-100">
                        <Filter className="text-gray-400" size={32} />
                      </div>
                      <p className="font-bold text-gray-900 text-base">No orders match your filters</p>
                      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">Try adjusting your filters, searching for something else, or clearing all filters.</p>
                      {activeFilterCount > 0 && (
                        <button onClick={resetFilters} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  const config = SOLAR_ORDER_STATUS_UI[order.status] || SOLAR_ORDER_STATUS_UI.PENDING_APPROVAL;
                  const leadConfig = getLeadSourceBadge(order.leadSource);
                  const initials = order.customerName.substring(0, 2).toUpperCase();
                  const isLocked = (order.status === 'PENDING_APPROVAL' || order.status === 'REJECTED') && order.createdById !== currentUserId && !canApprove;
                  
                  const pendingAmt = order.pendingAmount ?? (order.totalOrderAmount - (order.payments ? order.payments.reduce((acc: any, p: any) => acc + p.amount, 0) : 0));
                  
                  const rowBg = order.status === 'PENDING_APPROVAL' ? 'bg-[#FFFBEA] hover:bg-[#FFF4D0]' : 'hover:bg-gray-50/80';
                  const isUnlinked = order.pendingPaymentReason === 'ZOHO_NOT_LINKED' || !order.zohoBooksCustomerId;
                  
                  return (
                    <tr key={order.id} className={`group ${rowBg} transition-colors cursor-pointer`} onClick={() => handleRowClick(order)}>
                      <td className="px-4 py-2 pl-6 text-center font-medium text-gray-400">
                        {(page - 1) * limit + index + 1}
                      </td>
                      <td className="px-4 py-2 truncate max-w-[250px]" title={`${order.customerName} - ${order.orderNumber}`}>
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center text-[12px] font-bold text-gray-600 flex-shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{order.customerName}</div>
                            <div className="text-[12px] font-medium text-gray-500 mt-0.5 truncate">
                              {order.orderNumber} • {new Date(order.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${leadConfig.bg} ${leadConfig.text}`}>
                          {leadConfig.label}
                        </div>
                        {order.leadSource === 'CALLING_ACTIVITY' && order.callingExecutive && (
                          <div className="text-[11px] text-gray-500 mt-1 truncate" title={order.callingExecutive.name}>
                            {order.callingExecutive.name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 truncate max-w-[144px]">
                        {(() => {
                          if (order.leadSource === 'SUB_VENDOR') {
                            return order.subVendor ? (
                              <div className="truncate">
                                <div className="font-medium text-gray-900 truncate" title={order.subVendor.name}>{order.subVendor.name}</div>
                                <div className="text-[11px] text-gray-500 truncate">Sub-Vendor</div>
                              </div>
                            ) : '—';
                          }
                          return order.salesman ? (
                            <div className="truncate">
                              <div className="font-medium text-gray-900 truncate" title={order.salesman.name}>{order.salesman.name}</div>
                              {order.leadSource === 'CALLING_ACTIVITY' && (
                                <div className="text-[11px] text-gray-500 truncate">Salesman</div>
                              )}
                            </div>
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
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            {isUnlinked ? (
                              <>
                                <div className="font-bold text-blue-600 text-[13px] truncate">₹{pendingAmt.toLocaleString('en-IN')}</div>
                                <div className="text-[10px] text-blue-400 font-semibold truncate">Not Linked to Zoho</div>
                              </>
                            ) : pendingAmt <= 0 ? (
                              <>
                                <div className="font-semibold text-green-600 flex items-center gap-1 text-[13px] truncate">₹0</div>
                                <div className="text-[11px] text-green-600 font-medium flex items-center gap-1 truncate"><Check size={10}/> Paid</div>
                              </>
                            ) : (
                              <>
                                <div className="font-semibold text-red-600 text-[13px] truncate">₹{pendingAmt.toLocaleString('en-IN')}</div>
                                <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap mt-0.5 truncate">
                                  {order.lastPaymentSyncAt ? `Synced: ${new Date(order.lastPaymentSyncAt).toLocaleDateString('en-IN', {month:'short', day:'numeric'})}` : 'Never synced'}
                                </div>
                              </>
                            )}
                          </div>
                          {!isUnlinked && (
                            <button 
                              onClick={(e) => handleSyncRow(e, order)}
                              disabled={syncingRows[order.id]}
                              className={`p-1.5 rounded border ${syncingRows[order.id] ? 'bg-blue-50 border-blue-200 text-blue-500' : 'bg-white border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300'} transition-all flex-shrink-0 group relative shadow-sm`}
                              title="Refresh latest verified payments from Zoho Books"
                            >
                              <RefreshCw size={12} className={syncingRows[order.id] ? 'animate-spin' : ''} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="w-full max-w-[100px]">
                          <div className="flex items-center justify-between text-[9px] font-medium text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{order.workflowPercentage || 0}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 bg-blue-500`}
                              style={{ width: `${order.workflowPercentage || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${config.bg} ${config.text}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                          {config.label || order.status.replace(/_/g, ' ')}
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
          <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
              <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, filteredOrders.length)} of {filteredOrders.length}</span>
              <div className="h-3 w-px bg-gray-300"></div>
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select 
                  value={limit} 
                  onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                  className="bg-transparent border-none text-gray-700 font-semibold focus:ring-0 cursor-pointer text-[11px] py-0 pr-6"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold px-3 text-gray-700">{page} <span className="text-gray-400 font-normal">/ {totalPages}</span></span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ChevronLeft, ChevronRight, ArrowRight, Lock, X, RefreshCw, Check, Filter, ClipboardList } from 'lucide-react';
import { SOLAR_ORDER_STATUS_UI } from '@/lib/solar-workflow-config';
import SortableTableHeader from '../components/SortableTableHeader';
import SolarQuickFilters from '../components/SolarQuickFilters';
import SolarAdvancedFilters from '../components/SolarAdvancedFilters';
import { useTableSorting } from '../hooks/useTableSorting';
import { useSolarFilters, formatSystemType, getLeadSourceBadge } from '../hooks/useSolarFilters';
import { useGlobalTaskDrawer } from '../components/global-tasks/GlobalTaskDrawerProvider';

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
  openTaskCount?: number;
  overdueTaskCount?: number;
  isCancelled?: boolean;
}

interface SolarOrdersTableProps {
  currentUserId: string;
  canApprove: boolean;
  canCreate: boolean;
}

// Extracted to useSolarFilters hook

export default function SolarOrdersTable({ currentUserId, canApprove, canCreate }: SolarOrdersTableProps) {
  console.log("Rendering SolarOrdersTable");
  const router = useRouter();

  // Data State
  const [allOrders, setAllOrders] = useState<SolarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingRows, setSyncingRows] = useState<Record<string, boolean>>({});
  const [bulkSyncProgress, setBulkSyncProgress] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{text: string, type: 'success'|'error'} | null>(null);
  const [filterOptions, setFilterOptions] = useState<any>({ systemTypes: [], quarters: [], leadSources: [], assignees: [] });
  const { openNewTaskModal } = useGlobalTaskDrawer();

  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusCounts, setStatusCounts] = useState<any>({ all: 0, pendingApproval: 0, execution: 0, completed: 0, rejected: 0, cancelled: 0 });

  const { sortField, sortDirection, handleSort, setSortField, setSortDirection } = useTableSorting('orderDate', 'desc');
  const filters = useSolarFilters();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', filters.page.toString());
      params.set('limit', filters.limit.toString());
      
      if (sortField) params.set('sortField', sortField);
      if (sortDirection) params.set('sortDirection', sortDirection);
      if (filters.search) params.set('search', filters.search);
      if (filters.statusFilter && filters.statusFilter !== 'All') params.set('status', filters.statusFilter);
      if (filters.hasOutstandingPayment) params.set('hasOutstandingPayment', 'true');
      
      if (filters.systemTypes.length > 0) params.set('systemType', filters.systemTypes.join(','));
      if (filters.quarters.length > 0) params.set('quarters', filters.quarters.join(','));
      if (filters.leadSources.length > 0) params.set('leadSource', filters.leadSources.join(','));
      if (filters.assignedTo.length > 0) params.set('assignedTo', filters.assignedTo.join(','));
      
      const res = await fetch(`/api/solar-orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAllOrders(data.orders || []);
        if (data.pagination) {
          setTotalPages(data.pagination.pages || 1);
          setTotalOrders(data.pagination.total || 0);
        }
        if (data.filterOptions) setFilterOptions(data.filterOptions);
        if (data.statusCounts) setStatusCounts(data.statusCounts);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setToastMsg({ text: 'Failed to load orders', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [
    sortField, sortDirection, filters.page, filters.limit, 
    filters.search, filters.statusFilter, filters.hasOutstandingPayment,
    filters.systemTypes, filters.quarters, filters.leadSources, filters.assignedTo
  ]);



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
      await fetchOrders();
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
        fetchOrders();
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
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-10 w-full overflow-hidden">
        <SolarQuickFilters 
          search={filters.search}
          setSearch={filters.setSearch}
          setPage={filters.setPage}
          showFilters={filters.showFilters}
          setShowFilters={filters.setShowFilters}
          activeFilterCount={filters.activeFilterCount}
          statusFilter={filters.statusFilter}
          setStatusFilter={filters.setStatusFilter}
          statusCounts={statusCounts}
          hasOutstandingPayment={filters.hasOutstandingPayment}
          setHasOutstandingPayment={filters.setHasOutstandingPayment}
        >
          {bulkSyncProgress ? (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-100 flex-shrink-0 h-8">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {bulkSyncProgress}
            </div>
          ) : (
            <button
              onClick={handleBulkSync}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shadow-sm flex-shrink-0 h-8"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          )}

          {canCreate && (
            <Link href="/staff/dashboard/solar-orders/orders/new" className="flex-shrink-0">
              <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-medium text-xs transition-colors shadow-sm justify-center whitespace-nowrap h-8">
                <Plus size={14} />
                <span>New Order</span>
              </button>
            </Link>
          )}
        </SolarQuickFilters>
      </div>

      {filters.showFilters && (
        <SolarAdvancedFilters 
          filterOptions={filterOptions}
          systemTypes={filters.systemTypes}
          setSystemTypes={filters.setSystemTypes}
          quarters={filters.quarters}
          setQuarters={filters.setQuarters}
          leadSources={filters.leadSources}
          setLeadSources={filters.setLeadSources}
          assignedTo={filters.assignedTo}
          setAssignedTo={filters.setAssignedTo}
          activeFilterCount={filters.activeFilterCount}
          resetFilters={filters.resetFilters}
          toggleArrayItem={filters.toggleArrayItem}
        />
      )}

      {/* Modern Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">


        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap table-fixed">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold tracking-wide text-[13.5px]">
              <tr>
                <th className="px-4 py-2 pl-6 w-12 text-center">#</th>
                <SortableTableHeader label="Customer & Order" field="customerName" currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} className="w-[250px]" />
                <SortableTableHeader label="Lead Source" field="leadSource" currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} className="w-32" />
                <SortableTableHeader label="Assigned To" field="assignedTo" currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} className="w-36" />
                <SortableTableHeader label="System Spec" field="systemSize" currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} className="w-28" />
                <SortableTableHeader label="Amount" field="orderAmount" currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} className="w-28" />
                <SortableTableHeader label="Pending Payment" field="pendingAmount" currentSortField={sortField} currentSortDirection={sortDirection} onSort={handleSort} className="w-36" />
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
              ) : allOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                      <div className="bg-gray-50 p-4 rounded-full mb-2 border border-gray-100">
                        <Filter className="text-gray-400" size={32} />
                      </div>
                      <p className="font-bold text-gray-900 text-base">No orders match your filters</p>
                      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">Try adjusting your filters, searching for something else, or clearing all filters.</p>
                      {filters.activeFilterCount > 0 && (
                        <button onClick={filters.resetFilters} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                allOrders.map((order, index) => {
                  const config = SOLAR_ORDER_STATUS_UI[order.status] || SOLAR_ORDER_STATUS_UI.PENDING_APPROVAL;
                  const leadConfig = getLeadSourceBadge(order.leadSource);
                  const initials = order.customerName.substring(0, 2).toUpperCase();
                  const isLocked = (order.status === 'PENDING_APPROVAL' || order.status === 'REJECTED') && order.createdById !== currentUserId && !canApprove;
                  
                  const isUnlinked = order.pendingPaymentReason === 'ZOHO_NOT_LINKED' || !order.zohoBooksCustomerId;
                  const rowBg = order.isCancelled ? 'bg-gray-50 opacity-60 hover:opacity-100 grayscale-[0.5]' : order.status === 'PENDING_APPROVAL' ? 'bg-[#FFFBEA] hover:bg-[#FFF4D0]' : 'hover:bg-gray-50/80';
                  
                  // ONE Source of Truth for Pending Payment
                  // If not linked to Zoho -> 100% pending (Total Order Amount)
                  // Never fallback to cached legacy payments (order.payments)
                  const pendingAmt = isUnlinked 
                    ? order.totalOrderAmount 
                    : (order.pendingAmount ?? order.totalOrderAmount);
                  
                  return (
                    <tr key={order.id} className={`group ${rowBg} transition-colors cursor-pointer`} onClick={() => handleRowClick(order)}>
                      <td className="px-4 py-2 pl-6 text-center font-medium text-gray-400">
                        {(filters.page - 1) * filters.limit + index + 1}
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
                        {['CALLING_ACTIVITY', 'CALLING ACTIVITY'].includes(order.leadSource?.toUpperCase() || '') && order.callingExecutive && (
                          <div className="text-[11px] text-gray-500 mt-1 truncate" title={order.callingExecutive.name}>
                            {order.callingExecutive.name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 truncate max-w-[144px]">
                        {(() => {
                          if (['SUB_VENDOR', 'SUB-VENDOR'].includes(order.leadSource?.toUpperCase() || '')) {
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
                              {['CALLING_ACTIVITY', 'CALLING ACTIVITY'].includes(order.leadSource?.toUpperCase() || '') && (
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(order.status)) {
                                alert('Tasks can only be created for active orders.');
                                return;
                              }
                              openNewTaskModal(order);
                            }}
                            className={`inline-flex items-center justify-center h-6 px-2 rounded text-[11px] font-bold transition-all ${
                              ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(order.status)
                                ? 'text-gray-300 cursor-not-allowed opacity-0 group-hover:opacity-100'
                                : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 opacity-0 group-hover:opacity-100 focus:opacity-100'
                            }`}
                            title={['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(order.status) ? "Tasks can only be created for active orders." : "Add Task"}
                            disabled={['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(order.status)}
                          >
                            + Task
                          </button>
                          {isLocked ? (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-300">
                              <Lock size={12} />
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(order);
                              }}
                              className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:bg-white hover:text-blue-600 hover:shadow-sm border border-transparent hover:border-gray-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            >
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
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
              <span>Showing {(filters.page - 1) * filters.limit + 1} to {Math.min(filters.page * filters.limit, totalOrders)} of {totalOrders}</span>
              <div className="h-3 w-px bg-gray-300"></div>
              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select 
                  value={filters.limit} 
                  onChange={(e) => { filters.setLimit(parseInt(e.target.value)); filters.setPage(1); }}
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
                disabled={filters.page === 1}
                onClick={() => filters.setPage(filters.page - 1)}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold px-3 text-gray-700">{filters.page} <span className="text-gray-400 font-normal">/ {totalPages}</span></span>
              <button
                disabled={filters.page === totalPages}
                onClick={() => filters.setPage(filters.page + 1)}
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

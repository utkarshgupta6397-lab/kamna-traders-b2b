'use client';

import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  AlertTriangle, 
  X, 
  Loader2, 
  ArrowUpDown, 
  RefreshCw,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createWarehouse, updateWarehouse, deleteWarehouse } from '../actions';

export interface WarehouseItem {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  zohoLocationId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isSystemWarehouse: boolean;
  printZonalSlips?: boolean;
}

export interface WarehousesManagerClientProps {
  initialWarehouses: WarehouseItem[];
  initialTotal: number;
  initialActiveCount: number;
  initialInactiveCount: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'status' | 'recently-added' | 'recently-modified';

export default function WarehousesManagerClient({
  initialWarehouses,
  initialTotal,
  initialActiveCount,
  initialInactiveCount,
}: WarehousesManagerClientProps) {
  // Master state
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>(initialWarehouses);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('recently-added');

  // Pagination / Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [infiniteScrollError, setInfiniteScrollError] = useState(false);
  const observerTargetRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<WarehouseItem | null>(null);

  // Pending transitions for actions
  const [isCreating, startCreateTransition] = useTransition();
  const [isEditing, startEditTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [pendingStatusIds, setPendingStatusIds] = useState<Record<string, boolean>>({});

  // Summary counts calculated from current dataset
  const totalCount = warehouses.length;
  const activeCount = useMemo(() => warehouses.filter(w => w.active).length, [warehouses]);
  const inactiveCount = useMemo(() => warehouses.filter(w => !w.active).length, [warehouses]);

  // Filtered & Sorted items
  const processedWarehouses = useMemo(() => {
    let result = [...warehouses];

    // Status filter
    if (statusFilter === 'ACTIVE') {
      result = result.filter(w => w.active);
    } else if (statusFilter === 'INACTIVE') {
      result = result.filter(w => !w.active);
    }

    // Search filter (Name, Address, Zoho Location ID)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(w => {
        const nameMatch = w.name?.toLowerCase().includes(q);
        const addressMatch = w.address?.toLowerCase().includes(q);
        const zohoMatch = w.zohoLocationId?.toLowerCase().includes(q);
        return Boolean(nameMatch || addressMatch || zohoMatch);
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOption === 'name-asc') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      if (sortOption === 'name-desc') {
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      }
      if (sortOption === 'status') {
        // Active first, then inactive
        if (a.active === b.active) {
          return a.name.localeCompare(b.name);
        }
        return a.active ? -1 : 1;
      }
      if (sortOption === 'recently-modified') {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      }
      // 'recently-added' default
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return result;
  }, [warehouses, statusFilter, searchQuery, sortOption]);

  // Reset infinite scroll pagination whenever filter or search or sort changes
  useEffect(() => {
    setVisibleCount(20);
    setInfiniteScrollError(false);
  }, [searchQuery, statusFilter, sortOption]);

  // Visible sliced items
  const displayedWarehouses = useMemo(() => {
    return processedWarehouses.slice(0, visibleCount);
  }, [processedWarehouses, visibleCount]);

  const hasMore = visibleCount < processedWarehouses.length;

  // Infinite scroll trigger via Intersection Observer
  useEffect(() => {
    if (!hasMore || isLoadingMore || infiniteScrollError) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          // Small smooth batch transition to avoid jank
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + 20, processedWarehouses.length));
            setIsLoadingMore(false);
          }, 200);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const el = observerTargetRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, isLoadingMore, infiniteScrollError, processedWarehouses.length]);

  // --- Handlers ---

  // Handle Toggle Active/Inactive
  const handleToggleStatus = (warehouse: WarehouseItem) => {
    if (pendingStatusIds[warehouse.id]) return; // Prevent duplicate rapid requests

    const newActive = !warehouse.active;
    const previousActive = warehouse.active;

    // Optimistically update
    setPendingStatusIds(prev => ({ ...prev, [warehouse.id]: true }));
    setWarehouses(prev => 
      prev.map(w => (w.id === warehouse.id ? { ...w, active: newActive, updatedAt: new Date() } : w))
    );

    const formData = new FormData();
    formData.append('id', warehouse.id);
    formData.append('name', warehouse.name);
    formData.append('address', warehouse.address || '');
    formData.append('zohoLocationId', warehouse.zohoLocationId || '');
    formData.append('active', String(newActive));

    startEditTransition(async () => {
      try {
        await updateWarehouse(formData);
        toast.success(`Warehouse "${warehouse.name}" marked as ${newActive ? 'Active' : 'Inactive'}`);
      } catch (err: any) {
        // Rollback optimistic update
        setWarehouses(prev => 
          prev.map(w => (w.id === warehouse.id ? { ...w, active: previousActive } : w))
        );
        toast.error(err?.message || 'Failed to update warehouse status');
      } finally {
        setPendingStatusIds(prev => {
          const copy = { ...prev };
          delete copy[warehouse.id];
          return copy;
        });
      }
    });
  };

  // Handle Add Warehouse
  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get('name') as string || '').trim();
    const address = (formData.get('address') as string || '').trim();
    const zohoLocationId = (formData.get('zohoLocationId') as string || '').trim();

    if (!name) {
      toast.error('Warehouse name is required');
      return;
    }
    if (!address) {
      toast.error('Warehouse address is required');
      return;
    }

    startCreateTransition(async () => {
      try {
        await createWarehouse(formData);
        toast.success('Warehouse created successfully!');
        // Locally add newly created placeholder item so user sees it immediately without full reload
        const newWarehouse: WarehouseItem = {
          id: 'temp-' + Date.now(),
          name,
          address,
          zohoLocationId: zohoLocationId || null,
          active: true,
          isSystemWarehouse: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setWarehouses(prev => [newWarehouse, ...prev]);
        setIsAddModalOpen(false);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to create warehouse');
      }
    });
  };

  // Handle Edit Warehouse
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingWarehouse) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get('name') as string || '').trim();
    const address = (formData.get('address') as string || '').trim();
    const zohoLocationId = (formData.get('zohoLocationId') as string || '').trim();
    const active = editingWarehouse.active;

    if (!name) {
      toast.error('Warehouse name is required');
      return;
    }
    if (!address) {
      toast.error('Warehouse address is required');
      return;
    }

    formData.append('id', editingWarehouse.id);
    formData.append('active', String(active));

    startEditTransition(async () => {
      try {
        await updateWarehouse(formData);
        toast.success('Warehouse updated successfully!');
        setWarehouses(prev => 
          prev.map(w => 
            w.id === editingWarehouse.id 
              ? { ...w, name, address, zohoLocationId: zohoLocationId || null, updatedAt: new Date() } 
              : w
          )
        );
        setEditingWarehouse(null);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update warehouse');
      }
    });
  };

  // Handle Permanent Delete
  const handleConfirmPermanentDelete = () => {
    if (!deletingWarehouse) return;
    const targetId = deletingWarehouse.id;
    const targetName = deletingWarehouse.name;

    startDeleteTransition(async () => {
      try {
        await deleteWarehouse(targetId);
        toast.success(`Warehouse "${targetName}" deleted successfully`);
        setWarehouses(prev => prev.filter(w => w.id !== targetId));
        setDeletingWarehouse(null);
      } catch (err: any) {
        // Authoritative server error (e.g., Cannot delete warehouse with mapped inventory or carts)
        toast.error(err?.message || 'Cannot delete warehouse because it is referenced or in use');
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* ─── 1. Minimal Header & Summary Cards ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#1A2766]" />
            Warehouses
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage physical fulfillment locations and Zoho Books warehouse IDs.
          </p>
        </div>

        {/* Compact Summary Cards */}
        <div className="flex items-center gap-2.5">
          {/* Total Card */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-lg border border-gray-200/80 shadow-xs">
            <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-[#1A2766]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Total</div>
              <div className="text-sm font-bold text-gray-900 leading-tight">{totalCount}</div>
            </div>
          </div>

          {/* Active Card */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-lg border border-emerald-100/90 shadow-xs">
            <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-emerald-600/80 tracking-wider">Active</div>
              <div className="text-sm font-bold text-emerald-700 leading-tight">{activeCount}</div>
            </div>
          </div>

          {/* Inactive Card */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-lg border border-amber-100/90 shadow-xs">
            <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center text-amber-600">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-amber-600/80 tracking-wider">Inactive</div>
              <div className="text-sm font-bold text-amber-700 leading-tight">{inactiveCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Toolbar (Search, Filter, Sort, Add Button) ─── */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search warehouse, address, Zoho ID..."
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] focus:bg-white outline-none transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none cursor-pointer"
            >
              <option value="ALL">All ({totalCount})</option>
              <option value="ACTIVE">Active Only ({activeCount})</option>
              <option value="INACTIVE">Inactive Only ({inactiveCount})</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-gray-400" />
              Sort:
            </span>
            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value as SortOption)}
              className="px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none cursor-pointer"
            >
              <option value="recently-added">Recently Added</option>
              <option value="recently-modified">Recently Modified</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="status">Status (Active first)</option>
            </select>
          </div>
        </div>

        {/* Action: + Add Warehouse Button */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#1A2766] hover:bg-[#141e50] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Add Warehouse
          </button>
        </div>
      </div>

      {/* ─── 3. Modern Warehouse Table ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Sticky Table Header */}
            <thead className="bg-gray-50/90 backdrop-blur-xs sticky top-0 z-10 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3 px-4 w-[240px]">Warehouse Name</th>
                <th className="py-3 px-4 min-w-[280px]">Address</th>
                <th className="py-3 px-4 w-[240px]">Zoho Books Warehouse ID</th>
                <th className="py-3 px-4 w-[140px]">Status</th>
                <th className="py-3 px-4 w-[120px] text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {displayedWarehouses.map(warehouse => {
                const isPendingStatus = Boolean(pendingStatusIds[warehouse.id]);
                return (
                  <tr 
                    key={warehouse.id} 
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    {/* Warehouse Name */}
                    <td className="py-3 px-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-[#1A2766]/10 group-hover:text-[#1A2766] transition-colors">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate max-w-[200px]" title={warehouse.name}>
                          {warehouse.name}
                        </span>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-3 px-4 text-gray-600">
                      <span className="line-clamp-2" title={warehouse.address || '-'}>
                        {warehouse.address || <span className="text-gray-400 italic">No address provided</span>}
                      </span>
                    </td>

                    {/* Zoho Books Warehouse ID */}
                    <td className="py-3 px-4">
                      {warehouse.zohoLocationId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] bg-slate-100 text-slate-800 border border-slate-200/80">
                          {warehouse.zohoLocationId}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Unmapped</span>
                      )}
                    </td>

                    {/* Status with Active/Inactive Toggle */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={warehouse.active}
                          disabled={isPendingStatus}
                          onClick={() => handleToggleStatus(warehouse)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 disabled:opacity-50 ${
                            warehouse.active ? 'bg-emerald-600' : 'bg-gray-300'
                          }`}
                          title={`Click to ${warehouse.active ? 'deactivate' : 'activate'}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              warehouse.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className={`text-[11px] font-semibold ${warehouse.active ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {isPendingStatus ? (
                            <span className="flex items-center gap-1 text-gray-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Updating...
                            </span>
                          ) : warehouse.active ? (
                            'Active'
                          ) : (
                            'Inactive'
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Row Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingWarehouse(warehouse)}
                          className="p-1.5 text-gray-500 hover:text-[#1A2766] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          title="Edit Warehouse"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeletingWarehouse(warehouse)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title="Delete / Deactivate Warehouse"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty States */}
        {displayedWarehouses.length === 0 && (
          <div className="py-14 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            {warehouses.length === 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-gray-900">No warehouses registered</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Get started by adding your first warehouse using the button below.
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-3.5 inline-flex items-center gap-1 px-3 py-1.5 bg-[#1A2766] text-white rounded-lg text-xs font-semibold hover:bg-[#141e50] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Warehouse
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-gray-900">No matching warehouses</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  No warehouses matched your search or status filter. Try clearing your filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  }}
                  className="mt-3.5 inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Infinite Scroll Sensor & Status Footer */}
        {displayedWarehouses.length > 0 && (
          <div className="py-3 px-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
            <div>
              Showing <span className="font-semibold text-gray-800">{displayedWarehouses.length}</span> of{' '}
              <span className="font-semibold text-gray-800">{processedWarehouses.length}</span> warehouses
              {processedWarehouses.length !== warehouses.length && (
                <span className="text-gray-400"> (filtered from {warehouses.length} total)</span>
              )}
            </div>

            {/* Target sensor for infinite scroll */}
            <div ref={observerTargetRef} className="flex items-center">
              {isLoadingMore && (
                <span className="flex items-center gap-1.5 text-xs text-[#1A2766] font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading more warehouses...
                </span>
              )}
              {infiniteScrollError && (
                <button
                  onClick={() => {
                    setInfiniteScrollError(false);
                    setVisibleCount(prev => Math.min(prev + 20, processedWarehouses.length));
                  }}
                  className="flex items-center gap-1 text-xs text-red-600 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Failed to load. Click to retry.
                </button>
              )}
              {!hasMore && processedWarehouses.length > 0 && (
                <span className="text-[11px] text-gray-400 font-medium">
                  All warehouses loaded
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. Add Warehouse Modal ─── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1A2766]" />
                <h2 className="text-sm font-semibold text-gray-900">Add New Warehouse</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isCreating}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Warehouse Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Main Hub Warehouse"
                  disabled={isCreating}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="address"
                  required
                  rows={3}
                  placeholder="Full physical street address..."
                  disabled={isCreating}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Zoho Books Warehouse ID
                </label>
                <input
                  type="text"
                  name="zohoLocationId"
                  placeholder="e.g. 1759923000003192244"
                  disabled={isCreating}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Optional. Required for syncing stock movements with Zoho Books.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isCreating}
                  className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A2766] hover:bg-[#141e50] disabled:bg-gray-300 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Warehouse'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 5. Edit Warehouse Modal ─── */}
      {editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1A2766]" />
                <h2 className="text-sm font-semibold text-gray-900">Edit Warehouse</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingWarehouse(null)}
                disabled={isEditing}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Warehouse Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingWarehouse.name}
                  disabled={isEditing}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="address"
                  required
                  rows={3}
                  defaultValue={editingWarehouse.address || ''}
                  disabled={isEditing}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Zoho Books Warehouse ID
                </label>
                <input
                  type="text"
                  name="zohoLocationId"
                  defaultValue={editingWarehouse.zohoLocationId || ''}
                  placeholder="e.g. 1759923000003192244"
                  disabled={isEditing}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200/60 flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">Status</span>
                <span className={`font-semibold ${editingWarehouse.active ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {editingWarehouse.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingWarehouse(null)}
                  disabled={isEditing}
                  className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A2766] hover:bg-[#141e50] disabled:bg-gray-300 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isEditing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Deactivation-First / Delete Confirmation Modal ─── */}
      {deletingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="text-sm font-semibold">Delete Warehouse</h2>
              </div>
              <button
                type="button"
                onClick={() => setDeletingWarehouse(null)}
                disabled={isDeleting}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-gray-600">
              <p>
                Are you sure you want to delete warehouse{' '}
                <strong className="text-gray-900 font-semibold">{deletingWarehouse.name}</strong>?
              </p>

              {/* Recommended Deactivation Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg flex items-start gap-2.5 text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Recommended: Deactivate instead</div>
                  <div className="text-[11px] leading-relaxed text-amber-800">
                    Deactivating preserves historical carts, stock ledger audits, and transfers while hiding this warehouse from new operations. Permanent deletion is blocked if the warehouse has linked records.
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2">
                {/* Deactivate Option Button */}
                {deletingWarehouse.active && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      const w = deletingWarehouse;
                      setDeletingWarehouse(null);
                      handleToggleStatus(w);
                    }}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center"
                  >
                    Deactivate Instead (Recommended)
                  </button>
                )}

                <div className="flex items-center justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setDeletingWarehouse(null)}
                    disabled={isDeleting}
                    className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPermanentDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Permanent Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

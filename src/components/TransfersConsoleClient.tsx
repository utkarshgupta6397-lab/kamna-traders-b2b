'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, Search, Filter, Calendar, CheckCircle2, AlertCircle, XCircle, 
  Printer, Trash2, GitMerge, Loader2, X, Eye, ArrowRightLeft, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

type Warehouse = {
  id: string;
  name: string;
  active: boolean;
};

type Sku = {
  id: string;
  name: string;
  unit: string | null;
  isUnlimited: boolean;
};

type TransferItemFormatted = {
  id: string;
  transferId: string;
  skuId: string;
  sku: {
    name: string;
    unit: string | null;
    isUnlimited: boolean;
  };
  requestedQty: number;
  dispatchedQty: number;
  balanceQty: number;
};

type TransferFormatted = {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  status: 'INITIATED' | 'PARTIALLY_DISPATCHED' | 'IN_TRANSIT' | 'CANCELLED' | 'MERGED' | 'DISPATCHED_PARTIAL_CLOSED';
  responsiblePerson: string;
  remarks: string | null;
  createdByName: string;
  dispatchedByName: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  parentTransferId?: string | null;
  parentTransferNumber?: string | null;
  totalSKUs: number;
  totalUnits: number;
};

type Props = {
  session: any;
  warehouses: Warehouse[];
  skus: Sku[];
};

export default function TransfersConsoleClient({ session, warehouses, skus }: Props) {
  const router = useRouter();

  // State
  const [transfers, setTransfers] = useState<TransferFormatted[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Modals state
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [detailedTransfer, setDetailedTransfer] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form State - Initiate Transfer
  const [initSourceWh, setInitSourceWh] = useState('');
  const [initDestWh, setInitDestWh] = useState('');
  const [initResponsible, setInitResponsible] = useState('');
  const [initRemarks, setInitRemarks] = useState('');
  const [initItems, setInitItems] = useState<{ skuId: string; qty: number }[]>([]);
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [selectedSkuQty, setSelectedSkuQty] = useState(1);
  const [submittingInitiate, setSubmittingInitiate] = useState(false);
  const [sourceWarehouseStock, setSourceWarehouseStock] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(false);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

  // Fetch stock levels when source warehouse changes
  useEffect(() => {
    if (!initSourceWh) {
      setSourceWarehouseStock({});
      return;
    }
    const fetchStock = async () => {
      setLoadingStock(true);
      try {
        const res = await fetch(`/api/staff/inventory/stock?warehouseId=${initSourceWh}`);
        if (!res.ok) throw new Error('Failed to fetch stock levels');
        const data = await res.json();
        setSourceWarehouseStock(data || {});
      } catch (err: any) {
        toast.error(err.message || 'Error loading stock levels');
      } finally {
        setLoadingStock(false);
      }
    };
    fetchStock();
  }, [initSourceWh]);

  // Toast warning when same warehouses are selected
  useEffect(() => {
    if (initSourceWh && initDestWh && initSourceWh === initDestWh) {
      toast.error('Source and destination warehouse cannot be the same.');
    }
  }, [initSourceWh, initDestWh]);

  // Reset selected items and sku selection when source warehouse changes
  useEffect(() => {
    setSelectedSkuId('');
    setSkuSearchQuery('');
    setInitItems([]);
  }, [initSourceWh]);

  // Form State - Dispatch Transfer
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  // Load transfers
  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus !== 'ALL') queryParams.append('status', filterStatus);
      if (filterWarehouse !== 'ALL') queryParams.append('warehouse', filterWarehouse);
      if (filterSearch) queryParams.append('search', filterSearch);
      if (filterDateStart) queryParams.append('dateStart', filterDateStart);
      if (filterDateEnd) queryParams.append('dateEnd', filterDateEnd);

      const res = await fetch(`/api/staff/transfers?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transfers');
      const data = await res.json();
      setTransfers(data);
    } catch (err: any) {
      toast.error(err.message || 'Error loading transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [filterStatus, filterWarehouse, filterDateStart, filterDateEnd]);

  // Handle Search submit / trigger
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchTransfers();
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    return {
      initiated: transfers.filter(t => t.status === 'INITIATED').length,
      inTransit: transfers.filter(t => t.status === 'IN_TRANSIT').length,
      partial: transfers.filter(t => t.status === 'PARTIALLY_DISPATCHED' || t.status === 'DISPATCHED_PARTIAL_CLOSED').length,
      cancelled: transfers.filter(t => t.status === 'CANCELLED').length
    };
  }, [transfers]);

  // Filtered SKUs for combobox selection
  const filteredSkus = useMemo(() => {
    const isSelectedMatch = selectedSkuId && skuSearchQuery.startsWith(selectedSkuId);
    const query = isSelectedMatch ? '' : skuSearchQuery.toLowerCase();
    
    if (!query) return skus.slice(0, 100);
    return skus.filter(s => 
      s.id.toLowerCase().includes(query) || 
      s.name.toLowerCase().includes(query)
    ).slice(0, 100);
  }, [skus, skuSearchQuery, selectedSkuId]);

  // Total Units in the current initiation form
  const totalUnits = useMemo(() => {
    return initItems.reduce((sum, item) => sum + item.qty, 0);
  }, [initItems]);
  // Derive selected SKU stock details
  const selectedSku = useMemo(() => {
    return skus.find(s => s.id === selectedSkuId);
  }, [skus, selectedSkuId]);

  const availableStock = useMemo(() => {
    if (!selectedSku) return 0;
    if (selectedSku.isUnlimited) return Infinity;
    return sourceWarehouseStock[selectedSkuId] ?? 0;
  }, [selectedSku, sourceWarehouseStock, selectedSkuId]);

  // isQtyInvalid is true if we have a selected normal SKU and selectedSkuQty > availableStock
  const isQtyInvalid = useMemo(() => {
    if (!selectedSku || selectedSku.isUnlimited) return false;
    return selectedSkuQty > availableStock;
  }, [selectedSku, selectedSkuQty, availableStock]);

  const hasInvalidItems = useMemo(() => {
    return initItems.some(item => {
      const s = skus.find(sku => sku.id === item.skuId);
      if (!s || s.isUnlimited) return false;
      const avail = sourceWarehouseStock[item.skuId] ?? 0;
      return item.qty > avail;
    });
  }, [initItems, skus, sourceWarehouseStock]);
  // Reset filter helpers
  const clearFilters = () => {
    setFilterSearch('');
    setFilterStatus('ALL');
    setFilterWarehouse('ALL');
    setFilterDateStart('');
    setFilterDateEnd('');
    // Trigger reloading
    setTimeout(() => {
      fetchTransfers();
    }, 50);
  };

  // Checkbox Selection for Merging
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select row if status is INITIATED
      const checkable = transfers.filter(t => t.status === 'INITIATED').map(t => t.id);
      setSelectedIds(checkable);
    } else {
      setSelectedIds([]);
    }
  };

  // Validate if merge is possible
  const canMergeSelected = useMemo(() => {
    if (selectedIds.length < 2) return false;
    const selectedTransfers = transfers.filter(t => selectedIds.includes(t.id));
    if (selectedTransfers.length !== selectedIds.length) return false;

    // Must all be INITIATED
    const allInitiated = selectedTransfers.every(t => t.status === 'INITIATED');
    if (!allInitiated) return false;

    // Must share same source
    const sourceWh = selectedTransfers[0].sourceWarehouseId;
    const sameSource = selectedTransfers.every(t => t.sourceWarehouseId === sourceWh);
    if (!sameSource) return false;

    // Must share same dest
    const destWh = selectedTransfers[0].destinationWarehouseId;
    const sameDest = selectedTransfers.every(t => t.destinationWarehouseId === destWh);
    return sameDest;
  }, [selectedIds, transfers]);

  // Execute Merge
  const handleMergeTransfers = async () => {
    if (!canMergeSelected) return;

    const confirmMerge = window.confirm(`Are you sure you want to merge ${selectedIds.length} transfers? This action is irreversible.`);
    if (!confirmMerge) return;

    try {
      const res = await fetch('/api/staff/transfers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferIds: selectedIds })
      });
      let errorMsg = 'Failed to merge transfers';
      try {
        const text = await res.text();
        const data = JSON.parse(text);
        if (data && data.error) errorMsg = data.error;
      } catch (parseErr) {
        if (!res.ok) {
          errorMsg = `Server error (${res.status}): ${res.statusText || 'Internal Server Error'}`;
        }
      }
      if (!res.ok) throw new Error(errorMsg);

      toast.success('Transfers merged successfully!');
      setSelectedIds([]);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error merging transfers');
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (id: string) => {
    setSelectedTransferId(id);
    setShowDetailModal(true);
    setLoadingDetails(true);
    setDetailedTransfer(null);
    try {
      const res = await fetch(`/api/staff/transfers/${id}`);
      if (!res.ok) throw new Error('Failed to load transfer details');
      const data = await res.json();
      setDetailedTransfer(data);
    } catch (err: any) {
      toast.error(err.message || 'Error loading details');
      setShowDetailModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Dispatch Modal
  const handleOpenDispatch = async (id: string) => {
    setSelectedTransferId(id);
    setShowDispatchModal(true);
    setLoadingDetails(true);
    setDetailedTransfer(null);
    setDispatchQuantities({});
    try {
      const res = await fetch(`/api/staff/transfers/${id}`);
      if (!res.ok) throw new Error('Failed to load transfer details');
      const data = await res.json();
      setDetailedTransfer(data);
      // Pre-fill quantities default to balanceQty
      const initialQtys: Record<string, number> = {};
      data.items.forEach((item: TransferItemFormatted) => {
        initialQtys[item.skuId] = item.balanceQty;
      });
      setDispatchQuantities(initialQtys);
    } catch (err: any) {
      toast.error(err.message || 'Error loading details');
      setShowDispatchModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Submit Dispatch
  const handleConfirmDispatch = async () => {
    if (!detailedTransfer) return;

    const itemsToDispatch = Object.entries(dispatchQuantities)
      .map(([skuId, dispatchQty]) => ({ skuId, dispatchQty: Number(dispatchQty) }))
      .filter(item => item.dispatchQty > 0);

    if (itemsToDispatch.length === 0) {
      toast.error('Please enter a dispatch quantity greater than 0 for at least one item');
      return;
    }

    setSubmittingDispatch(true);
    try {
      const res = await fetch(`/api/staff/transfers/${detailedTransfer.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dispatch',
          items: itemsToDispatch
        })
      });
      let errorMsg = 'Failed to dispatch transfer';
      try {
        const text = await res.text();
        const data = JSON.parse(text);
        if (data && data.error) errorMsg = data.error;
      } catch (parseErr) {
        if (!res.ok) {
          errorMsg = `Server error (${res.status}): ${res.statusText || 'Internal Server Error'}`;
        }
      }
      if (!res.ok) throw new Error(errorMsg);

      toast.success('Transfer dispatched successfully!');
      setShowDispatchModal(false);
      fetchTransfers();
      router.push(`/staff/dashboard/transfers/print/${detailedTransfer.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Error dispatching transfer');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  // Cancel Transfer
  const handleCancelTransfer = async (id: string) => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this transfer? This will lock it and prevent dispatch.');
    if (!confirmCancel) return;

    try {
      const res = await fetch(`/api/staff/transfers/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      });
      let errorMsg = 'Failed to cancel transfer';
      try {
        const text = await res.text();
        const data = JSON.parse(text);
        if (data && data.error) errorMsg = data.error;
      } catch (parseErr) {
        if (!res.ok) {
          errorMsg = `Server error (${res.status}): ${res.statusText || 'Internal Server Error'}`;
        }
      }
      if (!res.ok) throw new Error(errorMsg);

      toast.success('Transfer cancelled successfully!');
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error cancelling transfer');
    }
  };

  // Add Item to Initiate Form
  const handleAddItemToInitiate = () => {
    if (!selectedSkuId) {
      toast.error('Please select a SKU first');
      return;
    }
    if (selectedSkuQty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (isQtyInvalid) {
      toast.error('Cannot add. Entered quantity exceeds available stock.');
      return;
    }

    const skuInfo = skus.find(s => s.id === selectedSkuId);
    if (!skuInfo) return;

    // Check available stock if not unlimited
    if (!skuInfo.isUnlimited) {
      const availQty = sourceWarehouseStock[selectedSkuId] ?? 0;
      const existingItem = initItems.find(i => i.skuId === selectedSkuId);
      const totalQty = (existingItem?.qty || 0) + selectedSkuQty;

      if (totalQty > availQty) {
        toast.error(`Cannot add. Total requested quantity (${totalQty}) exceeds available stock (${availQty}) for SKU [${selectedSkuId}] ${skuInfo.name}.`);
        return;
      }
    }

    if (initItems.some(i => i.skuId === selectedSkuId)) {
      setInitItems(prev => prev.map(i => i.skuId === selectedSkuId ? { ...i, qty: i.qty + selectedSkuQty } : i));
      toast.success(`Updated quantity for ${skuInfo.name}`);
    } else {
      setInitItems(prev => [...prev, { skuId: selectedSkuId, qty: selectedSkuQty }]);
      toast.success(`Added ${skuInfo.name} to transfer list`);
    }

    // Reset picker state
    setSelectedSkuId('');
    setSkuSearchQuery('');
    setSelectedSkuQty(1);
  };

  // Remove Item from Initiate Form
  const handleRemoveItemFromInitiate = (skuId: string) => {
    setInitItems(prev => prev.filter(i => i.skuId !== skuId));
  };

  // Submit Initiate Form
  const handleInitiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initSourceWh || !initDestWh || !initResponsible) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (initSourceWh === initDestWh) {
      toast.error('Source and destination warehouse cannot be the same.');
      return;
    }
    if (initItems.length === 0) {
      toast.error('Please add at least one item to the transfer request');
      return;
    }

    setSubmittingInitiate(true);
    try {
      const res = await fetch('/api/staff/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWarehouseId: initSourceWh,
          destinationWarehouseId: initDestWh,
          responsiblePerson: initResponsible,
          remarks: initRemarks || undefined,
          items: initItems.map(item => ({ skuId: item.skuId, requestedQty: item.qty }))
        })
      });

      let errorMsg = 'Failed to initiate transfer';
      try {
        const text = await res.text();
        const data = JSON.parse(text);
        if (data && data.error) errorMsg = data.error;
      } catch (parseErr) {
        if (!res.ok) {
          errorMsg = `Server error (${res.status}): ${res.statusText || 'Internal Server Error'}`;
        }
      }

      if (!res.ok) throw new Error(errorMsg);

      toast.success('Transfer initiated successfully!');
      setShowInitiateModal(false);
      // Reset form
      setInitSourceWh('');
      setInitDestWh('');
      setInitResponsible('');
      setInitRemarks('');
      setInitItems([]);
      fetchTransfers();
    } catch (err: any) {
      toast.error(err.message || 'Error initiating transfer');
    } finally {
      setSubmittingInitiate(false);
    }
  };

  const getStatusBadge = (status: TransferFormatted['status']) => {
    switch (status) {
      case 'INITIATED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">INITIATED</span>;
      case 'PARTIALLY_DISPATCHED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">PARTIAL DISPATCH</span>;
      case 'IN_TRANSIT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">IN TRANSIT</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-200">CANCELLED</span>;
      case 'MERGED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">MERGED</span>;
      case 'DISPATCHED_PARTIAL_CLOSED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">PARTIAL CLOSED</span>;
    }
  };

  const isWarehouseSectionInvalid = !initSourceWh || !initDestWh || (initSourceWh === initDestWh);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Warehouse Stock Transfers</h1>
          <p className="text-xs text-gray-500">Track, initiate, dispatch, and merge stock transfers between warehouses</p>
        </div>

        <div className="flex items-center gap-3">
          {canMergeSelected && (
            <button
              onClick={handleMergeTransfers}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              <GitMerge size={14} />
              Merge Selected ({selectedIds.length})
            </button>
          )}

          {(session.canManageTransfers || session.role === 'ADMIN') && (
            <button
              onClick={() => setShowInitiateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#AE1B1E] hover:bg-red-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              <Plus size={14} />
              Initiate Transfer
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Initiated</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{loading ? '-' : kpis.initiated}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">In Transit</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{loading ? '-' : kpis.inTransit}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Partial Dispatch</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{loading ? '-' : kpis.partial}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cancelled</p>
          <p className="text-2xl font-bold text-gray-500 mt-1">{loading ? '-' : kpis.cancelled}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search Transfer No, Person, Remarks... (Press Enter)"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 w-full border border-gray-200 rounded-lg text-xs focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="INITIATED">Initiated</option>
              <option value="PARTIALLY_DISPATCHED">Partially Dispatched</option>
              <option value="DISPATCHED_PARTIAL_CLOSED">Partial Closed</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="MERGED">Merged</option>
            </select>
          </div>

          {/* Warehouse */}
          <div>
            <select
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              className="px-3 py-2 w-full border border-gray-200 rounded-lg text-xs focus:outline-none"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={fetchTransfers}
              className="flex-1 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs transition-colors"
              title="Clear Filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-50 text-xs text-gray-500">
          <Calendar size={14} className="text-gray-400" />
          <span>Date Created:</span>
          <input
            type="date"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none"
          />
          <span>to</span>
          <input
            type="date"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 className="animate-spin text-red-600" size={24} />
            <p className="text-xs">Loading transfer registry...</p>
          </div>
        ) : transfers.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-xs">
            No transfers found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      checked={
                        transfers.filter(t => t.status === 'INITIATED').length > 0 &&
                        transfers.filter(t => t.status === 'INITIATED').every(t => selectedIds.includes(t.id))
                      }
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                  </th>
                  <th className="p-3">Transfer No</th>
                  <th className="p-3">Source Warehouse</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Responsible</th>
                  <th className="p-3">SKUs / Units</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transfers.map(t => (
                  <tr 
                    key={t.id} 
                    className={`hover:bg-gray-50/50 transition-colors ${
                      t.status === 'CANCELLED' || t.status === 'MERGED' ? 'opacity-60 bg-gray-50/10' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      {t.status === 'INITIATED' ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => handleSelectRow(t.id)}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-gray-900">
                      <div>{t.transferNumber}</div>
                      {t.parentTransferNumber && (
                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                          Child of {t.parentTransferNumber}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-medium">{t.sourceWarehouseName}</td>
                    <td className="p-3 font-medium">{t.destinationWarehouseName}</td>
                    <td className="p-3 text-gray-700">{t.responsiblePerson}</td>
                    <td className="p-3 text-gray-500 font-medium">
                      {t.totalSKUs} SKUs ({t.totalUnits} Units)
                    </td>
                    <td className="p-3">{getStatusBadge(t.status)}</td>
                    <td className="p-3 text-gray-400">
                      {new Date(t.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenDetails(t.id)}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        
                        {(t.status === 'INITIATED' || t.status === 'PARTIALLY_DISPATCHED') && (
                          <button
                            onClick={() => handleOpenDispatch(t.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded font-bold flex items-center gap-1 px-2.5 py-1 text-[10px]"
                            title="Dispatch Stock"
                          >
                            <ArrowRight size={10} />
                            Dispatch
                          </button>
                        )}

                        {(t.status === 'PARTIALLY_DISPATCHED' || t.status === 'IN_TRANSIT') && (
                          <Link
                            href={`/staff/dashboard/transfers/print/${t.id}`}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                            title="Print Slip"
                          >
                            <Printer size={14} />
                          </Link>
                        )}

                        {t.status === 'INITIATED' && (session.canDeleteTransfers || session.role === 'ADMIN') && (
                          <button
                            onClick={() => handleCancelTransfer(t.id)}
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded"
                            title="Cancel Transfer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: INITIATE TRANSFER ────────────────────────────────────── */}
      {showInitiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-[#1A2766] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={18} />
                <h3 className="font-bold text-sm">Initiate New Stock Transfer</h3>
              </div>
              <button 
                onClick={() => setShowInitiateModal(false)}
                className="hover:bg-white/10 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleInitiateSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Source Warehouse */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Source Warehouse *</label>
                  <select
                    value={initSourceWh}
                    onChange={(e) => setInitSourceWh(e.target.value)}
                    required
                    disabled={submittingInitiate}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select Source</option>
                    {warehouses.filter(w => w.id !== 'IN_TRANSIT').map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Destination Warehouse */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Destination Warehouse *</label>
                  <select
                    value={initDestWh}
                    onChange={(e) => setInitDestWh(e.target.value)}
                    required
                    disabled={submittingInitiate}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select Destination</option>
                    {warehouses.filter(w => w.id !== 'IN_TRANSIT').map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Responsible Person */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Responsible Person *</label>
                  <input
                    type="text"
                    required
                    disabled={submittingInitiate}
                    value={initResponsible}
                    onChange={(e) => setInitResponsible(e.target.value)}
                    placeholder="E.g. Driver Name / Warehouse Head"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Remarks (Optional)</label>
                  <input
                    type="text"
                    disabled={submittingInitiate}
                    value={initRemarks}
                    onChange={(e) => setInitRemarks(e.target.value)}
                    placeholder="Purpose of transfer"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>

              {/* SKU Picker Section */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-800">Add SKUs to Transfer Request</h4>
                {isWarehouseSectionInvalid && (
                  <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5 font-medium">
                    <AlertCircle size={14} />
                    Please select valid and different Source and Destination warehouses to unlock SKU selection.
                  </p>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <label className="block text-[10px] text-gray-400 uppercase mb-1">Search SKU</label>
                    <input
                      type="text"
                      disabled={submittingInitiate || isWarehouseSectionInvalid}
                      placeholder={isWarehouseSectionInvalid ? "Select warehouses first" : "Search by SKU ID or Name..."}
                      value={skuSearchQuery}
                      onChange={(e) => {
                        setSkuSearchQuery(e.target.value);
                        setShowSkuDropdown(true);
                        if (selectedSkuId) setSelectedSkuId('');
                      }}
                      onFocus={() => {
                        if (!isWarehouseSectionInvalid) setShowSkuDropdown(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400 font-medium placeholder-gray-400"
                    />
                    
                    {/* Combobox Dropdown Option Overlay & Container */}
                    {showSkuDropdown && !isWarehouseSectionInvalid && (
                      <>
                        <div className="fixed inset-0 z-50" onClick={() => setShowSkuDropdown(false)} />
                        <div className="absolute z-[60] left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-50">
                          {loadingStock ? (
                            <div className="p-3 text-center text-xs text-gray-500 flex items-center justify-center gap-1">
                              <Loader2 className="animate-spin text-red-600" size={14} /> Loading stock levels...
                            </div>
                          ) : filteredSkus.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-500">
                              No matching SKUs found
                            </div>
                          ) : (
                            filteredSkus.map(s => {
                              const availQtyNum = sourceWarehouseStock[s.id] ?? 0;
                              
                              let stockText = '';
                              let stockClass = '';
                              let isDisable = false;

                              if (s.isUnlimited) {
                                stockText = '∞';
                                stockClass = 'text-[10px] font-bold text-purple-600';
                              } else if (availQtyNum === 0) {
                                stockText = '0';
                                stockClass = 'text-[10px] font-bold text-red-600';
                                isDisable = true;
                              } else if (availQtyNum < 5) {
                                stockText = String(availQtyNum);
                                stockClass = 'text-[10px] font-bold text-amber-500';
                              } else {
                                stockText = String(availQtyNum);
                                stockClass = 'text-[10px] font-medium text-gray-500';
                              }

                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  disabled={isDisable}
                                  onClick={() => {
                                    setSelectedSkuId(s.id);
                                    setSkuSearchQuery(`[${s.id}] ${s.name}`);
                                    setShowSkuDropdown(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 transition-colors flex flex-col gap-0.5 ${
                                    isDisable 
                                      ? 'opacity-50 cursor-not-allowed bg-gray-50/50' 
                                      : 'hover:bg-gray-50/80'
                                  }`}
                                >
                                  <span className="font-semibold text-xs text-gray-800">[{s.id}] {s.name}</span>
                                  <span className={stockClass}>Stock: {stockText}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="w-24">
                    <label className="block text-[10px] text-gray-400 uppercase mb-1">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      disabled={submittingInitiate || isWarehouseSectionInvalid}
                      value={selectedSkuQty === 0 ? '' : selectedSkuQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setSelectedSkuQty(0);
                        } else {
                          setSelectedSkuQty(Math.max(0, Number(val)));
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-400 ${
                        isQtyInvalid 
                          ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-200 focus:ring-red-500'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemToInitiate}
                    disabled={
                      submittingInitiate || 
                      isWarehouseSectionInvalid || 
                      isQtyInvalid || 
                      !selectedSkuId || 
                      selectedSkuQty <= 0
                    }
                    className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    Add
                  </button>
                </div>
                {isQtyInvalid && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                    <AlertCircle size={12} />
                    Entered qty exceeds available stock
                  </p>
                )}
              </div>

              {/* Items List Table */}
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                      <th className="p-2.5">SKU ID</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5 w-32 text-right">Available Stock</th>
                      <th className="p-2.5 w-24 text-right">Requested Qty</th>
                      <th className="p-2.5 w-16 text-center">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400 text-xs italic">
                          No SKUs added yet. Search a SKU above and click Add.
                        </td>
                      </tr>
                    ) : (
                      initItems.map(item => {
                        const skuInfo = skus.find(s => s.id === item.skuId);
                        const availQty = skuInfo?.isUnlimited ? '∞' : (sourceWarehouseStock[item.skuId] ?? 0);
                        const formattedAvail = skuInfo?.isUnlimited ? '∞' : `${availQty} ${skuInfo?.unit || 'PCS'}`;
                        return (
                          <tr key={item.skuId} className="border-b border-gray-50 hover:bg-gray-50/20">
                            <td className="p-2.5 font-mono text-[10px] text-gray-600">{item.skuId}</td>
                            <td className="p-2.5 font-medium">{skuInfo?.name || 'Unknown SKU'}</td>
                            <td className="p-2.5 text-right font-medium text-gray-500">{formattedAvail}</td>
                            <td className="p-2.5 text-right font-bold text-gray-800">{item.qty} {skuInfo?.unit || 'PCS'}</td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                disabled={submittingInitiate}
                                onClick={() => handleRemoveItemFromInitiate(item.skuId)}
                                className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Footer */}
              {initItems.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Summary:</span>
                  <span className="font-bold text-gray-800">
                    {initItems.length} SKU{initItems.length !== 1 ? 's' : ''} • {totalUnits} Unit{totalUnits !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-gray-100 pt-4 flex justify-end gap-2 bg-white sticky bottom-0">
                <button
                  type="button"
                  disabled={submittingInitiate}
                  onClick={() => setShowInitiateModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInitiate || initItems.length === 0 || isWarehouseSectionInvalid || hasInvalidItems}
                  className="px-6 py-2 bg-[#AE1B1E] hover:bg-red-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:bg-red-800/50"
                >
                  {submittingInitiate ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Creating Transfer...
                    </>
                  ) : (
                    'Create Transfer Order'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW DETAILS ─────────────────────────────────────────── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-[#1A2766] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={18} />
                <h3 className="font-bold text-sm">
                  Transfer Details: {detailedTransfer?.transferNumber || 'Loading...'}
                </h3>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="hover:bg-white/10 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-20 flex flex-col items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin text-red-600" size={24} />
                <p className="text-xs">Loading transfer details...</p>
              </div>
            ) : !detailedTransfer ? (
              <div className="p-10 text-center text-gray-500">Error loading data.</div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Status</span>
                    <span className="mt-1 block">{getStatusBadge(detailedTransfer.status)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Source Warehouse</span>
                    <span className="font-medium text-gray-800 mt-1 block">{detailedTransfer.sourceWarehouse.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Destination Warehouse</span>
                    <span className="font-medium text-gray-800 mt-1 block">{detailedTransfer.destinationWarehouse.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Responsible Person</span>
                    <span className="font-medium text-gray-800 mt-1 block">{detailedTransfer.responsiblePerson}</span>
                  </div>
                </div>

                {detailedTransfer.parentTransfer?.transferNumber && (
                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex items-center justify-between">
                    <span className="text-[10px] text-blue-600 font-bold uppercase">Parent Transfer</span>
                    <span className="font-mono font-bold text-blue-800">{detailedTransfer.parentTransfer.transferNumber}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Created By</span>
                    <span className="font-medium text-gray-700 mt-0.5 block">{detailedTransfer.createdBy.name}</span>
                    <span className="text-[10px] text-gray-400 block">
                      {new Date(detailedTransfer.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {detailedTransfer.dispatchedAt && (
                    <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Last Dispatched By</span>
                      <span className="font-medium text-gray-700 mt-0.5 block">{detailedTransfer.dispatchedBy?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-gray-400 block">
                        {new Date(detailedTransfer.dispatchedAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                {detailedTransfer.remarks && (
                  <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Remarks</span>
                    <p className="text-gray-700 mt-1">{detailedTransfer.remarks}</p>
                  </div>
                )}

                {/* Items list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-800">Transfer Items</h4>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                          <th className="p-2.5">SKU ID</th>
                          <th className="p-2.5">Product Name</th>
                          <th className="p-2.5 text-right">Requested</th>
                          <th className="p-2.5 text-right">Dispatched</th>
                          <th className="p-2.5 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedTransfer.items.map((item: any) => (
                          <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/20">
                            <td className="p-2.5 font-mono text-[10px] text-gray-500">{item.skuId}</td>
                            <td className="p-2.5 font-medium">{item.sku.name} {item.sku.isUnlimited ? ' (∞)' : ''}</td>
                            <td className="p-2.5 text-right font-medium">{item.requestedQty} {item.sku.unit || 'PCS'}</td>
                            <td className="p-2.5 text-right font-medium text-emerald-600">{item.dispatchedQty} {item.sku.unit || 'PCS'}</td>
                            <td className="p-2.5 text-right font-bold text-red-600">{item.balanceQty} {item.sku.unit || 'PCS'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-5 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: DISPATCH TRANSFER ────────────────────────────────────── */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-[#AE1B1E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight size={18} />
                <h3 className="font-bold text-sm">
                  Dispatch Inventory: {detailedTransfer?.transferNumber || 'Loading...'}
                </h3>
              </div>
              <button 
                onClick={() => setShowDispatchModal(false)}
                className="hover:bg-white/10 p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-20 flex flex-col items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin text-red-600" size={24} />
                <p className="text-xs">Loading transfer details...</p>
              </div>
            ) : !detailedTransfer ? (
              <div className="p-10 text-center text-gray-500">Error loading data.</div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* Meta Summary */}
                <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Source Warehouse</span>
                    <span className="font-medium text-gray-800">{detailedTransfer.sourceWarehouse.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Destination Warehouse</span>
                    <span className="font-medium text-gray-800">{detailedTransfer.destinationWarehouse.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Responsible Person</span>
                    <span className="font-medium text-gray-800">{detailedTransfer.responsiblePerson}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-800">Specify Dispatch Quantities</h4>
                  <p className="text-[10px] text-gray-400 italic">Enter the physical quantity of each item leaving the source warehouse. Leaving field at 0 skips the SKU.</p>
                  
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                          <th className="p-2.5">SKU ID</th>
                          <th className="p-2.5">Product Name</th>
                          <th className="p-2.5 text-right w-24">Requested</th>
                          <th className="p-2.5 text-right w-24">Prev Dispatched</th>
                          <th className="p-2.5 text-right w-24">Remaining Bal</th>
                          <th className="p-2.5 text-right w-36">Dispatch Now</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedTransfer.items.map((item: any) => (
                          <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/20">
                            <td className="p-2.5 font-mono text-[10px] text-gray-500">{item.skuId}</td>
                            <td className="p-2.5 font-medium">
                              {item.sku.name} {item.sku.isUnlimited ? ' (∞)' : ''}
                            </td>
                            <td className="p-2.5 text-right text-gray-500">{item.requestedQty} {item.sku.unit || 'PCS'}</td>
                            <td className="p-2.5 text-right text-emerald-600">{item.dispatchedQty} {item.sku.unit || 'PCS'}</td>
                            <td className="p-2.5 text-right text-red-600 font-bold">{item.balanceQty} {item.sku.unit || 'PCS'}</td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                max={item.balanceQty}
                                disabled={submittingDispatch}
                                value={dispatchQuantities[item.skuId] ?? 0}
                                onChange={(e) => {
                                  const val = Math.min(item.balanceQty, Math.max(0, Number(e.target.value)));
                                  setDispatchQuantities(prev => ({
                                    ...prev,
                                    [item.skuId]: val
                                  }));
                                }}
                                className="w-24 px-2 py-1 border border-gray-200 rounded text-right font-bold focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 bg-white sticky bottom-0">
                  <button
                    onClick={() => setShowDispatchModal(false)}
                    disabled={submittingDispatch}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDispatch}
                    disabled={submittingDispatch}
                    className="px-6 py-2 bg-[#AE1B1E] hover:bg-red-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submittingDispatch ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Dispatching...
                      </>
                    ) : (
                      'Confirm & Print Slip'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

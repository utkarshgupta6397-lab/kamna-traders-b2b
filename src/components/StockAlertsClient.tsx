'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Loader2, Check, X, BellDot, Edit2, Trash2, Plus, AlertTriangle, Box } from 'lucide-react';
import toast from 'react-hot-toast';

interface Warehouse {
  id: string;
  name: string;
}

interface Sku {
  id: string;
  name: string;
  unit: string | null;
}

interface StockAlertThreshold {
  id: string;
  warehouseId: string;
  skuId: string;
  minimumQty: number;
  isEnabled: boolean;
  currentStock: number;
  warehouse: { name: string };
  sku: { name: string; unit: string | null };
}

export default function StockAlertsClient() {
  const [alerts, setAlerts] = useState<StockAlertThreshold[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formSkuId, setFormSkuId] = useState('');
  const [formMinimumQty, setFormMinimumQty] = useState<number | ''>('');
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // SKU Autocomplete Search in Modal
  const [skuSearch, setSkuSearch] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);
  const skuSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlerts();
    fetchMetadata();
  }, []);

  // Handle clicking outside SKU dropdown in modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (skuSearchRef.current && !skuSearchRef.current.contains(event.target as Node)) {
        setShowSkuDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/stock-alerts');
      if (!res.ok) throw new Error('Failed to fetch stock alerts');
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load stock alerts');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    setMetadataLoading(true);
    try {
      // Fetch warehouses
      const metaRes = await fetch('/api/staff/zone-mapping/metadata');
      const metaData = await metaRes.json();
      const whList = (metaData.warehouses || []).filter((w: any) => !w.isSystemWarehouse);
      setWarehouses(whList);
      if (whList.length > 0) {
        setFormWarehouseId(whList[0].id);
      }

      // Fetch SKUs
      const skusRes = await fetch('/api/staff/skus');
      const skusData = await skusRes.json();
      setSkus(skusData.skus || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load metadata');
    } finally {
      setMetadataLoading(false);
    }
  };

  const handleToggleEnable = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/staff/stock-alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isEnabled: !currentStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success(`Threshold ${!currentStatus ? 'enabled' : 'disabled'}`);
      fetchAlerts();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this stock alert threshold?')) return;
    try {
      const res = await fetch(`/api/staff/stock-alerts?id=${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete threshold');
      toast.success('Threshold deleted successfully');
      fetchAlerts();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleOpenAddModal = () => {
    setEditingAlertId(null);
    setFormSkuId('');
    setSkuSearch('');
    setFormMinimumQty('');
    setFormIsEnabled(true);
    if (warehouses.length > 0) {
      setFormWarehouseId(warehouses[0].id);
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (alert: StockAlertThreshold) => {
    setEditingAlertId(alert.id);
    setFormWarehouseId(alert.warehouseId);
    setFormSkuId(alert.skuId);
    setSkuSearch(`[${alert.skuId}] ${alert.sku.name}`);
    setFormMinimumQty(alert.minimumQty);
    setFormIsEnabled(alert.isEnabled);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWarehouseId || !formSkuId || formMinimumQty === '') {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editingAlertId || undefined,
        warehouseId: formWarehouseId,
        skuId: formSkuId,
        minimumQty: Number(formMinimumQty),
        isEnabled: formIsEnabled
      };

      const res = await fetch('/api/staff/stock-alerts', {
        method: editingAlertId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save threshold');

      toast.success(editingAlertId ? 'Threshold updated' : 'Threshold added');
      setIsModalOpen(false);
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save threshold');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered alerts for search and warehouse filter
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const matchesSearch = 
        a.skuId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.sku.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWarehouse = 
        selectedWarehouseFilter === 'ALL' || a.warehouseId === selectedWarehouseFilter;
      return matchesSearch && matchesWarehouse;
    });
  }, [alerts, searchQuery, selectedWarehouseFilter]);

  // Autocomplete suggestions in form
  const filteredSkuSuggestions = useMemo(() => {
    if (!skuSearch) return skus.slice(0, 50);
    const query = skuSearch.toLowerCase();
    return skus.filter(s => 
      s.id.toLowerCase().includes(query) || 
      s.name.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [skus, skuSearch]);

  const selectedSku = useMemo(() => {
    return skus.find(s => s.id === formSkuId);
  }, [skus, formSkuId]);

  return (
    <div className="space-y-3 p-2 relative pb-16">
      {/* 1. KPI Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Thresholds</span>
          <div className="text-lg font-black text-[#1A2766] mt-0.5">{alerts.length}</div>
        </div>
        <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Thresholds</span>
          <div className="text-lg font-black text-emerald-600 mt-0.5">{alerts.filter(a => a.isEnabled).length}</div>
        </div>
        <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Currently Alerting</span>
          <div className="text-lg font-black text-red-600 mt-0.5">
            {alerts.filter(a => a.isEnabled && a.currentStock < a.minimumQty).length}
          </div>
        </div>
      </div>

      {/* 2. Filter & Add Bar */}
      <div className="flex flex-row gap-2 items-center justify-between bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex-wrap md:flex-nowrap">
        <div className="flex flex-row gap-2 items-center flex-1 w-full">
          <select 
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs bg-gray-50 focus:ring-2 focus:ring-[#1A2766] outline-none w-full md:w-auto"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <div className="relative flex-1 w-full">
            <Search className="absolute left-2 top-2 text-gray-400" size={13} />
            <input 
              type="text" 
              placeholder="Search SKU or Product Name..." 
              className="pl-7 pr-2 py-1 h-7 border rounded-md text-xs w-full bg-gray-50 focus:ring-2 focus:ring-[#1A2766] outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#1A2766] hover:bg-[#AE1B1E] text-white rounded-md text-xs font-bold transition-all shadow-sm shrink-0"
        >
          <Plus size={13} /> Add Threshold
        </button>
      </div>

      {/* 3. Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10 text-[10px] text-gray-500 uppercase tracking-wider border-b">
              <tr>
                <th className="px-4 py-2 font-bold">Product</th>
                <th className="px-4 py-2 font-bold">Warehouse</th>
                <th className="px-4 py-2 font-bold text-center">Current Stock</th>
                <th className="px-4 py-2 font-bold text-center">Min Threshold</th>
                <th className="px-4 py-2 font-bold text-center">Enabled</th>
                <th className="px-4 py-2 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading || metadataLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-400">
                    <Loader2 className="animate-spin inline mr-2" size={14} /> Loading...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-400">No stock alert thresholds found.</td>
                </tr>
              ) : (
                filteredAlerts.map(alert => {
                  const isLow = alert.isEnabled && alert.currentStock < alert.minimumQty;
                  return (
                    <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 leading-tight">{alert.sku.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono mt-0.5 select-all">[{alert.skuId}]</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle text-gray-700 font-medium">
                        {alert.warehouse.name}
                      </td>
                      <td className="px-4 py-2 align-middle text-center font-mono">
                        <div className="flex items-center justify-center gap-1 font-bold">
                          {isLow && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded text-[10px] font-bold">
                              <AlertTriangle size={10} className="shrink-0" />
                              Low
                            </span>
                          )}
                          <span className={isLow ? 'text-amber-700' : 'text-gray-900'}>
                            {alert.currentStock}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium lowercase">
                            {alert.sku.unit || 'units'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle text-center font-bold font-mono text-gray-900">
                        {alert.minimumQty}
                      </td>
                      <td className="px-4 py-2 align-middle text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={alert.isEnabled}
                            onChange={() => handleToggleEnable(alert.id, alert.isEnabled)}
                          />
                          <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </td>
                      <td className="px-4 py-2 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEditModal(alert)}
                            className="p-1 text-gray-400 hover:text-[#1A2766] transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDelete(alert.id)}
                            className="p-1 text-gray-400 hover:text-red-650 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setIsModalOpen(false)} />
          
          <div className="relative bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-gray-150 animate-in zoom-in-95 duration-150">
            <div className="bg-[#1A2766] p-3 flex items-center justify-between text-white">
              <h2 className="font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <BellDot size={14} />
                {editingAlertId ? 'Edit Stock Alert' : 'Add Stock Alert'}
              </h2>
              {!submitting && (
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-0.5 rounded transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              {/* Product Autocomplete Selector */}
              <div className="relative" ref={skuSearchRef}>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Product / SKU <span className="text-red-500">*</span>
                </label>
                {editingAlertId ? (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 font-semibold select-none">
                    <Box size={13} className="text-gray-400" />
                    <span>[{formSkuId}] {selectedSku?.name}</span>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2 top-2 text-gray-400" size={13} />
                      <input 
                        type="text" 
                        placeholder="Search SKU ID or Name..." 
                        value={skuSearch}
                        onChange={(e) => {
                          setSkuSearch(e.target.value);
                          setShowSkuDropdown(true);
                        }}
                        onFocus={() => setShowSkuDropdown(true)}
                        className="w-full pl-7 pr-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-[#1A2766] focus:outline-none"
                      />
                    </div>
                    {showSkuDropdown && filteredSkuSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredSkuSuggestions.map(sku => (
                          <button
                            key={sku.id}
                            type="button"
                            onClick={() => {
                              setFormSkuId(sku.id);
                              setSkuSearch(`[${sku.id}] ${sku.name}`);
                              setShowSkuDropdown(false);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-0"
                          >
                            <span className="text-xs font-semibold text-gray-900 truncate">{sku.name}</span>
                            <span className="text-[9px] text-gray-400 font-mono mt-0.2">[{sku.id}]</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Warehouse Selector */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                {editingAlertId ? (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 font-semibold select-none">
                    <span>{warehouses.find(w => w.id === formWarehouseId)?.name}</span>
                  </div>
                ) : (
                  <select 
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-[#1A2766] focus:outline-none bg-white cursor-pointer"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Minimum Quantity Input */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Minimum quantity <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input 
                    type="number" 
                    min={0}
                    placeholder="e.g. 10" 
                    value={formMinimumQty}
                    onChange={(e) => setFormMinimumQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-[#1A2766] focus:outline-none"
                    required
                  />
                  {selectedSku?.unit && (
                    <span className="absolute right-3 text-[10px] text-gray-400 font-medium lowercase">
                      {selectedSku.unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={formIsEnabled}
                    onChange={(e) => setFormIsEnabled(e.target.checked)}
                  />
                  <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formSkuId || formMinimumQty === ''}
                  className="flex-1 bg-[#1A2766] hover:bg-[#AE1B1E] text-white py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-400"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  {editingAlertId ? 'Save Changes' : 'Create Threshold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

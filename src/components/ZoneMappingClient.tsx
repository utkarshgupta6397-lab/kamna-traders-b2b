'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Upload, Edit2, Check, X, Loader2, AlertTriangle, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface SkuMapping {
  skuId: string;
  name: string;
  categoryId: string | null;
  zone: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day}-${month}-${year} ${time}`;
};

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

export default function ZoneMappingClient() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [mappings, setMappings] = useState<SkuMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Editing single row
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [newZone, setNewZone] = useState('');

  // Bulk Edit
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [bulkZoneInput, setBulkZoneInput] = useState('');
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (selectedWarehouse) {
      fetchMappings();
    }
  }, [selectedWarehouse]);

  const fetchMetadata = async () => {
    try {
      const res = await fetch('/api/staff/zone-mapping/metadata');
      const data = await res.json();
      setWarehouses(data.warehouses || []);
      setCategories(data.categories || []);
      if (data.warehouses?.length > 0) {
        setSelectedWarehouse(data.warehouses[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
      setLoading(false);
    }
  };

  const fetchMappings = async () => {
    setLoading(true);
    setSelectedSkuIds(new Set());
    try {
      const res = await fetch(`/api/staff/zone-mapping?warehouseId=${selectedWarehouse}`);
      if (!res.ok) throw new Error(`Failed to fetch mappings: ${res.status}`);
      const data = await res.json();
      setMappings(data);
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      const matchesSearch = 
        m.skuId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.zone && m.zone.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'ALL' || m.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [mappings, searchQuery, selectedCategory]);

  // Pagination logic
  const totalItems = filteredMappings.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedMappings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMappings.slice(start, start + pageSize);
  }, [filteredMappings, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedSkuIds(new Set());
  }, [searchQuery, selectedCategory, pageSize]);

  // KPI
  const mappedSkus = filteredMappings.filter(m => m.zone).length;
  const unassignedSkus = totalItems - mappedSkus;

  // Single Save
  const handleEdit = (skuId: string, currentZone: string | null) => {
    setEditingSku(skuId);
    setNewZone(currentZone || '');
  };

  const handleSave = async (skuId: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/staff/zone-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          skuId,
          zoneName: newZone.trim() || null
        })
      });
      if (res.ok) {
        fetchMappings();
        setEditingSku(null);
      }
    } catch (err) {
      console.error('Failed to save mapping:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Save
  const handleBulkAction = async (zoneName: string | null) => {
    if (selectedSkuIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const updates = Array.from(selectedSkuIds).map(skuId => ({
        skuId,
        zoneName: zoneName ? zoneName.trim() : null
      }));
      
      const res = await fetch('/api/staff/zone-mapping/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          updates
        })
      });
      if (res.ok) {
        fetchMappings();
        setShowBulkAssign(false);
        setBulkZoneInput('');
        setSelectedSkuIds(new Set());
      } else {
        const text = await res.text();
        console.error('Bulk update failed:', text);
        alert(`Failed to update: ${res.status}`);
      }
    } catch (err) {
      console.error('Bulk update failed:', err);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Select logic
  const toggleSelectAll = () => {
    if (selectedSkuIds.size === paginatedMappings.length && paginatedMappings.length > 0) {
      setSelectedSkuIds(new Set());
    } else {
      setSelectedSkuIds(new Set(paginatedMappings.map(m => m.skuId)));
    }
  };

  const toggleSelect = (skuId: string) => {
    const newSet = new Set(selectedSkuIds);
    if (newSet.has(skuId)) newSet.delete(skuId);
    else newSet.add(skuId);
    setSelectedSkuIds(newSet);
  };

  // CSV Template
  const handleDownloadTemplate = () => {
    const headers = ['SKU_ID', 'PRODUCT_NAME', 'CURRENT_ZONE'];
    const rows = filteredMappings.map(m => [m.skuId, `"${m.name.replace(/"/g, '""')}"`, m.zone || '']);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `zone_mapping_${selectedWarehouse}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Parser
  const parseCsvTsv = (text: string) => {
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const lines = cleanText.split(/\r?\n/);
    const isTsv = lines[0].includes('\t');
    
    return lines.map(line => {
      if (isTsv) return line.split('\t').map(c => c.trim());
      // basic CSV split handling quotes
      const row = [];
      let inQuotes = false;
      let curr = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(curr.trim());
          curr = '';
        } else {
          curr += char;
        }
      }
      row.push(curr.trim());
      return row;
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = parseCsvTsv(text);
      if (rows.length < 1) {
        alert('Empty file.');
        setUploading(false);
        return;
      }

      const headers = rows[0].map(h => h.toLowerCase());
      const skuIdx = headers.findIndex(h => h === 'sku_id' || h === 'sku id');
      const zoneIdx = headers.findIndex(h => h === 'current_zone' || h === 'current zone' || h === 'zone');

      if (skuIdx === -1 || zoneIdx === -1) {
        alert('Invalid format. Must contain SKU_ID and CURRENT_ZONE.');
        setUploading(false);
        return;
      }

      const updates = rows.slice(1).map(row => ({
        skuId: row[skuIdx]?.replace(/^"|"$/g, '').trim(),
        zoneName: row[zoneIdx]?.replace(/^"|"$/g, '').trim() || null
      })).filter(u => u.skuId);

      try {
        const res = await fetch('/api/staff/zone-mapping/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseId: selectedWarehouse,
            updates
          })
        });
        
        if (!res.ok) {
          const text = await res.text();
          console.error('Bulk API Error:', text);
          alert(`Failed to upload: ${res.status}`);
          setUploading(false);
          return;
        }
        
        const result = await res.json();
        setUploadResult(result);
        fetchMappings();
      } catch (err) {
        console.error('Failed to upload mappings:', err);
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (!warehouses.length && loading) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading...</div>;
  }

  return (
    <div className="space-y-2 p-2 relative pb-16">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Filtered SKUs</span>
          <div className="text-lg font-black text-[#1A2766]">{totalItems}</div>
        </div>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Mapped in Filter</span>
          <div className="text-lg font-black text-emerald-600">{mappedSkus}</div>
        </div>
        <div className={`bg-white p-2 rounded-lg shadow-sm border ${unassignedSkus > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-100'}`}>
          <span className="text-[10px] font-bold text-gray-400 uppercase">Unassigned in Filter</span>
          <div className={`text-lg font-black ${unassignedSkus > 0 ? 'text-orange-600' : 'text-gray-600'}`}>{unassignedSkus}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-row gap-2 items-center justify-between bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex-wrap md:flex-nowrap">
        <div className="flex flex-row gap-2 items-center flex-1 w-full">
          <select 
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs bg-gray-50 focus:ring-2 focus:ring-[#1A2766] outline-none w-full md:w-auto"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs bg-gray-50 focus:ring-2 focus:ring-[#1A2766] outline-none w-full md:w-auto"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="relative flex-1 w-full">
            <Search className="absolute left-2 top-1.5 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search SKU or Product Name..." 
              className="pl-7 pr-2 py-1 border rounded-md text-xs w-full bg-gray-50 focus:ring-2 focus:ring-[#1A2766] outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-1 w-full md:w-auto justify-end">
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-bold hover:bg-gray-200 transition-all"
          >
            <Download size={12} /> Export
          </button>
          
          <label className="flex items-center gap-1 px-2 py-1 bg-[#1A2766] text-white rounded-md text-xs font-bold hover:bg-opacity-90 cursor-pointer transition-all">
            <Upload size={12} /> {uploading ? '...' : 'Import CSV'}
            <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {uploadResult && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center justify-between">
          <div className="text-sm text-emerald-800">
            <strong>Upload Result:</strong> {uploadResult.updated} updated, {uploadResult.created} created, {uploadResult.removed} removed.
          </div>
          <button onClick={() => setUploadResult(null)} className="text-emerald-600 hover:text-emerald-800">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase bg-gray-50 text-gray-500 border-b sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1 w-8">
                  <input 
                    type="checkbox" 
                    checked={paginatedMappings.length > 0 && selectedSkuIds.size === paginatedMappings.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                  />
                </th>
                <th className="px-2 py-1 font-bold">SKU ID</th>
                <th className="px-2 py-1 font-bold">Product Name</th>
                <th className="px-2 py-1 font-bold">Current Zone</th>
                <th className="px-2 py-1 font-bold">Last Updated</th>
                <th className="px-2 py-1 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-400">
                    <Loader2 className="animate-spin inline mr-2" size={14} /> Loading...
                  </td>
                </tr>
              ) : paginatedMappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-400">No SKUs found matching filters.</td>
                </tr>
              ) : paginatedMappings.map((m) => (
                <tr key={m.skuId} className={`hover:bg-gray-50 transition-colors ${selectedSkuIds.has(m.skuId) ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-1">
                    <input 
                      type="checkbox" 
                      checked={selectedSkuIds.has(m.skuId)}
                      onChange={() => toggleSelect(m.skuId)}
                      className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                    />
                  </td>
                  <td className="px-2 py-1 font-bold text-gray-900">{m.skuId}</td>
                  <td className="px-2 py-1 text-gray-600 max-w-xs truncate" title={m.name}>{m.name}</td>
                  <td className="px-2 py-1">
                    {editingSku === m.skuId ? (
                      <input 
                        type="text" 
                        value={newZone}
                        onChange={(e) => setNewZone(e.target.value)}
                        className="border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-[#1A2766] outline-none w-full max-w-[100px]"
                        placeholder="Zone..."
                        autoFocus
                      />
                    ) : m.zone ? (
                      <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-[#1A2766]">
                        {m.zone}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic text-[10px]">Unassigned</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {m.updatedAt ? (
                      <div className="flex flex-col text-[11px] leading-tight text-gray-600">
                        <span>{formatDate(m.updatedAt)}</span>
                        {m.updatedBy && (
                          <span 
                            className="text-gray-400 text-[10px] max-w-[100px] truncate" 
                            title={m.updatedBy}
                          >
                            {m.updatedBy}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {editingSku === m.skuId ? (
                      <div className="flex gap-1 justify-end">
                        <button 
                          onClick={() => handleSave(m.skuId)} 
                          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                        </button>
                        <button 
                          onClick={() => setEditingSku(null)} 
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          disabled={isSaving}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleEdit(m.skuId, m.zone)} className="text-gray-400 hover:text-[#1A2766]">
                        <Edit2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="px-2 py-1 border-t bg-gray-50 flex flex-row items-center justify-between gap-2 text-xs">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>
              Showing {totalItems === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, totalItems)}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-gray-400">Rows:</span>
              <select 
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border rounded text-xs px-0.5 py-0 bg-white focus:ring-1 focus:ring-[#1A2766] outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-white border shadow-sm text-gray-600 disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium min-w-[50px] text-center">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1 rounded bg-white border shadow-sm text-gray-600 disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedSkuIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A2766] text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-6 animate-in slide-in-from-bottom-8">
          <div className="flex items-center gap-2 font-medium">
            <div className="bg-white/20 px-2 py-0.5 rounded text-sm">{selectedSkuIds.size}</div>
            <span className="text-sm">SKUs selected</span>
          </div>
          
          <div className="h-6 w-px bg-white/20"></div>

          {showBulkAssign ? (
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Zone name..." 
                value={bulkZoneInput}
                onChange={(e) => setBulkZoneInput(e.target.value)}
                className="px-3 py-1 text-sm rounded bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 w-32"
                autoFocus
              />
              <button 
                onClick={() => handleBulkAction(bulkZoneInput)}
                className="bg-white text-[#1A2766] px-3 py-1 rounded text-sm font-bold hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? <Loader2 className="animate-spin" size={12} /> : null}
                {isBulkUpdating ? 'Applying...' : 'Apply'}
              </button>
              <button 
                onClick={() => setShowBulkAssign(false)}
                className="p-1 text-white/70 hover:text-white disabled:opacity-50"
                disabled={isBulkUpdating}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => { setBulkZoneInput(''); setShowBulkAssign(true); }}
                className="bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Assign Zone
              </button>
              <button 
                onClick={() => handleBulkAction(null)}
                className="bg-red-500/20 hover:bg-red-500/40 text-red-100 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? <Loader2 className="animate-spin" size={14} /> : null}
                {isBulkUpdating ? 'Clearing...' : 'Clear Zones'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

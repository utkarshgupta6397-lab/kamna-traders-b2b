'use client';

import { useState, useEffect } from 'react';
import { Trash2, Save, ArrowUpDown, Loader2, Search, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubVendor {
  id: string;
  name: string;
  active: boolean;
  _count?: {
    solarOrders: number;
  };
}

export default function SubVendorSettingsPage() {
  const [vendors, setVendors] = useState<SubVendor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Sort State
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Add New Sub-Vendor Form State
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  // Row Edit States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, { name: string; active: boolean }>>({});

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/admin/sub-vendors');
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (err) {
      toast.error('Failed to load Sub-Vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleAddSubVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);

    try {
      const res = await fetch('/api/admin/sub-vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), active: true }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Sub-Vendor added successfully!');
        setNewName('');
        fetchVendors();
      } else {
        toast.error(data.message || 'Failed to add Sub-Vendor');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setAdding(false);
    }
  };

  const startEditing = (vendor: SubVendor) => {
    setEditStates({
      ...editStates,
      [vendor.id]: { name: vendor.name, active: vendor.active }
    });
    setEditingId(vendor.id);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdateSubVendor = async (id: string) => {
    const editState = editStates[id];
    if (!editState || !editState.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      const res = await fetch(`/api/admin/sub-vendors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editState.name.trim(), active: editState.active }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Sub-Vendor updated successfully');
        setEditingId(null);
        fetchVendors();
      } else {
        toast.error(data.message || 'Failed to update Sub-Vendor');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleDelete = async (id: string, count: number = 0) => {
    if (count > 0) {
      toast.error('This Sub-Vendor is already being used by existing Solar Orders and cannot be deleted. Please mark it Inactive instead.', { duration: 5000 });
      return;
    }
    
    if (!confirm('Are you sure you want to permanently delete this Sub-Vendor?')) return;

    try {
      const res = await fetch(`/api/admin/sub-vendors/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Sub-Vendor deleted');
        fetchVendors();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleRowChange = (id: string, field: 'name' | 'active', value: any) => {
    setEditStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  // Filter & Sort
  const searchLower = search.trim().toLowerCase();
  const filtered = vendors.filter(v => v.name.toLowerCase().includes(searchLower));
  
  const sorted = [...filtered].sort((a, b) => {
    if (a.active !== b.active) {
      return a.active ? -1 : 1; // Active first
    }
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });

  // Paginated
  const total = sorted.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sub-Vendors ({total})</h1>
      </div>

      {/* Add New Sub-Vendor Form */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Add New Sub-Vendor</h2>
        <form onSubmit={handleAddSubVendor} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Sub-Vendor Name</label>
            <input 
              type="text" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required 
              placeholder="e.g. Eco Solar Installations"
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" 
            />
          </div>
          <button 
            type="submit" 
            disabled={adding || !newName.trim()}
            className="bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding...' : 'Add Sub-Vendor'}
          </button>
        </form>
      </div>

      {/* Search & Sort Panel */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search sub-vendors..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] outline-none bg-white"
          />
        </div>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg transition-colors"
        >
          <ArrowUpDown size={14} />
          Sort: {sortAsc ? 'A to Z' : 'Z to A'}
        </button>
      </div>

      {/* Table List matching Brands/Warehouses exactly */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="flex bg-gray-50 border-b text-gray-500 uppercase tracking-wider text-xs font-medium">
            <div className="w-96 p-3">Name</div>
            <div className="w-48 p-3">Status</div>
            <div className="w-32 p-3 text-center">Solar Orders</div>
            <div className="flex-1 p-3 text-right">Actions</div>
          </div>
          
          {/* Body */}
          <div className="divide-y divide-gray-50 text-gray-700">
            {loading ? (
              <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading Sub-Vendors...
              </div>
            ) : paginated.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No sub-vendors found.</div>
            ) : (
              paginated.map(v => {
                const isEditing = editingId === v.id;
                const currentEdit = editStates[v.id] || { name: v.name, active: v.active };
                const orderCount = v._count?.solarOrders || 0;

                return (
                  <div key={v.id} className="flex items-center hover:bg-gray-50/50 transition-colors">
                    <div className="w-96 p-3 text-sm font-medium">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={currentEdit.name} 
                          onChange={e => handleRowChange(v.id, 'name', e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] outline-none" 
                        />
                      ) : (
                        <span>{v.name}</span>
                      )}
                    </div>
                    <div className="w-48 p-3">
                      {isEditing ? (
                        <select 
                          value={String(currentEdit.active)} 
                          onChange={e => handleRowChange(v.id, 'active', e.target.value === 'true')}
                          className="w-full border rounded px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${v.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {v.active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <div className="w-32 p-3 text-xs text-gray-500 text-center font-semibold">
                      {orderCount} {orderCount === 1 ? 'Order' : 'Orders'}
                    </div>
                    <div className="flex-1 p-3 flex justify-end items-center gap-2 pr-4">
                      {isEditing ? (
                        <>
                          <button 
                            onClick={() => handleUpdateSubVendor(v.id)}
                            title="Save Changes"
                            className="p-1.5 rounded transition-colors text-green-600 hover:bg-green-50"
                          >
                            <Save size={16} />
                          </button>
                          <button 
                            onClick={cancelEditing}
                            title="Cancel"
                            className="p-1.5 rounded transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => startEditing(v)}
                            title="Edit"
                            className="p-1.5 rounded transition-colors text-blue-600 hover:bg-blue-50"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(v.id, orderCount)}
                            disabled={orderCount > 0}
                            title={orderCount > 0 ? "Cannot delete: used in historical orders" : "Delete Vendor"}
                            className={`p-1.5 rounded transition-colors ${
                              orderCount > 0 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination Panel */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-3 border-t">
            {Array.from({ length: totalPages }, (_, i) => (
              <button 
                key={i} 
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${page === i + 1 ? 'bg-[#1A2766] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

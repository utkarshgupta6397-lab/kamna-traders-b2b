'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PackageOpen, Plus, Trash2, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, X, FileCheck, Package, Clock, Activity, Loader2, Edit2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface LineItem {
  id: string;
  skuId: string;
  rawText: string;
}

export default function PurchaseReceiveDashboard() {
  const [data, setData] = useState<{ kpis: any, rows: any[], total: number }>({ kpis: {}, rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const setLimit = (newLimit: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', newLimit.toString());
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  // Edit states
  const [editVendor, setEditVendor] = useState('');
  const [editBill, setEditBill] = useState('');
  const [editDate, setEditDate] = useState('');

  // Form states
  const [vendorName, setVendorName] = useState('');
  const [dateReceived, setDateReceived] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [billNumber, setBillNumber] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ id: Date.now().toString(36) + Math.random().toString(36).substring(2), skuId: '', rawText: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skus, setSkus] = useState<any[]>([]);
  const [skuSearch, setSkuSearch] = useState<Record<string, string>>({});
  const [skuDropdownOpen, setSkuDropdownOpen] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/dcr/purchase-receive?page=${page}&limit=${limit}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to fetch data');
      setData(d);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchData();
    fetch('/api/staff/skus')
      .then(r => r.json())
      .then(d => setSkus((d.skus || d || []).filter((s: any) => s.caseSize > 1 && s.isActive !== false)))
      .catch(() => setSkus([]));
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addLine = () => setLines(prev => [...prev, { id: Date.now().toString(36) + Math.random().toString(36).substring(2), skuId: '', rawText: '' }]);
  const removeLine = (id: string) => lines.length > 1 && setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = (id: string, field: keyof LineItem, value: string) => setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  const filteredSkus = (lineId: string) => skus.filter(s => s.name.toLowerCase().includes((skuSearch[lineId] || '').toLowerCase())).slice(0, 20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !dateReceived) return toast.error('Vendor name and date are required');
    for (const line of lines) {
      if (!line.skuId) return toast.error('Please select a SKU for each row');
      if (!line.rawText.trim()) return toast.error('Please enter serials for each row');
    }

    const payload = {
      vendorName, dateReceived, billNumber,
      lines: lines.map(l => ({
        skuId: l.skuId,
        serials: l.rawText.split(/[\s,\n]+/).filter(s => s.trim().length > 0)
      }))
    };

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/dcr/purchase-receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || resData.details?.join(', ') || 'Failed');
      
      toast.success(resData.warnings?.length ? `Saved ${resData.totalSerials} serials with warnings.` : `Successfully recorded receipt of ${resData.totalSerials} panels.`);
      
      setLines([{ id: Date.now().toString(36) + Math.random().toString(36).substring(2), skuId: '', rawText: '' }]);
      setBillNumber('');
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (row: any) => {
    setEditingRow(row);
    setEditVendor(row.vendorName === 'Unknown Vendor' ? '' : row.vendorName);
    setEditBill(row.billNumber === 'No Bill' ? '' : row.billNumber);
    setEditDate(row.date);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        vendorName: editVendor,
        billNumber: editBill,
        dateReceived: editDate,
        serialNumbers: editingRow.serials.map((s: any) => s.serialNumber)
      };

      const res = await fetch('/api/admin/dcr/purchase-receive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update records');
      
      toast.success(`Successfully updated ${data.updated} records`);
      setEditingRow(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6 relative">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Receive Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Track purchase receipts and DCR certificate completion for purchased panels.</p>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 bg-[#1A2766] hover:bg-[#1A2766]/90 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
          >
            <Plus size={16} /> New Purchase Receive
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Purchased</p>
              <Package className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{data.kpis.totalPurchased || 0}</h3>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">DCR Received</p>
              <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-emerald-600 mt-1">{data.kpis.dcrReceived || 0}</h3>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Receipts Pending DCR</p>
              <Clock className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <h3 className="text-xl font-bold text-orange-600 mt-1">{data.kpis.dcrPending || 0}</h3>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completion %</p>
              <Activity className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-blue-600 mt-1">{data.kpis.completionPercent || 0}%</h3>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
             <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#1A2766]" /></div>
          ) : data.rows.length === 0 ? (
            <div className="py-16 text-center text-gray-500">No purchase records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-medium text-xs">
                  <tr>
                    <th className="px-3 py-2 w-12 text-center">#</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-center">Received / Purchased</th>
                    <th className="px-3 py-2 text-center">DCR Pndg</th>
                    <th className="px-3 py-2 text-center">Completion</th>
                    <th className="px-3 py-2 text-right w-[110px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.map((row, index) => (
                    <React.Fragment key={row.id}>
                      <tr 
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(row.id);
                        }}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            e.stopPropagation();
                            router.push(`/staff/dashboard/accounts/dcr/purchase-dcr-received?receiptId=${encodeURIComponent(row.id)}`);
                          }
                        }}
                      >
                        <td className="px-3 py-1.5 text-center text-gray-400 text-xs">{(page - 1) * limit + index + 1}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900 whitespace-nowrap">{format(new Date(row.date), 'dd MMM yyyy')}</td>
                        <td className="px-3 py-1.5">
                          <p className="font-semibold text-gray-800 line-clamp-1" title={row.skuName}>{row.skuName}</p>
                        </td>
                        <td className="px-3 py-1.5 text-center font-bold text-gray-700">
                           <span className="text-emerald-600">{row.dcrReceived}</span> <span className="text-gray-400 font-normal">/</span> {row.purchasedQty}
                        </td>
                        <td className="px-3 py-1.5 text-center font-semibold">
                          <span className={row.dcrPending === 0 ? 'text-emerald-600' : row.dcrPending <= 5 ? 'text-amber-500' : 'text-red-600'}>
                            {row.dcrPending}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.completion === 100 ? 'bg-emerald-100 text-emerald-700' : 
                            row.completion >= 50 ? 'bg-amber-100 text-amber-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            {row.completion}%
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right w-[110px]">
                           <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                             <button
                               onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                               className="p-1.5 text-gray-400 hover:text-[#1A2766] transition-colors rounded hover:bg-gray-100"
                               title="Edit Record"
                             >
                               <Edit2 size={16} />
                             </button>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 router.push(`/staff/dashboard/accounts/dcr/purchase-dcr-received?receiptId=${encodeURIComponent(row.id)}`);
                               }}
                               className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors rounded hover:bg-emerald-50"
                               title="Open DCR Received"
                             >
                               <FileCheck size={16} />
                             </button>
                             <button
                               onClick={(e) => { e.stopPropagation(); toggleExpand(row.id); }}
                               className={`p-1.5 transition-colors rounded ${expandedRows.has(row.id) ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                               title={expandedRows.has(row.id) ? "Hide Details" : "View Details"}
                             >
                               {expandedRows.has(row.id) ? <ChevronUp size={16} /> : <Eye size={16} />}
                             </button>
                           </div>
                        </td>
                      </tr>
                      {expandedRows.has(row.id) && (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <div className="mb-3 flex gap-6 text-sm">
                               <div><span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold block mb-0.5">Vendor</span><span className="font-medium text-gray-900">{row.vendorName}</span></div>
                               <div><span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold block mb-0.5">Bill Number</span><span className="font-mono text-gray-900 bg-white px-1.5 py-0.5 rounded border border-gray-200">{row.billNumber}</span></div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {row.serials.map((s: any) => (
                                <span 
                                  key={s.serialNumber} 
                                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                                    s.vendorDcrStatus === 'RECEIVED' 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                      : 'bg-white border-gray-300 text-gray-500'
                                  }`}
                                  title={`Status: ${s.vendorDcrStatus}`}
                                >
                                  {s.serialNumber}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              
              {/* Pagination Footer */}
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-4">
                  <span>
                    Showing {data.total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, data.total)} of {data.total.toLocaleString()} records
                  </span>
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1A2766]"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span className="px-2 font-medium">Page {page} of {Math.max(1, Math.ceil(data.total / limit))}</span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil(data.total / limit)}
                    className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">New Purchase Receive</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="purchase-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Vendor Name <span className="text-red-500">*</span></label>
                    <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Date Received <span className="text-red-500">*</span></label>
                    <input type="date" value={dateReceived} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => setDateReceived(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Bill / Invoice No.</label>
                    <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-gray-800">Serial Numbers</h3>
                  {lines.map((line, index) => (
                    <div key={line.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-1 relative">
                          <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Product SKU <span className="text-red-500">*</span></label>
                          <div
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center"
                            onClick={() => setSkuDropdownOpen(skuDropdownOpen === line.id ? null : line.id)}
                          >
                            <span className="text-sm truncate">
                              {skus.find(s => s.id === line.skuId)?.name || <span className="text-gray-400">Select a product...</span>}
                            </span>
                            <ChevronDown size={14} className="text-gray-400" />
                          </div>
                          {skuDropdownOpen === line.id && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden">
                              <div className="p-2 border-b border-gray-100">
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Search products..."
                                  value={skuSearch[line.id] || ''}
                                  onChange={e => setSkuSearch({ ...skuSearch, [line.id]: e.target.value })}
                                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1A2766]"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {filteredSkus(line.id).map(s => (
                                  <div
                                    key={s.id}
                                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm flex flex-col"
                                    onClick={() => {
                                      updateLine(line.id, 'skuId', s.id);
                                      setSkuDropdownOpen(null);
                                    }}
                                  >
                                    <span className="font-medium text-gray-900">{s.name}</span>
                                    {s.sku && <span className="text-xs text-gray-500 font-mono">{s.sku}</span>}
                                  </div>
                                ))}
                                {filteredSkus(line.id).length === 0 && (
                                  <div className="p-3 text-center text-sm text-gray-500">No products found</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(line.id)} className="mt-6 text-gray-400 hover:text-red-500 p-2">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase mb-1 flex justify-between">
                          <span>Serial Numbers <span className="text-red-500">*</span></span>
                          <span className="text-emerald-600 font-medium">Count: {line.rawText.split(/[\s,\n]+/).filter(s => s.trim().length > 0).length}</span>
                        </label>
                        <textarea
                          value={line.rawText}
                          onChange={e => updateLine(line.id, 'rawText', e.target.value)}
                          rows={4}
                          placeholder="Paste serial numbers here (separated by spaces, commas, or new lines)..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#1A2766]"
                        />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addLine} className="flex items-center gap-1.5 text-sm font-medium text-[#1A2766] hover:text-[#1A2766]/80 px-2 py-1">
                    <Plus size={16} /> Add Another SKU
                  </button>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                type="submit"
                form="purchase-form"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-[#1A2766] hover:bg-[#1A2766]/90 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><CheckCircle size={16} /> Save Receipt</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Edit Purchase Record</h2>
              <button onClick={() => setEditingRow(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-5 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                  Editing details for <span className="font-bold">{editingRow.purchasedQty} serial numbers</span>. 
                  SKU and serial numbers cannot be modified after receipt.
                </p>
              </div>
              <form id="edit-form" onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Vendor Name <span className="text-red-500">*</span></label>
                  <input type="text" value={editVendor} onChange={e => setEditVendor(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Date Received <span className="text-red-500">*</span></label>
                  <input type="date" value={editDate} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => setEditDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Bill / Invoice No.</label>
                  <input type="text" value={editBill} onChange={e => setEditBill(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                </div>
                <div className="space-y-1.5 pt-2">
                  <label className="text-sm font-medium text-gray-500">Locked Fields</label>
                  <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 font-medium">
                    SKU: {editingRow.skuName}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                type="submit"
                form="edit-form"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-[#1A2766] hover:bg-[#1A2766]/90 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click-outside to close dropdown */}
      {skuDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSkuDropdownOpen(null)} />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Download, ExternalLink, Activity, Filter, Box, CheckCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight, X, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'AVAILABLE': return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'ALLOCATED': return 'bg-purple-50 text-purple-600 border-purple-200';
    case 'HOLD': return 'bg-red-50 text-red-600 border-red-200';
    case 'READY_TO_ISSUE': return 'bg-teal-50 text-teal-600 border-teal-200';
    case 'ISSUED': return 'bg-green-50 text-green-600 border-green-200';
    case 'RETURNED': return 'bg-orange-50 text-orange-600 border-orange-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const getVendorDcrColor = (status: string) => {
  switch (status) {
    case 'NOT_RECEIVED': return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'PENDING': return 'bg-orange-50 text-orange-600 border-orange-200';
    case 'RECEIVED': return 'bg-green-50 text-green-600 border-green-200';
    case 'EXEMPT': return 'bg-blue-50 text-blue-600 border-blue-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};



export default function SerialRegistryClient() {
  const [stats, setStats] = useState<any>(null);
  const [serials, setSerials] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [vendorDcrFilter, setVendorDcrFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 50;

  // Modal
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [serialDetail, setSerialDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Tags & Selection
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [taggingLoading, setTaggingLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);



  useEffect(() => {
    // Only search if length >= 3 or empty
    if (debouncedSearch.trim().length === 0 || debouncedSearch.trim().length >= 3) {
      setPage(1);
      fetchSerials();
    }
  }, [debouncedSearch, statusFilter, vendorDcrFilter]);

  useEffect(() => {
    if (page > 1 || (debouncedSearch.trim().length === 0 || debouncedSearch.trim().length >= 3)) {
       fetchSerials();
    }
  }, [page]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/dcr/serial-registry/stats');
      const data = await res.json();
      if (res.ok) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchSerials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        q: debouncedSearch,
        status: statusFilter,
        vendorDcrStatus: vendorDcrFilter,
      });

      const res = await fetch(`/api/admin/dcr/serial-registry?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSerials(data.serials);
        setTotal(data.total);
      }
    } catch (err) {
      toast.error('Failed to fetch serials');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        q: debouncedSearch,
        status: statusFilter,
        vendorDcrStatus: vendorDcrFilter,
        export: 'true'
      });

      window.location.href = `/api/admin/dcr/serial-registry?${params.toString()}`;
      toast.success('Export started');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const openSerialDetail = async (serialNumber: string) => {
    setSelectedSerial(serialNumber);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/dcr/serial-registry/${encodeURIComponent(serialNumber)}`);
      const data = await res.json();
      if (res.ok) {
        setSerialDetail(data.serial);
      } else {
        toast.error(data.error || 'Failed to fetch details');
        setSelectedSerial(null);
      }
    } catch (err) {
      toast.error('Failed to fetch serial details');
      setSelectedSerial(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCopy = (text: string, e?: React.MouseEvent, toastMsg: string = 'Serial copied') => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(toastMsg, { style: { fontSize: '12px' } });
  };

  const closeDetail = () => {
    setSelectedSerial(null);
    setSerialDetail(null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSet = new Set(selectedSerials);
      serials.forEach(s => newSet.add(s.serialNumber));
      setSelectedSerials(newSet);
    } else {
      const newSet = new Set(selectedSerials);
      serials.forEach(s => newSet.delete(s.serialNumber));
      setSelectedSerials(newSet);
    }
    setLastSelectedIndex(null);
  };

  const handleSelectRow = (serialNumber: string, index: number, e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newSet = new Set(selectedSerials);
    
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      const isSelected = newSet.has(serialNumber);
      
      for (let i = start; i <= end; i++) {
        if (!isSelected) {
          newSet.add(serials[i].serialNumber);
        } else {
          newSet.delete(serials[i].serialNumber);
        }
      }
    } else {
      if (newSet.has(serialNumber)) {
        newSet.delete(serialNumber);
      } else {
        newSet.add(serialNumber);
      }
    }
    
    setSelectedSerials(newSet);
    setLastSelectedIndex(index);
  };

  const submitTags = async () => {
    if (selectedSerials.size === 0) return;
    setTaggingLoading(true);
    try {
      const res = await fetch('/api/admin/dcr/serial-registry/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumbers: Array.from(selectedSerials),
          tag: tagInput
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update tags');
      toast.success('Tags updated successfully');
      setTagModalOpen(false);
      setTagInput('');
      setSelectedSerials(new Set());
      setLastSelectedIndex(null);
      fetchSerials();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tags');
    } finally {
      setTaggingLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 w-full min-w-0 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Serial Registry</h1>
          <p className="text-sm text-gray-500 mt-1">Search and track every serial number in the DCR ecosystem.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export Results'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div 
          onClick={() => { setStatusFilter('ALL'); setVendorDcrFilter('ALL'); }}
          className={`bg-white p-3 rounded-xl border ${statusFilter === 'ALL' && vendorDcrFilter === 'ALL' ? 'border-[#1A2766] ring-1 ring-[#1A2766]' : 'border-gray-200'} cursor-pointer hover:border-[#1A2766]/50 transition-all shadow-sm`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Serials</div>
          <div className="text-xl font-bold text-gray-900">{stats?.total || 0}</div>
        </div>
        <div 
          onClick={() => { setVendorDcrFilter('NOT_RECEIVED'); setStatusFilter('ALL'); }}
          className={`bg-white p-3 rounded-xl border ${vendorDcrFilter === 'NOT_RECEIVED' ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200'} cursor-pointer hover:border-orange-500/50 transition-all shadow-sm`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Vendor DCR Pending</div>
          <div className="text-xl font-bold text-orange-600">{stats?.vendorDcrPending || 0}</div>
        </div>
        <div 
          onClick={() => { setStatusFilter('AVAILABLE'); setVendorDcrFilter('ALL'); }}
          className={`bg-white p-3 rounded-xl border ${statusFilter === 'AVAILABLE' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'} cursor-pointer hover:border-blue-500/50 transition-all shadow-sm`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Available</div>
          <div className="text-xl font-bold text-blue-600">{stats?.available || 0}</div>
        </div>
        <div 
          onClick={() => { setStatusFilter('ALLOCATED'); setVendorDcrFilter('ALL'); }}
          className={`bg-white p-3 rounded-xl border ${statusFilter === 'ALLOCATED' ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200'} cursor-pointer hover:border-purple-500/50 transition-all shadow-sm`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Allocated</div>
          <div className="text-xl font-bold text-purple-600">{stats?.allocated || 0}</div>
        </div>
        <div 
          onClick={() => { setStatusFilter('ALLOCATED'); setVendorDcrFilter('RECEIVED'); }}
          className={`bg-white p-3 rounded-xl border ${statusFilter === 'ALLOCATED' && vendorDcrFilter === 'RECEIVED' ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'} cursor-pointer hover:border-red-500/50 transition-all shadow-sm`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Hold</div>
          <div className="text-xl font-bold text-red-600">{stats?.hold || 0}</div>
        </div>
        <div 
          onClick={() => { setStatusFilter('READY_TO_ISSUE'); setVendorDcrFilter('ALL'); }}
          className={`bg-white p-3 rounded-xl border ${statusFilter === 'READY_TO_ISSUE' ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-200'} cursor-pointer hover:border-teal-500/50 transition-all shadow-sm`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ready To Issue</div>
          <div className="text-xl font-bold text-teal-600">{stats?.readyToIssue || 0}</div>
        </div>
        <div 
          onClick={() => { setStatusFilter('ISSUED'); setVendorDcrFilter('ALL'); }}
          className={`bg-white p-3 rounded-xl border ${statusFilter === 'ISSUED' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200'} cursor-pointer hover:border-green-500/50 transition-all shadow-sm`}
        >
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Issued</div>
          <div className="text-xl font-bold text-green-600">{stats?.issued || 0}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by Serial Number, SKU, Product, Invoice, Customer, Vendor... (min 3 chars)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-all"
          />
        </div>
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] min-w-[160px]"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="HOLD">Hold</option>
            <option value="READY_TO_ISSUE">Ready To Issue</option>
            <option value="ISSUED">Issued</option>
            <option value="RETURNED">Returned</option>
          </select>
          <select
            value={vendorDcrFilter}
            onChange={(e) => setVendorDcrFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] min-w-[160px]"
          >
            <option value="ALL">All Vendor DCR</option>
            <option value="NOT_RECEIVED">Not Received (Pending)</option>
            <option value="RECEIVED">Received</option>
            <option value="EXEMPT">Exempt</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px] w-full min-w-0">
        <div className="flex-1 overflow-auto w-full">
          <table className="w-full text-left text-xs whitespace-nowrap table-fixed min-w-[1560px]">
            <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 w-[40px] sticky left-0 z-30 bg-gray-100 border-r border-gray-200 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                    checked={serials.length > 0 && serials.every(s => selectedSerials.has(s.serialNumber))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[50px] sticky left-[40px] z-30 bg-gray-100 border-r border-gray-200 text-center">#</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[220px] sticky left-[90px] z-30 bg-gray-100 border-r border-gray-200">Serial Number</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[320px]">Product / SKU</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[180px]">Vendor</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[140px]">Status</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[140px]">Vendor DCR</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[200px]">Serial Tag</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[220px]">Allocation</th>
                <th className="px-3 py-2 font-bold uppercase tracking-wider w-[100px] text-center">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading serials...
                    </div>
                  </td>
                </tr>
              ) : serials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No serials found matching the current filters.
                  </td>
                </tr>
              ) : (
                serials.map((serial, index) => {
                  const alloc = serial.allocations?.[0];
                  const now = new Date().getTime();
                  const ageDays = Math.floor((now - new Date(serial.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  const rowIndex = ((page - 1) * limit) + index + 1;

                  return (
                    <tr 
                      key={serial.id} 
                      className="hover:bg-blue-50/70 transition-colors cursor-pointer group"
                      onClick={() => openSerialDetail(serial.serialNumber)}
                    >
                      <td className="px-3 py-1.5 text-center sticky left-0 z-10 bg-white group-hover:bg-blue-50/70 border-r border-gray-100">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                          checked={selectedSerials.has(serial.serialNumber)}
                          onClick={(e) => handleSelectRow(serial.serialNumber, index, e)}
                          onChange={() => {}}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500 font-medium sticky left-[40px] z-10 bg-white group-hover:bg-blue-50/70 border-r border-gray-100">
                        {rowIndex}
                      </td>
                      <td className="px-3 py-1.5 font-bold text-[#1A2766] sticky left-[90px] z-10 bg-white group-hover:bg-blue-50/70 border-r border-gray-100">
                        <div className="flex items-center gap-2">
                          <span>{serial.serialNumber}</span>
                          <button 
                            onClick={(e) => handleCopy(serial.serialNumber, e)}
                            className="p-1 rounded hover:bg-blue-100 text-[#1A2766]/50 hover:text-[#1A2766] transition-colors"
                            title="Copy Serial Number"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 truncate text-gray-900 font-medium" title={`${serial.computedProduct} (${serial.computedSku})`}>
                        <div className="flex items-center gap-2">
                          <span>{serial.computedProduct} <span className="text-gray-500">({serial.computedSku})</span></span>
                          <button 
                            onClick={(e) => handleCopy(serial.computedProduct, e, 'Product copied')}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Copy Product Name"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 truncate text-gray-900 font-medium" title={serial.vendorName || '-'}>
                        {serial.vendorName || '-'}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${getStatusColor(serial.status)}`}>
                          {serial.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${getVendorDcrColor(serial.vendorDcrStatus)}`}>
                          {serial.vendorDcrStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 truncate text-gray-900 font-medium" title={serial.tag?.tag}>
                        {serial.tag?.tag ? (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200 font-medium text-[10px] uppercase tracking-wide">
                            {serial.tag.tag}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic font-normal">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 truncate" title={alloc ? `${alloc.invoice.invoiceNumber} (${alloc.invoice.customerName})` : 'Not Allocated'}>
                        {alloc ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 font-medium">
                              {alloc.invoice.invoiceNumber} <span className="text-gray-500">({alloc.invoice.customerName})</span>
                            </span>
                            <button 
                              onClick={(e) => handleCopy(`${alloc.invoice.invoiceNumber} (${alloc.invoice.customerName})`, e, 'Allocation copied')}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Copy Allocation"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Not Allocated</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center" title={`Created: ${new Date(serial.createdAt).toLocaleDateString('en-IN')}`}>
                        <span className="font-medium text-gray-900">{ageDays}d</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{serials.length > 0 ? (page - 1) * limit + 1 : 0}</span> to <span className="font-semibold text-gray-900">{Math.min(page * limit, total)}</span> of <span className="font-semibold text-gray-900">{total}</span> results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 py-1.5 text-sm font-medium text-gray-700">
              Page {page} of {totalPages || 1}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Serial Detail Modal */}
      {selectedSerial && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-[#1A2766]/10 rounded-xl flex items-center justify-center text-[#1A2766]">
                  <Box size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-[#1A2766] font-mono tracking-tight flex items-center gap-3">
                    {selectedSerial}
                    <button 
                      onClick={() => handleCopy(selectedSerial as string)}
                      className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                      title="Copy Serial Number"
                    >
                      <Copy size={16} />
                    </button>
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Serial Ledger Entry</span>
                  </div>
                </div>
              </div>
              <button onClick={closeDetail} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-12 flex justify-center items-center h-[500px]">
                <svg className="animate-spin h-8 w-8 text-[#1A2766]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : serialDetail ? (
              <div className="flex-1 overflow-auto p-6 space-y-6">
                
                {/* Top Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Current Status</div>
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border ${getStatusColor(serialDetail.status)}`}>
                      {serialDetail.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Vendor DCR Status</div>
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border ${getVendorDcrColor(serialDetail.vendorDcrStatus)}`}>
                      {serialDetail.vendorDcrStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Created At</div>
                    <div className="font-semibold text-gray-900">{new Date(serialDetail.createdAt).toLocaleDateString('en-IN')}</div>
                    <div className="text-xs text-gray-500">{new Date(serialDetail.createdAt).toLocaleTimeString('en-IN')}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Age in System</div>
                    <div className="font-semibold text-gray-900">
                      {Math.floor((new Date().getTime() - new Date(serialDetail.createdAt).getTime()) / (1000 * 60 * 60 * 24))} Days
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Allocation Information */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-semibold text-gray-800 text-sm flex items-center justify-between">
                        <span>Allocation Information</span>
                        {serialDetail.currentAllocation && (
                          <a 
                            href={`https://books.zoho.com/app/1018999824#/invoices/${serialDetail.currentAllocation.invoice.zohoInvoiceId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                          >
                            Zoho <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <div className="p-4 space-y-4">
                        {serialDetail.currentAllocation ? (
                          <>
                            <div>
                              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Product</span>
                              <div className="text-sm font-medium text-gray-900">{serialDetail.computedProduct}</div>
                              <div className="text-xs text-gray-500 font-mono mt-0.5">{serialDetail.computedSku}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                              <div>
                                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Customer</span>
                                <a 
                                  href={`https://books.zoho.com/app/1018999824#/contacts/${serialDetail.currentAllocation.invoice.customerId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {serialDetail.currentAllocation.invoice.customerName}
                                </a>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Invoice Number</span>
                                <div className="flex items-center gap-2">
                                  <a 
                                    href={`https://books.zoho.com/app/1018999824#/invoices/${serialDetail.currentAllocation.invoice.zohoInvoiceId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {serialDetail.currentAllocation.invoice.invoiceNumber}
                                  </a>
                                  <button 
                                    onClick={() => handleCopy(serialDetail.currentAllocation.invoice.invoiceNumber)}
                                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Allocated On</span>
                                <div className="text-sm font-medium text-gray-900">{new Date(serialDetail.currentAllocation.allocatedAt).toLocaleDateString('en-IN')}</div>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Invoice Date</span>
                                <div className="text-sm font-medium text-gray-900">{new Date(serialDetail.currentAllocation.invoice.invoiceDate).toLocaleDateString('en-IN')}</div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-6 text-gray-400">
                            <Box size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium text-gray-500">Not Currently Allocated</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vendor Information */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-semibold text-gray-800 text-sm">
                        Vendor Information
                      </div>
                      <div className="p-4 space-y-4">
                        {serialDetail.vendorInfo?.vendorName ? (
                          <>
                            <div>
                              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Vendor Name</span>
                              <div className="text-sm font-medium text-gray-900">{serialDetail.vendorInfo.vendorName}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                              <div>
                                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Bill Number</span>
                                <div className="text-sm font-medium text-gray-900">{serialDetail.vendorInfo.billNumber || '-'}</div>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">DCR Received</span>
                                <div className="text-sm font-medium text-gray-900">
                                  {serialDetail.vendorInfo.vendorDcrReceivedAt ? new Date(serialDetail.vendorInfo.vendorDcrReceivedAt).toLocaleDateString('en-IN') : '-'}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No vendor info available.</div>
                        )}
                      </div>
                    </div>
                    
                    {/* Issue Information */}
                    {serialDetail.issuedInfo && (
                      <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                        <div className="bg-green-50 px-4 py-3 border-b border-green-100 font-semibold text-green-800 text-sm flex items-center gap-2">
                          <CheckCircle size={16} /> Issued Details
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-4">
                          <div>
                            <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Issued By</span>
                            <div className="text-sm font-medium text-gray-900">{serialDetail.issuedInfo.issuedBy}</div>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Issued At</span>
                            <div className="text-sm font-medium text-gray-900">{new Date(serialDetail.issuedInfo.issuedAt).toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - History Timeline */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[550px]">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-semibold text-gray-800 text-sm flex items-center gap-2 shrink-0">
                      <Activity size={16} /> History Timeline
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      {serialDetail.history && serialDetail.history.length > 0 ? (
                        <div className="relative border-l border-gray-200 ml-3 space-y-6 pb-4">
                          {serialDetail.history.map((event: any, i: number) => {
                            let parsedDesc = null;
                            try {
                              parsedDesc = JSON.parse(event.eventDescription);
                            } catch (e) {}

                            return (
                              <div key={event.id} className="relative pl-6">
                                <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[6.5px] top-1.5 border-2 border-white shadow-sm"></div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">{event.eventType.replace(/_/g, ' ')}</span>
                                  
                                  {parsedDesc && typeof parsedDesc === 'object' ? (
                                    <div className="bg-gray-50 border border-gray-100 rounded p-2 mt-1 space-y-1">
                                      {Object.entries(parsedDesc).map(([k, v]) => {
                                        if (v === null || v === undefined || v === '') return null;
                                        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                        return (
                                          <div key={k} className="text-xs text-gray-800">
                                            <span className="font-semibold text-gray-500">{label}:</span> {String(v)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-sm font-medium text-gray-900">{event.eventDescription}</span>
                                  )}

                                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500">
                                    <Clock size={10} />
                                    <span>{new Date(event.createdAt).toLocaleString('en-IN')}</span>
                                    {event.userId && <span>• User ID: {event.userId.substring(0, 8)}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic text-center py-10">No history available.</div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Sticky Action Bar */}
      {selectedSerials.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle size={18} className="text-emerald-400" />
            <span>{selectedSerials.size} Serials Selected</span>
          </div>
          <div className="w-px h-5 bg-gray-700"></div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setTagInput(''); setTagModalOpen(true); }}
              className="bg-[#1A2766] hover:bg-[#283885] px-4 py-1.5 rounded-full text-sm font-bold transition-colors shadow-sm"
            >
              Add Tag
            </button>
            <button 
              onClick={() => { setSelectedSerials(new Set()); setLastSelectedIndex(null); }}
              className="text-gray-300 hover:text-white px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {tagModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Tag Selected Serials</h2>
              <button onClick={() => setTagModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Serial Tag
              </label>
              <input 
                type="text" 
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                maxLength={256}
                placeholder="e.g. VIP Installation, Customer Demo Unit"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-all"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Leave empty to clear existing tags from the selected serials. Max 256 characters.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setTagModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={submitTags}
                disabled={taggingLoading}
                className="px-4 py-2 text-sm font-bold bg-[#1A2766] text-white hover:bg-[#283885] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {taggingLoading ? 'Saving...' : 'Save Tag'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

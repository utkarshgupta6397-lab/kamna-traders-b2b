'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [vendorDcrFilter, setVendorDcrFilter] = useState(searchParams.get('vendorDcr') || 'ALL');
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
  const [tagInput, setTagInput] = useState(searchParams.get('serialTag') || '');
  const [taggingLoading, setTaggingLoading] = useState(false);

  // Vendor Report
  const [vendorReportOpen, setVendorReportOpen] = useState(false);
  const [vendorReportData, setVendorReportData] = useState<any[]>([]);
  const [vendorReportLoading, setVendorReportLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [minDaysFilter, setMinDaysFilter] = useState<number | ''>('');

  const [invoiceIdFilter, setInvoiceIdFilter] = useState(searchParams.get('invoiceId') || '');
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState(searchParams.get('invoiceNumber') || '');

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    // Only search if length >= 3 or empty or if filtering by invoice
    if (debouncedSearch.trim().length === 0 || debouncedSearch.trim().length >= 3 || invoiceIdFilter) {
      setPage(1);
      fetchSerials();
    }
  }, [debouncedSearch, statusFilter, vendorDcrFilter, invoiceIdFilter]);

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

  const [missingSerials, setMissingSerials] = useState<string[]>([]);
  const [isMultiSearch, setIsMultiSearch] = useState(false);
  const [multiSerialsCount, setMultiSerialsCount] = useState(0);

  const fetchSerials = async () => {
    setLoading(true);
    try {
      // Detect Multi Search Mode
      const isMulti = debouncedSearch.includes(',') || debouncedSearch.includes('\n') || debouncedSearch.includes(';');
      
      if (isMulti) {
        setIsMultiSearch(true);
        const parsedSerials = Array.from(new Set(
          debouncedSearch.split(/[\n,;]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0)
        ));
        setMultiSerialsCount(parsedSerials.length);

        if (parsedSerials.length === 0) {
          setSerials([]);
          setTotal(0);
          setMissingSerials([]);
          setLoading(false);
          return;
        }

        const res = await fetch('/api/admin/dcr/serial-registry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serials: parsedSerials,
            page,
            limit,
            status: statusFilter,
            vendorDcrStatus: vendorDcrFilter,
            invoiceId: invoiceIdFilter
          })
        });
        const data = await res.json();
        if (res.ok) {
          setSerials(data.serials);
          setTotal(data.total);
          setMissingSerials(data.missingSerials || []);
        } else {
          toast.error(data.error || 'Failed to fetch serials');
        }
      } else {
        setIsMultiSearch(false);
        setMissingSerials([]);
        setMultiSerialsCount(0);
        
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          q: debouncedSearch,
          status: statusFilter,
          vendorDcrStatus: vendorDcrFilter,
        });
        if (invoiceIdFilter) {
          params.append('invoiceId', invoiceIdFilter);
        }

        const res = await fetch(`/api/admin/dcr/serial-registry?${params.toString()}`);
        const data = await res.json();
        if (res.ok) {
          setSerials(data.serials);
          setTotal(data.total);
        } else {
          toast.error(data.error || 'Failed to fetch serials');
        }
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

  // Vendor Report Logic
  const fetchVendorReport = async () => {
    setVendorReportLoading(true);
    try {
      const res = await fetch('/api/admin/dcr/reports/vendor-pending');
      const data = await res.json();
      if (res.ok) setVendorReportData(data.data);
      else toast.error('Failed to load vendor report');
    } catch (err) {
      toast.error('Failed to load vendor report');
    } finally {
      setVendorReportLoading(false);
    }
  };

  const handleOpenVendorReport = () => {
    setVendorReportOpen(true);
    if (vendorReportData.length === 0) fetchVendorReport();
  };

  const filteredVendorReport = vendorReportData.filter(item => {
    const searchLower = vendorSearch.toLowerCase();
    const matchesSearch = !vendorSearch || 
      item.vendorName.toLowerCase().includes(searchLower) || 
      item.productName.toLowerCase().includes(searchLower) || 
      item.skuCode.toLowerCase().includes(searchLower) ||
      item.serialNumber.toLowerCase().includes(searchLower) ||
      item.tag.toLowerCase().includes(searchLower);
    const matchesDays = minDaysFilter === '' || item.daysPending >= Number(minDaysFilter);
    return matchesSearch && matchesDays;
  });

  const vendorGrouped = filteredVendorReport.reduce((acc, item) => {
    if (!acc[item.vendorName]) {
      acc[item.vendorName] = { 
        vendorName: item.vendorName, 
        products: {},
        billNumbers: new Set<string>()
      };
    }
    if (item.billNumber && item.billNumber !== 'null' && item.billNumber.trim() !== '') {
      acc[item.vendorName].billNumbers.add(item.billNumber.trim());
    }

    if (!acc[item.vendorName].products[item.productName]) {
      acc[item.vendorName].products[item.productName] = {
        productName: item.productName,
        skuCode: item.skuCode,
        tags: {},
        billNumbers: new Set<string>()
      };
    }
    const prod = acc[item.vendorName].products[item.productName];
    if (item.billNumber && item.billNumber !== 'null' && item.billNumber.trim() !== '') {
      prod.billNumbers.add(item.billNumber.trim());
    }

    if (!prod.tags[item.tag]) prod.tags[item.tag] = [];
    prod.tags[item.tag].push(item);
    return acc;
  }, {} as Record<string, any>);

  const vendorReportKpis = {
    pendingVendors: Object.keys(vendorGrouped).length,
    pendingProducts: new Set(filteredVendorReport.map(i => i.productName)).size,
    pendingSerials: filteredVendorReport.length,
    oldestPending: filteredVendorReport.length > 0 ? Math.max(...filteredVendorReport.map(i => i.daysPending)) : 0
  };

  const handleCopyWhatsAppSummary = async () => {
    // Group by vendor -> product
    const grouped: Record<string, Record<string, number>> = {};
    
    filteredVendorReport.forEach(item => {
      let vendor = item.vendorName || 'No Data';
      if (vendor === 'Unknown Vendor' || vendor === 'null') vendor = 'No Data';
      
      // Shorten long vendor names
      if (vendor.length > 50 && vendor.includes('->')) {
        const parts = vendor.split('->');
        vendor = parts[parts.length - 1].trim();
      }

      const product = item.productName || 'Unknown Product';
      
      if (!grouped[vendor]) grouped[vendor] = {};
      if (!grouped[vendor][product]) grouped[vendor][product] = 0;
      
      grouped[vendor][product]++;
    });

    // Convert to array and sort by total pending DESC
    const vendorsArray = Object.keys(grouped).map(vendor => {
      const products = Object.keys(grouped[vendor]).map(product => ({
        product,
        count: grouped[vendor][product]
      })).sort((a, b) => b.count - a.count); // sort products by count DESC
      
      const totalPending = products.reduce((sum, p) => sum + p.count, 0);
      return { vendor, products, totalPending };
    }).sort((a, b) => b.totalPending - a.totalPending); // sort vendors by total DESC

    // Format text
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    let text = `${formattedDate} ${formattedTime} | DCR Pendency Report\n\n`;
    
    vendorsArray.forEach(v => {
      text += `Pending at ${v.vendor}\n-----------------------\n`;
      v.products.forEach(p => {
        text += `${p.product} × ${p.count}\n`;
      });
      text += `\n`;
    });
    
    const uniqueVendorsCount = vendorsArray.length;
    const uniqueProductsCount = new Set(filteredVendorReport.map(i => i.productName)).size;
    const totalPendingSerials = filteredVendorReport.length;

    text += `--------------------------------\n`;
    text += `Total Pending Serials: ${totalPendingSerials}\n`;
    text += `Total Products: ${uniqueProductsCount}\n`;
    text += `Total Vendor Tags: ${uniqueVendorsCount}`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('DCR Pendency Summary copied');
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopySerials = async (serialsToCopy: string[], separator: 'newline' | 'comma' = 'newline', contextMsg: string) => {
    const text = serialsToCopy.join(separator === 'comma' ? ',' : '\n');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success(contextMsg);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        toast.success(contextMsg);
      }
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleCopyVendorSummary = async (vendorName: string, productsObj: any, billNumbersSet?: Set<string>) => {
    const now = new Date();
    // Use Intl to format like '09 Jun 2026 | 15:36'
    const day = now.getDate().toString().padStart(2, '0');
    const month = now.toLocaleString('en-GB', { month: 'short' });
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const generatedStr = `${day} ${month} ${year} | ${hours}:${mins}`;

    let summary = `📋 Vendor DCR Pending\n${generatedStr}\n\nVendor: ${vendorName}\n\n`;

    if (billNumbersSet && billNumbersSet.size > 0) {
      const sortedBills = Array.from(billNumbersSet).sort();
      summary += `Bill(s): ${sortedBills.join(', ')}\n\n`;
    }
    
    let totalProducts = 0;
    let totalSerials = 0;

    // Sort products by Pending Days DESC then Quantity DESC
    const sortedProducts = Object.values(productsObj).sort((a: any, b: any) => {
      const aSerials = Object.values(a.tags).flat() as any[];
      const bSerials = Object.values(b.tags).flat() as any[];
      const aMaxDays = Math.max(...aSerials.map(s => s.daysPending));
      const bMaxDays = Math.max(...bSerials.map(s => s.daysPending));
      
      if (bMaxDays !== aMaxDays) return bMaxDays - aMaxDays;
      return bSerials.length - aSerials.length;
    });

    sortedProducts.forEach((p: any) => {
      totalProducts++;
      const allSerials = Object.values(p.tags).flat() as any[];
      totalSerials += allSerials.length;
      
      const oldestDays = Math.max(...allSerials.map((s: any) => s.daysPending));
      
      summary += `• ${p.productName}\n  Qty: ${allSerials.length}\n`;
      
      const tagEntries = Object.entries(p.tags).filter(([tag]) => tag.toLowerCase() !== 'untagged');
      if (tagEntries.length > 0) {
        const tagsStr = tagEntries.map(([tag, list]: [string, any]) => `${tag} (${list.length})`).join(', ');
        summary += `  Tags: ${tagsStr}\n`;
      }
      
      summary += `  Pending Since: ${oldestDays} Days\n\n`;
    });

    summary += `Products: ${totalProducts}\n`;
    summary += `Pending Serials: ${totalSerials}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(summary);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = summary;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      toast.success(`Copied summary for ${vendorName}`);
    } catch (e) {
      toast.error('Failed to copy');
    }
  };

  const handleCopyProductCsv = async (productObj: any) => {
    let csv = "Product Name,Serial Number,Tag,Pending Days\n";
    Object.entries(productObj.tags).forEach(([tag, serialsList]: [string, any]) => {
      serialsList.forEach((s: any) => {
        csv += `"${productObj.productName}","${s.serialNumber}","${tag}",${s.daysPending}\n`;
      });
    });
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(csv);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = csv;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      toast.success(`Copied CSV for ${productObj.productName}`);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Serial Registry</h1>
          <p className="text-sm text-gray-500 mt-1">Search and track every serial number in the DCR ecosystem.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleOpenVendorReport}
            className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-100 transition-colors shadow-sm flex items-center gap-2"
          >
            <Activity size={16} />
            Vendor DCR Pending Report
          </button>
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
      {!invoiceIdFilter && (
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
      )}

      {/* Filters and Search */}
      {invoiceIdFilter && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter size={16} />
            Filtered by Invoice: {invoiceNumberFilter || invoiceIdFilter}
          </div>
          <button 
            onClick={() => {
              setInvoiceIdFilter('');
              setInvoiceNumberFilter('');
              if (!searchTerm.trim()) {
                fetchSerials();
              }
            }}
            className="text-blue-600 hover:text-blue-900 bg-white border border-blue-200 hover:bg-blue-100 px-2 py-1 rounded text-xs font-bold transition-colors"
          >
            Clear Filter
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <textarea 
            placeholder="Search by Serial Number, SKU, Product, Invoice, Customer, Vendor... (min 3 chars). Use commas, newlines, or semicolons for Multi-Search Mode."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            rows={1}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-all resize-y min-h-[42px]"
          />
          {isMultiSearch && (
            <div className="absolute right-3 top-3 bg-[#1A2766] text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase shadow-sm">
              Multi Search Mode
            </div>
          )}
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

      {/* Multi Search Summary */}
      {isMultiSearch && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-900">Found: {total} / {multiSerialsCount}</h3>
          </div>
          
          {missingSerials.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-blue-800 flex items-center outline-none">
                <span className="bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-100 transition-colors">
                  Show Missing Serials ({missingSerials.length})
                </span>
              </summary>
              <div className="mt-3 bg-white border border-blue-100 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {missingSerials.map(s => (
                    <span key={s} className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md text-xs font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

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
                                    {event.userName ? (
                                      <span>• By: {event.userName}</span>
                                    ) : event.userId ? (
                                      <span>• By: System</span>
                                    ) : null}
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

      {/* Vendor DCR Pending Report Drawer */}
      {vendorReportOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setVendorReportOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-[800px] bg-gray-50 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex-shrink-0 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                  <Activity className="text-orange-600" size={20} /> Vendor DCR Pending Report
                </h2>
                <p className="text-sm text-gray-500 mt-1">Serials awaiting DCR from vendors.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyWhatsAppSummary}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Copy size={14} /> Copy Today's Summary
                </button>
                <button onClick={() => setVendorReportOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white grid grid-cols-4 gap-4 flex-shrink-0">
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl text-center">
                <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">Vendors</div>
                <div className="text-2xl font-bold text-orange-700">{vendorReportKpis.pendingVendors}</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-center">
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Products</div>
                <div className="text-2xl font-bold text-blue-700">{vendorReportKpis.pendingProducts}</div>
              </div>
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-center">
                <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Serials</div>
                <div className="text-2xl font-bold text-red-700">{vendorReportKpis.pendingSerials}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-center">
                <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Oldest Pending</div>
                <div className="text-2xl font-bold text-gray-800">{vendorReportKpis.oldestPending}d</div>
              </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex gap-4 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search vendor, product, SKU, serial..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <div className="w-48">
                <input
                  type="number"
                  placeholder="Min Pending Days"
                  value={minDaysFilter}
                  onChange={(e) => setMinDaysFilter(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {vendorReportLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                </div>
              ) : Object.keys(vendorGrouped).length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 font-medium">No pending DCRs found matching criteria.</p>
                </div>
              ) : (
                Object.values(vendorGrouped).map((vendor: any) => (
                  <div key={vendor.vendorName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/80 flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{vendor.vendorName}</h3>
                        {vendor.billNumbers && vendor.billNumbers.size > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                             {vendor.billNumbers.size === 1 ? (
                              <span>Bill: {String(Array.from(vendor.billNumbers)[0])}</span>
                            ) : (
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <span className="font-semibold text-gray-600">Bills:</span>
                                <ul className="list-disc pl-4 space-y-0.5">
                                  {Array.from(vendor.billNumbers).sort().map((bill: any) => (
                                    <li key={bill}>{bill}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopyVendorSummary(vendor.vendorName, vendor.products, vendor.billNumbers)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Copy size={14} /> Copy Summary
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      {Object.values(vendor.products)
                        .sort((a: any, b: any) => {
                          const aSerials = Object.values(a.tags).flat() as any[];
                          const bSerials = Object.values(b.tags).flat() as any[];
                          const aMaxDays = Math.max(...aSerials.map(s => s.daysPending));
                          const bMaxDays = Math.max(...bSerials.map(s => s.daysPending));
                          if (bMaxDays !== aMaxDays) return bMaxDays - aMaxDays;
                          return bSerials.length - aSerials.length;
                        })
                        .map((product: any) => {
                        const allProdSerials = Object.values(product.tags).flat() as any[];
                        const oldest = Math.max(...allProdSerials.map((s: any) => s.daysPending));
                        const newest = Math.min(...allProdSerials.map((s: any) => s.daysPending));

                        return (
                          <div key={product.skuCode} className="border border-gray-100 rounded-lg overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-gray-800 break-words">{product.productName}</h4>
                                <div className="flex flex-col gap-1 mt-1 text-xs text-gray-500">
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <span className="font-mono">SKU: {product.skuCode}</span>
                                    <span className="font-semibold text-orange-600">Pending: {allProdSerials.length}</span>
                                    <span>
                                      Pending Since: {oldest === newest ? `${oldest} Days` : `${oldest} Days (Newest: ${newest} Days)`}
                                    </span>
                                  </div>
                                  {vendor.billNumbers.size > 1 && product.billNumbers && product.billNumbers.size > 0 && (
                                    <div className="font-medium text-gray-700 mt-0.5">
                                      Bills: {Array.from(product.billNumbers).sort().join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <button
                                  onClick={() => handleCopyProductCsv(product)}
                                  className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                                >
                                  <ExternalLink size={12} /> Copy CSV
                                </button>
                                <button
                                  onClick={() => handleCopySerials(allProdSerials.map((s: any) => s.serialNumber), 'comma', `Copied ${allProdSerials.length} serials`)}
                                  className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                                >
                                  <Copy size={12} /> Copy Serials
                                </button>
                              </div>
                            </div>
                            <div className="p-3 space-y-3">
                              {Object.entries(product.tags).map(([tag, serialsList]: [string, any]) => (
                                <div key={tag}>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{tag} ({serialsList.length})</div>
                                    <button 
                                      onClick={() => handleCopySerials(serialsList.map((s: any) => s.serialNumber), 'comma', `Copied ${serialsList.length} serials for ${tag}`)}
                                      className="text-gray-400 hover:text-gray-700 transition-colors bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1"
                                    >
                                      <Copy size={10} /> Copy Tag Serials
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {serialsList.map((s: any) => (
                                      <span key={s.serialNumber} className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded border bg-orange-50 text-orange-800 border-orange-200" title={`${s.daysPending} days pending`}>
                                        {s.serialNumber}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

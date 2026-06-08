'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Search, AlertCircle, ChevronRight } from 'lucide-react';
import { isRecommendedForDcr } from '@/lib/dcr-config';
import { useDcrStats } from '../../layout';

export default function ReviewClient({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentParamsString = searchParams.toString();
  const { refreshStats } = useDcrStats();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<'save' | 'saveNext' | 'noDcr' | 'skip' | null>(null);
  
  // SKU Master for manual entry
  const [skuMaster, setSkuMaster] = useState<any[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

  // State for selections and manual items
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [manualItems, setManualItems] = useState<any[]>([]);

  // Manual item form
  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [manualQty, setManualQty] = useState('');
  const [manualRemarks, setManualRemarks] = useState('');

  // Skip Modal
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipConfirmed, setSkipConfirmed] = useState(false);

  useEffect(() => {
    fetchInvoiceDetails();
    fetchSkuMaster();
  }, [invoiceId]);

  const fetchInvoiceDetails = async () => {
    try {
      const res = await fetch(`/api/admin/dcr/invoices/${invoiceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const inv = data.invoice;
      setInvoice(inv);
      
      if (inv && inv.items) {
        const initialSelections: Record<string, boolean> = {};
        const initialManualItems: any[] = [];
        inv.items.forEach((item: any) => {
          if (item.source === 'ZOHO') {
            initialSelections[item.id] = item.selectedForDCR;
          } else if (item.source === 'MANUAL') {
            initialManualItems.push({
              id: item.id,
              itemId: item.itemId,
              itemName: item.itemName,
              quantity: item.quantity,
              remarks: item.remarks,
              source: 'MANUAL',
              selectedForDCR: true,
            });
          }
        });
        setSelections(initialSelections);
        setManualItems(initialManualItems);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch invoice details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkuMaster = async () => {
    try {
      const res = await fetch('/api/staff/skus');
      const data = await res.json();
      if (res.ok && data.skus) {
        setSkuMaster(data.skus);
      }
    } catch (err) {
      console.error('Failed to fetch SKU master', err);
    }
  };

  const isItemAllocated = (itemId: string) => {
    if (!invoice || !invoice.serialAllocations) return false;
    return invoice.serialAllocations.some((alloc: any) => alloc.skuId === itemId);
  };

  const handleToggleSelection = (itemId: string) => {
    const isCurrentlySelected = !!selections[itemId];
    if (isCurrentlySelected && isItemAllocated(itemId)) {
      toast.error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
      return;
    }
    setSelections(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAddManualItem = () => {
    if (!selectedSku || !manualQty) {
      toast.error('Please select an SKU and provide Quantity');
      return;
    }
    const qtyNum = parseInt(manualQty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error('Quantity must be greater than zero');
      return;
    }

    setManualItems(prev => [
      ...prev,
      {
        id: `manual_${Date.now()}`,
        itemId: selectedSku.id, // Store actual SKU ID
        itemName: selectedSku.name,
        quantity: qtyNum,
        remarks: manualRemarks,
        source: 'MANUAL',
        selectedForDCR: true
      }
    ]);
    
    setSelectedSku(null);
    setSkuSearch('');
    setManualQty('');
    setManualRemarks('');
  };

  const handleRemoveManualItem = (id: string) => {
    if (isItemAllocated(id)) {
      toast.error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
      return;
    }
    setManualItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = async (andNext: boolean = false) => {
    try {
      // Validate deselections and removals against allocated serials
      if (invoice && invoice.items) {
        for (const item of invoice.items) {
          if (item.source === 'ZOHO' && item.selectedForDCR && !selections[item.id]) {
            if (isItemAllocated(item.id)) {
              toast.error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
              return;
            }
          }
          if (item.source === 'MANUAL') {
            const isKept = manualItems.some(m => m.id === item.id);
            if (!isKept && isItemAllocated(item.id)) {
              toast.error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
              return;
            }
          }
        }
      }

      setSubmissionMode(andNext ? 'saveNext' : 'save');
      setSaving(true);

      const res = await fetch(`/api/admin/dcr/invoices/${invoiceId}/save?${currentParamsString}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ selections, manualItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('DCR allocation saved!');
      refreshStats();

      if (andNext) {
        // Fetch current queue using preserved filters
        const queueRes = await fetch(`/api/admin/dcr/invoices?${currentParamsString}`);
        const queueData = await queueRes.json();
        
        let nextInvoiceId = null;
        if (queueData.invoices && queueData.invoices.length > 0) {
          const nextInvoice = queueData.invoices.find((inv: any) => inv.id !== invoiceId && ['NEW', 'UNDER_REVIEW'].includes(inv.dcrStatus));
          if (nextInvoice) {
            nextInvoiceId = nextInvoice.id;
          }
        }

        if (nextInvoiceId) {
          router.replace(`/staff/dashboard/accounts/dcr/review/${nextInvoiceId}?${currentParamsString}`);
        } else {
          toast.success('No more invoices pending review');
          if (searchParams.get('source') === 'customer_lookup') {
            window.close();
          } else {
            router.push(`/staff/dashboard/accounts/dcr?${currentParamsString}`);
          }
        }
      } else {
        if (searchParams.get('source') === 'customer_lookup') {
          window.close();
        } else {
          router.push(`/staff/dashboard/accounts/dcr?${currentParamsString}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
      setSubmissionMode(null);
    }
  };

  const executeSkipInvoice = async () => {
    try {
      setSubmissionMode('skip');
      
      const queueRes = await fetch(`/api/admin/dcr/invoices?${currentParamsString}`);
      const queueData = await queueRes.json();
      
      let nextInvoiceId = null;
      if (queueData.invoices && queueData.invoices.length > 0) {
        const nextInvoice = queueData.invoices.find((inv: any) => inv.id !== invoiceId && ['NEW', 'UNDER_REVIEW'].includes(inv.dcrStatus));
        if (nextInvoice) {
          nextInvoiceId = nextInvoice.id;
        }
      }

      if (nextInvoiceId) {
        router.replace(`/staff/dashboard/accounts/dcr/review/${nextInvoiceId}?${currentParamsString}`);
      } else {
        toast.success('No more invoices in queue');
        if (searchParams.get('source') === 'customer_lookup') {
          window.close();
        } else {
          router.push(`/staff/dashboard/accounts/dcr?${currentParamsString}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to skip invoice');
    } finally {
      if (submissionMode === 'skip') {
        setSubmissionMode(null);
      }
    }
  };

  const executeSkipDcr = async () => {
    try {
      const hasAllocatedSerials = invoice && invoice.serialAllocations && invoice.serialAllocations.length > 0;
      if (hasAllocatedSerials) {
        toast.error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
        return;
      }

      setSubmissionMode('noDcr');
      setSaving(true);
      setShowSkipModal(false);

      const res = await fetch(`/api/admin/dcr/invoices/${invoiceId}/save?${currentParamsString}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipDcr: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Invoice marked as No DCR Required.');
      refreshStats();
      
      // Always automatically open next invoice if possible
      const queueRes = await fetch(`/api/admin/dcr/invoices?${currentParamsString}`);
      const queueData = await queueRes.json();
      
      let nextInvoiceId = null;
      if (queueData.invoices && queueData.invoices.length > 0) {
        const nextInvoice = queueData.invoices.find((inv: any) => inv.id !== invoiceId && ['NEW', 'UNDER_REVIEW'].includes(inv.dcrStatus));
        if (nextInvoice) {
          nextInvoiceId = nextInvoice.id;
        }
      }

      if (nextInvoiceId) {
        router.replace(`/staff/dashboard/accounts/dcr/review/${nextInvoiceId}?${currentParamsString}`);
      } else {
        toast.success('No more invoices pending review');
          if (searchParams.get('source') === 'customer_lookup') {
            window.close();
          } else {
            router.push(`/staff/dashboard/accounts/dcr?${currentParamsString}`);
          }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to skip DCR');
    } finally {
      setSaving(false);
      setSubmissionMode(null);
      setSkipConfirmed(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshFromZoho = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/admin/dcr/invoices/${invoiceId}/refresh`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.success) {
        toast.success('Invoice refreshed from Zoho Books');
        if (data.updatedCount > 0) {
          toast.success(`Updated ${data.updatedCount} line items from Zoho`);
        } else {
          const stillMissing = data.invoice?.items?.some((item: any) => item.source === 'ZOHO' && (item.rate === 0 || item.rate === null));
          if (stillMissing) {
            toast.error('Zoho invoice returned no pricing data', { duration: 5000 });
          }
        }
        setInvoice(data.invoice);
        if (data.invoice && data.invoice.items) {
          const newSelections: Record<string, boolean> = { ...selections };
          data.invoice.items.forEach((item: any) => {
            if (item.source === 'ZOHO') {
              newSelections[item.id] = item.selectedForDCR;
            }
          });
          setSelections(newSelections);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh invoice');
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'UNDER_REVIEW': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'DCR_IDENTIFIED': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'PENDING_SERIALS': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'NO_DCR_REQUIRED': return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'READY_TO_ISSUE': return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'ISSUED': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Pre-filter SKU Master based on business rules
  const eligibleSkus = skuMaster.filter(s => {
    return s.caseSize > 1 && s.isActive !== false;
  });

  const filteredSkus = eligibleSkus.filter(s => s.name.toLowerCase().includes(skuSearch.toLowerCase())).slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto pb-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
          <div className="w-32 h-6 rounded bg-gray-200 animate-pulse"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-32 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[500px] animate-pulse"></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[500px] animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return <div className="p-12 text-center text-red-500 text-sm">Invoice not found.</div>;
  }

  const zohoItems = invoice.items.filter((i: any) => i.source === 'ZOHO');
  const hasRecommendedItems = zohoItems.some((i: any) => isRecommendedForDcr(i.itemName));
  
  const selectedZohoItems = zohoItems.filter((i: any) => selections[i.id]);
  const totalSelectedCount = selectedZohoItems.length + manualItems.length;
  const totalSelectedQty = selectedZohoItems.reduce((acc: number, i: any) => acc + i.quantity, 0) + 
                           manualItems.reduce((acc: number, i: any) => acc + i.quantity, 0);

  const canSkip = totalSelectedCount === 0;

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-32">
      
      {/* Header Actions */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => {
            router.push(`/staff/dashboard/accounts/dcr?${currentParamsString}`);
          }}
          className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-lg font-bold text-gray-900">DCR Processing</h2>
      </div>

      {/* Header Summary Card (ERP Style) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800 text-sm">Invoice Summary</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshFromZoho}
              disabled={refreshing || submissionMode !== null}
              className="bg-[#1A2766]/10 text-[#1A2766] hover:bg-[#1A2766]/20 border border-[#1A2766]/20 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Refreshing...</span>
                </>
              ) : (
                'Fetch Latest Invoice Data'
              )}
            </button>
            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${getStatusColor(invoice.invoiceStatus)}`}>
              Invoice: {invoice.invoiceStatus}
            </span>
            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${getStatusColor(invoice.dcrStatus)}`}>
              DCR: {invoice.dcrStatus.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Invoice Number</span>
            <span className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Name</span>
            <span className="text-sm font-medium text-gray-900">{invoice.customerName}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Location</span>
            <span className="text-sm font-medium text-gray-900">{invoice.locationName || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Invoice Date</span>
            <span className="text-sm font-medium text-gray-900">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Invoice Total</span>
            <span className="text-sm font-bold text-[#1A2766]">₹{invoice.invoiceTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {!hasRecommendedItems && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-4">
          <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-bold text-orange-800">No Solar Panels Detected</h4>
            <p className="text-xs text-orange-700 mt-1">
              This invoice does not appear to contain any products matching DCR criteria. You may Mark No DCR Required or Add DCR SKU Manually.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Zoho Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[650px] lg:col-span-3">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
            <h3 className="font-semibold text-gray-800 text-sm">Select Products Requiring DCR</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Check items from the Zoho invoice that need DCR tracking.</p>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm table-fixed">
              <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider w-[60px] text-center">Select</th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider min-w-[300px]">Item</th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-right w-[80px]">Qty</th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-right w-[120px]">Unit Price</th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-right w-[120px]">Line Value</th>
                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-center w-[120px]">Suggested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zohoItems.map((item: any) => {
                  const isSelected = !!selections[item.id];
                  const isRecommended = isRecommendedForDcr(item.itemName);
                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors cursor-pointer border-l-4 ${
                        isRecommended 
                          ? 'border-l-green-500 bg-green-50/20 hover:bg-green-100/20' 
                          : isSelected 
                            ? 'border-l-transparent bg-blue-50/70 hover:bg-blue-100/70' 
                            : 'border-l-transparent hover:bg-gray-50'
                      }`} 
                      onClick={() => handleToggleSelection(item.id)}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 text-[#1A2766] rounded border-gray-300 focus:ring-[#1A2766] cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleToggleSelection(item.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-2.5 whitespace-normal break-normal break-words">
                        <div 
                          className={`text-xs ${isSelected ? 'font-bold text-[#1A2766]' : 'font-medium text-gray-900'} whitespace-normal break-normal break-words`}
                          style={{ lineHeight: 1.35 }}
                        >
                          {item.itemName}
                        </div>
                        {item.description && (
                          <div 
                            className="text-[11px] text-gray-500 mt-1 break-normal break-words whitespace-normal font-normal line-clamp-2"
                            style={{ lineHeight: 1.3 }}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs ${isSelected ? 'font-bold text-[#1A2766]' : 'font-medium text-gray-900'}`}>{item.quantity}</td>
                      <td className={`px-4 py-2.5 text-right text-xs text-gray-600 ${isSelected ? 'font-bold' : ''}`}>
                        ₹{(item.rate || 0).toLocaleString('en-IN')}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs text-gray-900 ${isSelected ? 'font-bold text-[#1A2766]' : 'font-medium'}`}>
                        ₹{(item.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isRecommended && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-[11px] font-bold border border-green-200 inline-flex items-center gap-1 whitespace-nowrap">
                            🟢 Recommended
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manual Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[650px] lg:col-span-1">
          <div className="px-3 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
            <h3 className="font-semibold text-gray-800 text-sm">Additional DCR Items</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Add supplementary items from SKU master.</p>
          </div>
          
          <div className="p-3 bg-white border-b border-gray-200 flex flex-col gap-2 shrink-0">
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Search SKU</label>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-2.5 text-gray-400" />
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-md pl-7 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
                  value={selectedSku ? selectedSku.name : skuSearch}
                  onChange={e => {
                    setSkuSearch(e.target.value);
                    setSelectedSku(null);
                    setShowSkuDropdown(true);
                  }}
                  onFocus={() => setShowSkuDropdown(true)}
                  placeholder="e.g. LONGI 585W..."
                />
              </div>
              {showSkuDropdown && skuSearch && !selectedSku && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredSkus.length > 0 ? filteredSkus.map(sku => (
                    <div 
                      key={sku.id} 
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 last:border-0"
                      onClick={() => {
                        setSelectedSku(sku);
                        setShowSkuDropdown(false);
                      }}
                    >
                      <div className="font-semibold text-blue-900 font-mono text-[10px]">{sku.id}</div>
                      <div className="font-medium text-gray-900 text-[11px] leading-snug">{sku.name}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">
                        Case Size: {sku.caseSize}
                      </div>
                    </div>
                  )) : (
                    <div className="px-3 py-4 text-center text-xs text-gray-500">No eligible DCR SKUs found</div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <div className="w-16 shrink-0">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Qty</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
                  value={manualQty}
                  onChange={e => setManualQty(e.target.value)}
                  placeholder="0"
                  min="1"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Remarks</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
                  value={manualRemarks}
                  onChange={e => setManualRemarks(e.target.value)}
                  placeholder="Note"
                />
              </div>
            </div>
            <button
              onClick={handleAddManualItem}
              className="bg-[#1A2766]/10 text-[#1A2766] hover:bg-[#1A2766]/20 border border-[#1A2766]/20 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 w-full mt-1"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50/30">
            {manualItems.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {manualItems.map(item => (
                  <div key={item.id} className="p-3 hover:bg-red-50/30 transition-colors flex items-start justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-blue-900 leading-snug break-words whitespace-normal">{item.itemName}</div>
                      <div className="text-gray-500 text-[10px] mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>Qty: <strong>{item.quantity}</strong></span>
                        {item.remarks && <span className="break-all">| Remarks: {item.remarks}</span>}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveManualItem(item.id)} 
                      className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center">
                <p className="text-sm font-medium text-gray-500">No additional DCR items added.</p>
                <p className="text-xs text-gray-400 mt-1">Use search above to append items from SKU Master.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex gap-8 items-center bg-gray-50 px-5 py-2.5 rounded-lg border border-gray-200">
            <div>
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Selected Products</span>
              <span className="text-lg font-bold text-gray-900">{totalSelectedCount}</span>
            </div>
            <div className="w-px h-8 bg-gray-300"></div>
            <div>
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Qty</span>
              <span className="text-lg font-bold text-[#1A2766]">{totalSelectedQty}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={executeSkipInvoice}
              disabled={submissionMode !== null}
              className="bg-amber-500 text-white px-6 py-3 rounded-lg font-bold shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >
              {submissionMode === 'skip' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Skipping...</span>
                </>
              ) : (
                <>
                  <span>Skip Invoice</span>
                  <ChevronRight size={18} className="-mr-1" />
                </>
              )}
            </button>
            <button
              onClick={() => {
                const hasAllocatedSerials = invoice && invoice.serialAllocations && invoice.serialAllocations.length > 0;
                if (hasAllocatedSerials) {
                  toast.error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
                  return;
                }
                setShowSkipModal(true);
              }}
              disabled={submissionMode !== null || !canSkip}
              className="bg-white border-2 border-red-500 text-red-600 px-6 py-3 rounded-lg font-bold shadow-sm hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >
              {submissionMode === 'noDcr' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                'Mark No DCR Required'
              )}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={submissionMode !== null || totalSelectedCount === 0}
              className="bg-[#1A2766] text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-[#1A2766]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >
              {submissionMode === 'save' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                'Save & Continue'
              )}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={submissionMode !== null || totalSelectedCount === 0}
              className="bg-[#1A2766] text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-[#1A2766]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >
              {submissionMode === 'saveNext' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving & Opening Next...</span>
                </>
              ) : (
                'Save & Next Invoice'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Skip Confirmation Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-red-50/50">
              <h3 className="font-bold text-red-800 text-lg flex items-center gap-2">
                <AlertCircle size={20} />
                Mark Invoice As No DCR Required?
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</span>
                  <div className="font-medium text-gray-900">{invoice.customerName}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Number</span>
                  <div className="font-medium text-gray-900">{invoice.invoiceNumber}</div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                This action removes the invoice from the active DCR workflow. <strong>This is a permanent operation.</strong>
              </p>
              
              <label className="flex items-start gap-3 p-3 bg-red-50/30 rounded-lg border border-red-100 cursor-pointer hover:bg-red-50/50 transition-colors">
                <input 
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-600"
                  checked={skipConfirmed}
                  onChange={e => setSkipConfirmed(e.target.checked)}
                />
                <span className="text-sm font-medium text-red-900">
                  I confirm this invoice does not require DCR processing
                </span>
              </label>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSkipModal(false);
                  setSkipConfirmed(false);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeSkipDcr}
                disabled={!skipConfirmed || saving}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}

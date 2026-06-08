'use client';

import { useState, useEffect } from 'react';
import {  useRouter , useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Trash2, HelpCircle, Save, Layers, ListFilter, AlertCircle, CheckCircle, FileText, ExternalLink, X } from 'lucide-react';
import SerialHistoryModal from '@/components/dcr/SerialHistoryModal';
import { useDcrStats } from '../../layout';

export default function AllocateSerialsClient({ invoiceId }: { invoiceId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshStats } = useDcrStats();
  
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveStep, setSaveStep] = useState<'validating' | 'saving' | null>(null);
  
  // Selected item for allocation
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  
  // Serial entries textarea
  const [serialInput, setSerialInput] = useState('');
  
  // Tab/Method selection
  const [entryMethod, setEntryMethod] = useState<'newline' | 'comma' | 'import'>('newline');

  // Serial History Modal
  const [historyModalSerial, setHistoryModalSerial] = useState<string | null>(null);

  // Validation Errors Modal
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Bulk Delete
  const [selectedSerialsToDelete, setSelectedSerialsToDelete] = useState<Set<string>>(new Set());
  
  // Pagination
  const [visibleCount, setVisibleCount] = useState<number>(100);

  // Auto-creation confirmation state
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    unknownSerials: string[];
    message: string;
    pendingSerials: string[];
    itemId: string;
  } | null>(null);

  // Duplicate Checker State
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicateSerials, setDuplicateSerials] = useState<string[]>([]);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [showCleanupSuccess, setShowCleanupSuccess] = useState(false);
  const [removedList, setRemovedList] = useState<string[]>([]);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId]);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/dcr/pending-serials/${invoiceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setInvoice(data.invoice);
      if (data.invoice?.items?.length > 0) {
        // Set first item as default selected
        setSelectedItemId(data.invoice.items[0].id);
      }
      refreshStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSerials = async () => {
    if (!selectedItemId) {
      toast.error('No item selected');
      return;
    }

    const item = invoice.items.find((i: any) => i.id === selectedItemId);
    if (!item) return;

    try {
      setSaving(prev => ({ ...prev, [selectedItemId]: true }));
      setSaveStep('validating');

      let serials: string[] = [];

      if (entryMethod === 'import') {
        // Regex parsing for Import from DCR Certificate
        // Strip out `(xxx Wp)` and line numbers like `1. `
        let cleaned = serialInput
          .replace(/\(\d+\s*Wp\)/gi, '')
          .replace(/\d+\.\s+/g, '');
        
        serials = cleaned
          .split(/[\s,]+/)
          .map(s => s.trim().toUpperCase())
          .filter(s => s.length > 0);
      } else {
        const splitRegex = entryMethod === 'newline' ? /\r?\n/ : /,/;
        serials = serialInput.split(splitRegex)
          .map(s => s.trim().toUpperCase())
          .filter(s => s.length > 0);
      }

      if (serials.length === 0) {
        toast.error('Please enter at least one valid serial number.');
        return;
      }

      // Validation 1: No duplicates in the batch
      const uniqueBatch = new Set(serials);
      if (uniqueBatch.size !== serials.length) {
        toast.error('Duplicate serial numbers found in your input list.');
        return;
      }

      // Validation 2: Cannot allocate more than required quantity
      const requiredQty = item.quantity;
      const currentlyAllocated = item.serialAllocations.length;
      const remainingQty = requiredQty - currentlyAllocated;

      if (serials.length > remainingQty) {
        toast.error(`Cannot allocate ${serials.length} serials. Only ${remainingQty} remaining slots for this item.`);
        return;
      }

      setSaveStep('saving');

      const res = await fetch(`/api/admin/dcr/pending-serials/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selectedItemId, serials, forceCreate: false })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          setValidationErrors(data.errors);
          return;
        }
        throw new Error(data.error);
      }

      // Handle confirmation gate for unknown serials
      if (data.requiresConfirmation) {
        setPendingConfirmation({
          unknownSerials: data.unknownSerials,
          message: data.message,
          pendingSerials: serials,
          itemId: selectedItemId,
        });
        return;
      }

      toast.success(`Successfully allocated ${serials.length} serials for Invoice ${invoice.invoiceNumber}. Remaining: ${remainingQty - serials.length}`);
      setSerialInput('');
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to allocate serial numbers');
    } finally {
      setSaving(prev => ({ ...prev, [selectedItemId]: false }));
      setSaveStep(null);
    }
  };

  useEffect(() => {
    if (!serialInput) {
      setDuplicateCount(0);
      setUniqueCount(0);
      setTotalLines(0);
      setDuplicateSerials([]);
      return;
    }

    let items: string[] = [];
    if (entryMethod === 'comma') {
      items = serialInput.split(',');
    } else {
      items = serialInput.split('\n');
    }

    let validLinesCount = 0;
    const seen = new Set<string>();
    const dupes = new Set<string>();

    items.forEach(item => {
      const normalized = item.trim().toUpperCase();
      if (normalized) {
        validLinesCount++;
        if (seen.has(normalized)) {
          dupes.add(normalized);
        } else {
          seen.add(normalized);
        }
      }
    });

    setTotalLines(validLinesCount);
    setUniqueCount(seen.size);
    setDuplicateCount(dupes.size);
    setDuplicateSerials(Array.from(dupes));

  }, [serialInput, entryMethod]);

  const handleRemoveDuplicates = () => {
    if (!serialInput) return;
    
    let items: string[] = [];
    let isComma = false;
    if (entryMethod === 'comma') {
      items = serialInput.split(',');
      isComma = true;
    } else {
      items = serialInput.split('\n');
    }

    const seen = new Set<string>();
    const newItems: string[] = [];
    const removed: string[] = [];

    items.forEach(item => {
      const normalized = item.trim().toUpperCase();
      if (!normalized) return; // ignore blank lines

      if (!seen.has(normalized)) {
        seen.add(normalized);
        newItems.push(normalized);
      } else {
        if (!removed.includes(normalized)) {
          removed.push(normalized);
        }
      }
    });

    setSerialInput(newItems.join(isComma ? ', ' : '\n'));
    setRemovedList(removed);
    setShowCleanupSuccess(true);
  };

  const handleSkipInvoice = async () => {
    try {
      setSaveStep('validating'); // reuse for UI blocking
      
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has('view')) params.set('view', 'active');
      if (!params.has('limit')) params.set('limit', '25');
      if (!params.has('page')) params.set('page', '1');
      if (!params.has('sort')) params.set('sort', 'newest');
      if (!params.has('chip')) params.set('chip', 'all');
      
      const currentParamsString = params.toString();
      const queueRes = await fetch(`/api/admin/dcr/pending-serials?${currentParamsString}`);
      const queueData = await queueRes.json();
      
      const validInvoices = (queueData.invoices || []);
      const currentIndex = validInvoices.findIndex((inv: any) => inv.id === invoiceId || inv.zohoInvoiceId === invoiceId);
      
      if (currentIndex !== -1 && currentIndex < validInvoices.length - 1) {
        const nextInv = validInvoices[currentIndex + 1];
        router.push(`/staff/dashboard/accounts/dcr/pending-serials/${nextInv.id}?${currentParamsString}`);
      } else {
        toast.success('No more invoices in queue. Returning to dashboard.');
        router.push('/staff/dashboard/accounts/dcr/pending-serials');
      }
    } catch (err) {
      toast.error('Failed to skip invoice');
      setSaveStep(null);
    }
  };

  const handleConfirmAutoCreate = async () => {
    if (!pendingConfirmation) return;
    try {
      setSaving(prev => ({ ...prev, [pendingConfirmation.itemId]: true }));
      setSaveStep('saving');
      const res = await fetch(`/api/admin/dcr/pending-serials/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: pendingConfirmation.itemId,
          serials: pendingConfirmation.pendingSerials,
          forceCreate: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Allocated ${pendingConfirmation.pendingSerials.length} serials. ${pendingConfirmation.unknownSerials.length} were auto-created.`);
      setSerialInput('');
      setPendingConfirmation(null);
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to allocate serial numbers');
    } finally {
      if (pendingConfirmation) setSaving(prev => ({ ...prev, [pendingConfirmation.itemId]: false }));
      setSaveStep(null);
    }
  };

  const handleDeleteSerial = async (serialId: string) => {
    if (!confirm('Are you sure you want to delete this serial number allocation?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/dcr/pending-serials/${invoiceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Serial allocation removed.');
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete serial number');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSerialsToDelete.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedSerialsToDelete.size} serial number allocations?`)) {
      return;
    }

    try {
      setSaveStep('saving');
      const res = await fetch(`/api/admin/dcr/pending-serials/${invoiceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialIds: Array.from(selectedSerialsToDelete) })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`${selectedSerialsToDelete.size} allocations removed.`);
      setSelectedSerialsToDelete(new Set());
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete serial numbers');
    } finally {
      setSaveStep(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_SERIALS': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'READY_FOR_DCR': return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'READY_TO_ISSUE': return 'bg-teal-50 text-teal-600 border-teal-200';
      case 'ISSUED': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto pb-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
          <div className="w-32 h-6 rounded bg-gray-200 animate-pulse"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-32 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 h-[500px] animate-pulse"></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[500px] animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return <div className="p-12 text-center text-red-500 text-sm">Invoice not found.</div>;
  }

  const selectedItem = invoice.items.find((i: any) => i.id === selectedItemId);

  // Calculate totals
  let totalRequired = 0;
  let totalAllocated = 0;
  invoice.items.forEach((item: any) => {
    totalRequired += item.quantity;
    totalAllocated += item.serialAllocations.length;
  });
  const totalBalance = Math.max(0, totalRequired - totalAllocated);
  const isSavingAny = Object.values(saving).some(Boolean) || saveStep !== null;

  const ZOHO_ORG_ID = process.env.NEXT_PUBLIC_ZOHO_ORG_ID || '';
  const invoiceLink = invoice.zohoInvoiceId 
    ? `https://books.zoho.in/app${ZOHO_ORG_ID ? '/' + ZOHO_ORG_ID : ''}#/invoices/${invoice.zohoInvoiceId}` 
    : null;
  const customerLink = invoice.customerId 
    ? `https://books.zoho.in/app${ZOHO_ORG_ID ? '/' + ZOHO_ORG_ID : ''}#/contacts/${invoice.customerId}` 
    : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in duration-300">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/staff/dashboard/accounts/dcr/pending-serials')}
            disabled={isSavingAny}
            className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-gray-900">Serial Allocation Queue</h2>
        </div>
      </div>

      {/* Compact Invoice Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice Number</span>
            {invoiceLink ? (
              <a 
                href={invoiceLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
              >
                {invoice.invoiceNumber}
                <ExternalLink size={12} className="shrink-0" />
              </a>
            ) : (
              <span className="text-sm font-bold text-gray-900">{invoice.invoiceNumber}</span>
            )}
          </div>
          <div className="w-px bg-gray-200 h-6"></div>
          <div>
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer Name</span>
            {customerLink ? (
              <a 
                href={customerLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
              >
                {invoice.customerName}
                <ExternalLink size={12} className="shrink-0" />
              </a>
            ) : (
              <span className="text-sm font-medium text-gray-900">{invoice.customerName}</span>
            )}
          </div>
          <div className="w-px bg-gray-200 h-6"></div>
          <div>
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</span>
            <span className="text-sm font-medium text-gray-900">{invoice.locationName || invoice.location || 'Location Not Available'}</span>
          </div>
          <div className="w-px bg-gray-200 h-6"></div>
          <div>
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice Date</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="w-px bg-gray-200 h-6"></div>
          <div>
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice Total</span>
            <span className="text-sm font-bold text-[#1A2766]">₹{invoice.invoiceTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="flex items-center">
          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${getStatusColor(invoice.dcrStatus)}`}>
            {invoice.dcrStatus.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Main Grid: DCR Item Grid & Serial Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: DCR Item Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">DCR Items Grid</h3>
              <span className="text-xs text-gray-500">
                Allocated: <strong className="text-[#1A2766]">{totalAllocated}</strong> / {totalRequired} (Remaining: <strong className="text-orange-600">{totalBalance}</strong>)
              </span>
            </div>
            
            <div className="divide-y divide-gray-100">
              {invoice.items.map((item: any) => {
                const required = item.quantity;
                const allocated = item.serialAllocations.length;
                const remaining = Math.max(0, required - allocated);
                const isSelected = item.id === selectedItemId;
                const isCompleted = remaining === 0;

                return (
                  <div 
                    key={item.id} 
                    onClick={() => !isSavingAny && setSelectedItemId(item.id)}
                    className={`px-5 py-3 transition-all flex items-center justify-between gap-4 hover:bg-gray-50/50 ${
                      isSavingAny 
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'cursor-pointer'
                    } ${
                      isSelected ? 'bg-blue-50/40 border-l-4 border-l-[#1A2766]' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex-grow min-w-0 flex items-center gap-4">
                      <div className="space-y-1 w-full">
                        <div className="font-bold text-sm text-gray-900 flex items-center gap-2 flex-wrap">
                          <span>{item.itemName}</span>
                          {isCompleted && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[9px] font-bold border border-teal-200 uppercase shrink-0">
                              Completed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          {item.sku && <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">SKU: {item.sku}</span>}
                          {item.remarks && <span className="italic truncate" title={item.remarks}>Note: {item.remarks}</span>}
                        </div>
                        {(() => {
                          const descText = (item.description || item.itemDescription || item.zohoLineItem?.description || '').trim();
                          if (!descText) return null;
                          return (
                            <div className="mt-1.5 text-[11px] text-gray-500 whitespace-pre-wrap break-words leading-normal font-normal">
                              <span className="font-semibold text-[10px] uppercase tracking-wider block text-gray-400 mb-0.5">Description:</span>
                              {descText}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex gap-4 shrink-0 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm items-center text-xs">
                      <div className="flex flex-col items-center min-w-[36px]">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Req</span>
                        <span className="font-semibold text-gray-700">{required}</span>
                      </div>
                      <div className="w-px bg-gray-200 h-6"></div>
                      <div className="flex flex-col items-center min-w-[36px]">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Alloc</span>
                        <span className="font-semibold text-teal-600">{allocated}</span>
                      </div>
                      <div className="w-px bg-gray-200 h-6"></div>
                      <div className="flex flex-col items-center min-w-[36px]">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Rem</span>
                        <span className={`font-bold ${remaining > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {remaining}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Allocation Entry Box */}
          {selectedItem && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Allocate Serials</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    For: <strong className="text-gray-800">{selectedItem.itemName}</strong>
                  </p>
                </div>
                <div className="flex bg-gray-200/80 p-0.5 rounded-lg border border-gray-300">
                  <button
                    onClick={() => !isSavingAny && setEntryMethod('newline')}
                    disabled={isSavingAny}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      entryMethod === 'newline' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Paste (Lines)
                  </button>
                  <button
                    onClick={() => !isSavingAny && setEntryMethod('comma')}
                    disabled={isSavingAny}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      entryMethod === 'comma' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Comma Separated
                  </button>
                  <button
                    onClick={() => !isSavingAny && setEntryMethod('import')}
                    disabled={isSavingAny}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                      entryMethod === 'import' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FileText size={12} />
                    Import from Certificate
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {selectedItem.quantity - selectedItem.serialAllocations.length === 0 ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="text-teal-600 shrink-0" size={18} />
                    <span className="text-xs font-semibold text-teal-800">
                      All required serials are allocated for this item. Select another item if needed.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                        {entryMethod === 'newline' ? 'Paste Serials (One per line)' : 
                         entryMethod === 'comma' ? 'Enter Comma-separated Serials' : 
                         'Paste DCR Certificate Text'}
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-50 disabled:cursor-not-allowed"
                        rows={6}
                        placeholder={
                          entryMethod === 'newline' ? 'ABC123\nABC124\nABC125' : 
                          entryMethod === 'comma' ? 'ABC123,ABC124,ABC125' : 
                          '1. ABC12345 (620 Wp)\n2. XYZ98765 (620 Wp)'
                        }
                        value={serialInput}
                        onChange={e => setSerialInput(e.target.value)}
                        disabled={isSavingAny}
                      />
                      <p className="text-[11px] text-gray-400">
                        {entryMethod === 'import' ? 
                          'System will automatically extract serial numbers and ignore text like "(620 Wp)" or line numbers.' :
                          'System will automatically convert serials to uppercase and trim spaces. Duplicate check is enforced.'}
                      </p>

                      {/* Live Counters */}
                      <div className="flex gap-4 text-[10px] text-gray-500 font-medium pt-1">
                        <span>Lines Entered: {totalLines}</span>
                        <span>Unique: {uniqueCount}</span>
                        <span>Duplicates: {duplicateCount}</span>
                      </div>

                      {duplicateCount > 0 && (
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                          <div className="flex items-center gap-2 text-amber-700 font-medium text-xs">
                            <AlertCircle size={14} />
                            ⚠ {duplicateCount} duplicate serials detected
                          </div>
                          <button
                            onClick={handleRemoveDuplicates}
                            disabled={isSavingAny}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50"
                          >
                            Remove Duplicates
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                      <button
                        onClick={handleSkipInvoice}
                        disabled={isSavingAny}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Skip Invoice
                      </button>
                      <button
                        onClick={handleSaveSerials}
                        disabled={isSavingAny || !serialInput.trim()}
                        className="bg-[#1A2766] hover:bg-[#1A2766]/90 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <Save size={14} />
                        {saveStep === 'validating' ? 'Validating Serials...' : 
                         saveStep === 'saving' ? 'Saving Allocation...' : 
                         'Save Serials'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Allocated Serials List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[650px]">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="text-[#1A2766]" size={16} />
                <h3 className="font-bold text-gray-800 text-sm">Allocated Serials</h3>
              </div>
              <div className="text-[10px] font-bold bg-[#1A2766]/10 text-[#1A2766] px-2 py-1 rounded border border-[#1A2766]/20 flex gap-2">
                <span>Req: {totalRequired}</span>
                <span className="text-teal-700 border-l border-[#1A2766]/20 pl-2">Alloc: {totalAllocated}</span>
                <span className="text-orange-600 border-l border-[#1A2766]/20 pl-2">Rem: {totalBalance}</span>
              </div>
            </div>
            {selectedSerialsToDelete.size > 0 && invoice.dcrStatus !== 'ISSUED' && (
              <div className="flex justify-between items-center bg-red-50 px-3 py-1.5 rounded border border-red-200 animate-in fade-in zoom-in duration-200">
                <span className="text-xs font-bold text-red-800">{selectedSerialsToDelete.size} selected</span>
                <button 
                  onClick={handleBulkDelete}
                  disabled={isSavingAny}
                  className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-3 py-1 rounded font-bold shadow-sm flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Bulk Delete
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-grow overflow-y-auto p-5 pb-10">
            {invoice.items.every((i: any) => i.serialAllocations.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                <AlertCircle size={24} className="mb-2 text-gray-300" />
                <span className="text-xs font-semibold">No serial numbers allocated yet.</span>
              </div>
            ) : (
              <div className="space-y-5">
                {invoice.items.map((item: any) => {
                  if (item.serialAllocations.length === 0) return null;
                  return (
                    <div key={item.id} className="space-y-2">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-1 shrink-0">
                        <span className="text-xs font-bold text-gray-800 truncate max-w-[70%]">{item.itemName}</span>
                        <div className="flex gap-2 items-center">
                          {invoice.dcrStatus !== 'ISSUED' && (
                            <button 
                              onClick={() => {
                                const allItemSerialIds = item.serialAllocations.map((a:any)=>a.id);
                                const allSelected = allItemSerialIds.every((id:string) => selectedSerialsToDelete.has(id));
                                setSelectedSerialsToDelete(prev => {
                                  const next = new Set(prev);
                                  if (allSelected) {
                                    allItemSerialIds.forEach((id:string) => next.delete(id));
                                  } else {
                                    allItemSerialIds.forEach((id:string) => next.add(id));
                                  }
                                  return next;
                                });
                              }}
                              className="text-[10px] font-semibold text-gray-500 hover:text-gray-800 px-1 py-0.5 rounded bg-gray-100"
                            >
                              Select All
                            </button>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 border rounded text-gray-600">
                            {item.serialAllocations.length} items
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 pr-1">
                        {item.serialAllocations.slice(0, visibleCount).map((alloc: any, idx: number) => {
                          const isChecked = selectedSerialsToDelete.has(alloc.id);
                          return (
                            <div 
                              key={alloc.id} 
                              className={`flex justify-between items-center border px-3 py-1.5 rounded-lg text-xs hover:bg-gray-100 group transition-all ${
                                isChecked ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {invoice.dcrStatus !== 'ISSUED' && (
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setSelectedSerialsToDelete(prev => {
                                        const next = new Set(prev);
                                        if (e.target.checked) next.add(alloc.id);
                                        else next.delete(alloc.id);
                                        return next;
                                      });
                                    }}
                                    disabled={isSavingAny}
                                    className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                                  />
                                )}
                                <span className="text-[10px] text-gray-400 font-bold w-5 shrink-0">#{idx + 1}</span>
                                <button 
                                  onClick={() => setHistoryModalSerial(alloc.serialNumber)}
                                  className="font-mono font-bold text-[#1A2766] hover:underline"
                                >
                                  {alloc.serialNumber}
                                </button>
                              </div>
                              {invoice.dcrStatus !== 'ISSUED' && (
                                <button
                                  onClick={() => !isSavingAny && handleDeleteSerial(alloc.id)}
                                  disabled={isSavingAny}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                                  title="Delete Allocation"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {item.serialAllocations.length > visibleCount && (
                          <div className="text-center py-2">
                            <button 
                              onClick={() => setVisibleCount(prev => prev + 100)}
                              className="text-xs font-semibold text-[#1A2766] hover:underline"
                            >
                              Load More ({item.serialAllocations.length - visibleCount} remaining)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-creation Confirmation Panel */}
      {pendingConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-amber-900">Unknown Serial Numbers Detected</h3>
                <p className="text-xs text-amber-700">These serials are not in the system. Purchase receipt was not recorded.</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                  {pendingConfirmation.unknownSerials.length} Unknown Serial{pendingConfirmation.unknownSerials.length > 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {pendingConfirmation.unknownSerials.map(s => (
                    <span key={s} className="px-2 py-1 bg-amber-100 text-amber-800 rounded font-mono text-xs border border-amber-200">{s}</span>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">What will happen if you confirm:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
                  <li>All unknown serials will be auto-created with <strong>Source = SALES_AUTO_CREATED</strong></li>
                  <li>Vendor Name will be set to <strong>&ldquo;NA&rdquo;</strong></li>
                  <li>Vendor DCR Status will be <strong>NOT_RECEIVED</strong></li>
                  <li>Invoice status will transition to <strong>VENDOR_DCR_PENDING</strong></li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                onClick={() => setPendingConfirmation(null)}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAutoCreate}
                className="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 flex items-center gap-2"
              >
                <CheckCircle size={15} />
                Confirm & Create Serials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors Modal */}
      {validationErrors.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-red-50 border-b border-red-200 flex items-center gap-3 shrink-0">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-red-900">Validation Errors Detected</h3>
                <p className="text-xs text-red-700">Please correct the following issues before saving.</p>
              </div>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-50 space-y-2">
              {validationErrors.map((err, i) => (
                <div key={i} className="bg-white border border-red-200 rounded-lg p-3 text-sm text-red-800 shadow-sm flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 font-bold">•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-white border-t flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setValidationErrors([])}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Close & Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Cleanup Success Modal */}
      {showCleanupSuccess && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-green-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Duplicate Serials Removed</h3>
              <button 
                onClick={() => setShowCleanupSuccess(false)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-3">The following duplicates were removed:</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-[40vh] overflow-y-auto font-mono text-xs text-gray-700 whitespace-pre-wrap">
                {removedList.join('\n')}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">Removed: {removedList.length} duplicate serials</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(removedList.join('\n'));
                    toast.success('Copied to clipboard');
                  }}
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition-colors"
                >
                  Copy Removed List
                </button>
                <button
                  onClick={() => setShowCleanupSuccess(false)}
                  className="bg-gray-800 text-white hover:bg-gray-700 px-5 py-2 rounded-md text-sm font-semibold shadow-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SerialHistoryModal 
        serialNumber={historyModalSerial || ''} 
        isOpen={!!historyModalSerial} 
        onClose={() => setHistoryModalSerial(null)} 
      />

    </div>
  );
}

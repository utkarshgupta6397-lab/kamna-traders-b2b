'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Trash2, HelpCircle, Save, Layers, ListFilter, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import SerialHistoryModal from '@/components/dcr/SerialHistoryModal';
import { useDcrStats } from '../../layout';

export default function AllocateSerialsClient({ invoiceId }: { invoiceId: string }) {
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

  // Auto-creation confirmation state
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    unknownSerials: string[];
    message: string;
    pendingSerials: string[];
    itemId: string;
  } | null>(null);

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
      if (!res.ok) throw new Error(data.error);

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

      toast.success(`Successfully allocated ${serials.length} serials!`);
      setSerialInput('');
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to allocate serial numbers');
    } finally {
      setSaving(prev => ({ ...prev, [selectedItemId]: false }));
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

      {/* Top Invoice Summary Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800 text-sm">Invoice Details</h3>
          <div className="flex gap-2">
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${getStatusColor(invoice.dcrStatus)}`}>
              {invoice.dcrStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Invoice Number</span>
            <span className="text-sm font-semibold text-gray-900">{invoice.invoiceNumber}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Name</span>
            <span className="text-sm font-medium text-gray-900">{invoice.customerName}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Invoice Date</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Invoice Total</span>
            <span className="text-sm font-bold text-[#1A2766]">₹{invoice.invoiceTotal.toLocaleString('en-IN')}</span>
          </div>
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
                    className={`p-5 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50/50 ${
                      isSavingAny 
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'cursor-pointer'
                    } ${
                      isSelected ? 'bg-blue-50/40 border-l-4 border-l-[#1A2766]' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                        {item.itemName}
                        {isCompleted && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[9px] font-bold border border-teal-200 uppercase">
                            Fully Allocated
                          </span>
                        )}
                      </div>
                      {item.sku && <div className="text-xs font-mono text-gray-400">SKU: {item.sku}</div>}
                      {item.remarks && <div className="text-xs text-gray-500 italic mt-1">Note: {item.remarks}</div>}
                    </div>

                    <div className="flex gap-6 shrink-0 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Required</span>
                        <span className="text-sm font-semibold text-gray-700">{required}</span>
                      </div>
                      <div className="w-px bg-gray-200 h-8 self-center"></div>
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Allocated</span>
                        <span className="text-sm font-semibold text-teal-600">{allocated}</span>
                      </div>
                      <div className="w-px bg-gray-200 h-8 self-center"></div>
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Remaining</span>
                        <span className={`text-sm font-bold ${remaining > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
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
                    </div>

                    <div className="flex justify-end pt-1">
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
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2 shrink-0">
            <Layers className="text-[#1A2766]" size={16} />
            <h3 className="font-bold text-gray-800 text-sm">Allocated Serials</h3>
          </div>
          
          <div className="flex-grow overflow-y-auto p-5">
            {invoice.items.every((i: any) => i.serialAllocations.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                <AlertCircle size={24} className="mb-2 text-gray-300" />
                <span className="text-xs font-semibold">No serial numbers allocated yet.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {invoice.items.map((item: any) => {
                  if (item.serialAllocations.length === 0) return null;
                  return (
                    <div key={item.id} className="space-y-2">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-1 shrink-0">
                        <span className="text-xs font-bold text-gray-800 truncate max-w-[70%]">{item.itemName}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 border rounded text-gray-600">
                          {item.serialAllocations.length} items
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {item.serialAllocations.map((alloc: any) => (
                          <div 
                            key={alloc.id} 
                            className="flex justify-between items-center bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-100 group transition-all"
                          >
                            <button 
                              onClick={() => setHistoryModalSerial(alloc.serialNumber)}
                              className="font-mono font-bold text-[#1A2766] hover:underline"
                            >
                              {alloc.serialNumber}
                            </button>
                            <button
                              onClick={() => !isSavingAny && handleDeleteSerial(alloc.id)}
                              disabled={isSavingAny}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete Allocation"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
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

      <SerialHistoryModal 
        serialNumber={historyModalSerial || ''} 
        isOpen={!!historyModalSerial} 
        onClose={() => setHistoryModalSerial(null)} 
      />

    </div>
  );
}

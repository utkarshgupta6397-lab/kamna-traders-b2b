'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, CheckCircle, AlertTriangle, Zap, ChevronDown, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDcrStats } from '../layout';

function PurchaseDcrReceivedContent() {
  const { refreshStats } = useDcrStats();
  const searchParams = useSearchParams();
  const receiptId = searchParams?.get('receiptId');
  const [mode, setMode] = useState<'normal' | 'quick' | 'prefilled'>('normal');
  
  // Normal / Quick mode state
  const [skuId, setSkuId] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  
  // Prefilled mode state
  const [vendorName, setVendorName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [prefilledLines, setPrefilledLines] = useState<{skuId: string, skuName: string, rawText: string}[]>([]);
  const [isFullyProcessed, setIsFullyProcessed] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skus, setSkus] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/staff/skus')
      .then(r => r.json())
      .then(data => {
        const filtered = (data.skus || data || []).filter((s: any) => s.caseSize > 1 && s.isActive !== false);
        setSkus(filtered);
      })
      .catch(() => setSkus([]));
  }, []);

  useEffect(() => {
    if (!receiptId) return;

    const fetchReceipt = async () => {
      try {
        const res = await fetch(`/api/admin/dcr/purchase-receive/details?id=${encodeURIComponent(receiptId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch receipt details');

        setMode('prefilled');
        setVendorName(data.vendorName);
        setBillNumber(data.billNumber);
        
        if (!data.lines || data.lines.length === 0) {
          setIsFullyProcessed(true);
          toast('All serials in this receipt are already processed.', { icon: '✅' });
        } else {
          setIsFullyProcessed(false);
          const lines = data.lines.map((l: any) => ({
            skuId: l.skuId,
            skuName: l.skuName,
            rawText: l.eligibleSerials.join('\n')
          }));
          setPrefilledLines(lines);
          
          const totalEligible = data.lines.reduce((acc: number, l: any) => acc + l.eligibleSerials.length, 0);
          toast.success(`Purchase receipt loaded successfully.\n${totalEligible} eligible serial numbers ready for DCR processing.`, { duration: 5000 });
        }
      } catch (err: any) {
        toast.error(err.message);
      }
    };
    fetchReceipt();
  }, [receiptId]);

  const filteredSkus = skus.filter(s => s.name.toLowerCase().includes(skuSearch.toLowerCase())).slice(0, 20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let serials: string[] = [];

    if (mode === 'prefilled') {
      serials = prefilledLines.flatMap(l => l.rawText.split(/[\s,\n]+/).filter(Boolean));
      if (serials.length === 0) { toast.error('Please enter serial numbers'); return; }
    } else {
      if (!rawText.trim()) { toast.error('Please enter serial numbers or certificate text'); return; }
      if (mode === 'quick' && !skuId) { toast.error('Please select an item for Quick Entry mode'); return; }
      serials = rawText.split(/[\s,\n]+/).filter(Boolean);
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/dcr/purchase-dcr-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serials, skuId: mode === 'quick' ? skuId : undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast((t) => (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-red-800">DCR Already Received</span>
              <span className="text-sm text-red-700">Vendor DCR has already been received for these serials. Duplicate receipt is not allowed.</span>
            </div>
          ), { duration: 6000, style: { background: '#FEF2F2', border: '1px solid #FCA5A5' } });
        } else {
          throw new Error(data.error || (data.details?.join(', ')) || 'Failed');
        }
        return;
      }

      if (data.warnings?.length) {
        toast((t) => (
          <div className="flex flex-col gap-1">
            <span className="font-bold text-amber-800">Some Serials Already Processed</span>
            <span className="text-sm text-amber-700">{data.warnings.length} serial(s) were skipped because Vendor DCR has already been marked as received.</span>
          </div>
        ), { duration: 6000, style: { background: '#FEF3C7', border: '1px solid #FCD34D' } });
      } else {
        toast.success('Vendor DCR certificates imported successfully.');
      }
      
      if (mode === 'prefilled') {
        setIsFullyProcessed(true);
        setPrefilledLines([]);
      } else {
        setRawText('');
        if (mode === 'quick') { setSkuId(''); setSkuSearch(''); }
      }
      refreshStats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePrefilledLine = (index: number, newText: string) => {
    const updated = [...prefilledLines];
    updated[index].rawText = newText;
    setPrefilledLines(updated);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase DCR Received</h1>
          <p className="text-sm text-gray-500 mt-1">Import Vendor DCR certificates to mark serial numbers as DCR-compliant.</p>
        </div>

        {/* Mode Toggle (Hidden in Prefilled Mode) */}
        {mode !== 'prefilled' && (
          <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl border border-gray-200/60">
            <button
              type="button"
              onClick={() => setMode('normal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === 'normal' ? 'bg-white text-[#1A2766] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" /> Normal Mode
            </button>
            <button
              type="button"
              onClick={() => setMode('quick')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === 'quick' ? 'bg-white text-amber-600 shadow-sm border border-amber-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Zap className="w-4 h-4" /> Quick Entry
            </button>
          </div>
        )}

        {/* Mode info */}
        {mode === 'prefilled' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <Package className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-emerald-800">
              <p className="font-semibold mb-0.5">Prefilled Receipt Data</p>
              <p className="text-emerald-700/80">
                You are importing DCRs for an existing purchase receipt. The pending serials have been automatically loaded.
              </p>
            </div>
          </div>
        ) : mode === 'normal' ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-0.5">Smart Certificate Extraction</p>
              <p className="text-blue-700/80">Paste raw PDF text directly. The system extracts valid serial numbers and strips wattage info like "(620 Wp)". No SKU selection needed — the SKU is looked up from the existing serial record.</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Zap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-0.5">Quick Entry Mode — DCR Before Purchase Receive</p>
              <p className="text-amber-700/80">Use this when the DCR certificate arrives before physical panels are entered into the system. A SKU is required to lock the serial upon creation.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode === 'quick' ? <Zap className="w-4 h-4 text-amber-500" /> : mode === 'prefilled' ? <Package className="w-4 h-4 text-emerald-500" /> : <FileText className="w-4 h-4 text-gray-500" />}
              <h2 className="font-semibold text-gray-800 text-sm">
                {mode === 'prefilled' ? 'Purchase Receipt DCR' : mode === 'normal' ? 'Import DCR Certificate' : 'Quick Entry — DCR Before Purchase'}
              </h2>
            </div>
            {mode === 'prefilled' && (
              <button 
                type="button" 
                onClick={() => { setMode('normal'); window.history.replaceState(null, '', '/staff/dashboard/accounts/dcr/purchase-dcr-received'); }} 
                className="text-xs font-medium text-gray-500 hover:text-gray-800 underline"
              >
                Clear Receipt
              </button>
            )}
          </div>

          <div className="p-5 space-y-5">
            
            {mode === 'prefilled' && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Vendor</label>
                  <p className="text-sm font-medium text-gray-900">{vendorName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Bill / Invoice No.</label>
                  <p className="text-sm font-medium text-gray-900">{billNumber || 'N/A'}</p>
                </div>
              </div>
            )}

            {mode === 'prefilled' ? (
              isFullyProcessed ? (
                <div className="py-8 text-center bg-gray-50 rounded-xl border border-gray-200">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">All serial numbers in this purchase receipt have already been processed.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {prefilledLines.map((line, index) => (
                    <div key={line.skuId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-gray-800">{line.skuName}</label>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          {line.rawText.split(/[\s,\n]+/).filter(Boolean).length} pending
                        </span>
                      </div>
                      <textarea
                        value={line.rawText}
                        onChange={e => updatePrefilledLine(index, e.target.value)}
                        placeholder="Paste serial numbers here..."
                        rows={6}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] bg-gray-50/50 font-mono text-sm resize-y transition-colors"
                      />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                {/* SKU (Quick Entry only) */}
                {mode === 'quick' && (
                  <div className="relative">
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Item (SKU) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        value={skuDropdownOpen ? skuSearch : (skus.find(s => s.id === skuId)?.name || skuSearch)}
                        onFocus={() => { setSkuDropdownOpen(true); setSkuSearch(''); }}
                        onChange={e => setSkuSearch(e.target.value)}
                        placeholder="Search and select SKU..."
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm pr-8 transition-colors"
                      />
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {skuDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                        {filteredSkus.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                        ) : filteredSkus.map(sku => (
                          <button
                            key={sku.id}
                            type="button"
                            onClick={() => { setSkuId(sku.id); setSkuSearch(sku.name); setSkuDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <span className="font-medium text-gray-900">{sku.name}</span>
                            <span className="ml-2 text-xs text-gray-400">Case: {sku.caseSize}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Serials textarea */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    {mode === 'normal' ? 'Certificate Text / Serial Numbers' : 'Serial Numbers'}
                    <span className="text-red-500"> *</span>
                  </label>
                  <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder={mode === 'normal'
                      ? 'Paste raw DCR certificate text here (e.g. AS260503093389 (620 Wp) AS260503093396 (620 Wp) ...'
                      : 'Paste serial numbers here...'
                    }
                    rows={10}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] bg-gray-50/50 font-mono text-sm resize-none transition-colors"
                  />
                </div>
              </>
            )}
          </div>

          <div className="px-5 py-4 bg-gray-50 border-t flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || (mode === 'prefilled' && isFullyProcessed)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 text-sm"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Import Certificates
            </button>
          </div>
        </form>
      </div>

      {skuDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSkuDropdownOpen(false)} />
      )}
    </div>
  );
}

export default function PurchaseDcrReceivedPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center text-gray-500">Loading...</div>}>
      <PurchaseDcrReceivedContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertTriangle, Zap, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PurchaseDcrReceivedPage() {
  const [mode, setMode] = useState<'normal' | 'quick'>('normal');
  const [skuId, setSkuId] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const [rawText, setRawText] = useState('');
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

  const filteredSkus = skus.filter(s => s.name.toLowerCase().includes(skuSearch.toLowerCase())).slice(0, 20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) { toast.error('Please enter serial numbers or certificate text'); return; }
    if (mode === 'quick' && !skuId) { toast.error('Please select an item for Quick Entry mode'); return; }

    const serials = rawText.split(/[\s,\n]+/).filter(Boolean);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/dcr/purchase-dcr-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serials, skuId: mode === 'quick' ? skuId : undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.details?.join(', ')) || 'Failed');

      if (data.warnings?.length) {
        toast.success(`Processed with ${data.warnings.length} warnings.`);
      } else {
        toast.success('Vendor DCR certificates imported successfully.');
      }
      setRawText('');
      if (mode === 'quick') { setSkuId(''); setSkuSearch(''); }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase DCR Received</h1>
          <p className="text-sm text-gray-500 mt-1">Import Vendor DCR certificates to mark serial numbers as DCR-compliant.</p>
        </div>

        {/* Mode Toggle */}
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

        {/* Mode info */}
        {mode === 'normal' ? (
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
          <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
            {mode === 'quick' ? <Zap className="w-4 h-4 text-amber-500" /> : <FileText className="w-4 h-4 text-gray-500" />}
            <h2 className="font-semibold text-gray-800 text-sm">
              {mode === 'normal' ? 'Import DCR Certificate' : 'Quick Entry — DCR Before Purchase'}
            </h2>
          </div>

          <div className="p-5 space-y-5">
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
          </div>

          <div className="px-5 py-4 bg-gray-50 border-t flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
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

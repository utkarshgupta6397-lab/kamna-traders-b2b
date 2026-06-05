'use client';

import { useState, useEffect, useRef } from 'react';
import { PackageOpen, Plus, Trash2, CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface LineItem {
  id: string;
  skuId: string;
  rawText: string;
}

export default function PurchaseReceivePage() {
  const [vendorName, setVendorName] = useState('');
  const [dateReceived, setDateReceived] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [billNumber, setBillNumber] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ id: Date.now().toString(36) + Math.random().toString(36).substring(2), skuId: '', rawText: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skus, setSkus] = useState<any[]>([]);
  const [skuSearch, setSkuSearch] = useState<Record<string, string>>({});
  const [skuDropdownOpen, setSkuDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/staff/skus')
      .then(r => r.json())
      .then(data => {
        const filtered = (data.skus || data || []).filter((s: any) => s.caseSize > 1 && s.isActive !== false);
        setSkus(filtered);
      })
      .catch(() => setSkus([]));
  }, []);

  const addLine = () => {
    setLines(prev => [...prev, { id: Date.now().toString(36) + Math.random().toString(36).substring(2), skuId: '', rawText: '' }]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof LineItem, value: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const getSerialCount = (rawText: string) => {
    return rawText.split(/[\s,\n]+/).filter(s => s.trim().length > 0).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !dateReceived) {
      toast.error('Vendor name and date are required');
      return;
    }

    for (const line of lines) {
      if (!line.skuId) { toast.error('Please select a SKU for each row'); return; }
      if (!line.rawText.trim()) { toast.error('Please enter serials for each row'); return; }
    }

    const payload = {
      vendorName,
      dateReceived,
      billNumber,
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (data.details?.join(', ')) || 'Failed');

      if (data.warnings?.length) {
        toast.success(`Saved ${data.totalSerials} serials with ${data.warnings.length} warnings.`);
      } else {
        toast.success(`Successfully recorded receipt of ${data.totalSerials} panels.`);
      }

      setLines([{ id: Date.now().toString(36) + Math.random().toString(36).substring(2), skuId: '', rawText: '' }]);
      setBillNumber('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSkus = (lineId: string) => {
    const term = (skuSearch[lineId] || '').toLowerCase();
    return skus.filter(s => s.name.toLowerCase().includes(term)).slice(0, 20);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Receive</h1>
          <p className="text-sm text-gray-500 mt-1">Record physical panel receipt from a vendor. Supports multiple SKUs per entry.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Vendor header */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">Purchase Details</h2>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Vendor Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  placeholder="e.g. Adani Solar Ltd"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm transition-colors"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Date Received <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={dateReceived}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setDateReceived(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm transition-colors"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Bill / Invoice No.</label>
                <input
                  type="text"
                  value={billNumber}
                  onChange={e => setBillNumber(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Serial Number Lines</h2>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-sm font-medium text-[#1A2766] hover:bg-[#1A2766]/5 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add SKU Row
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <div key={line.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Row {idx + 1}</span>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(line.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* SKU selector */}
                  <div className="relative">
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Item (SKU) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        value={skuSearch[line.id] !== undefined ? skuSearch[line.id] : (skus.find(s => s.id === line.skuId)?.name || '')}
                        onFocus={() => { setSkuDropdownOpen(line.id); setSkuSearch(p => ({ ...p, [line.id]: '' })); }}
                        onChange={e => setSkuSearch(p => ({ ...p, [line.id]: e.target.value }))}
                        placeholder="Search and select SKU..."
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm pr-8 transition-colors"
                      />
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {skuDropdownOpen === line.id && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                        {filteredSkus(line.id).length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                        ) : filteredSkus(line.id).map(sku => (
                          <button
                            key={sku.id}
                            type="button"
                            onClick={() => {
                              updateLine(line.id, 'skuId', sku.id);
                              setSkuSearch(p => ({ ...p, [line.id]: sku.name }));
                              setSkuDropdownOpen(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <span className="font-medium text-gray-900">{sku.name}</span>
                            <span className="ml-2 text-xs text-gray-400">Case: {sku.caseSize}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Serials textarea */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5 flex justify-between">
                      <span>Serial Numbers <span className="text-red-500">*</span></span>
                      {line.rawText && (
                        <span className="font-normal text-[#1A2766] text-xs">
                          {getSerialCount(line.rawText)} detected
                        </span>
                      )}
                    </label>
                    <textarea
                      value={line.rawText}
                      onChange={e => updateLine(line.id, 'rawText', e.target.value)}
                      placeholder="Paste serial numbers here (one per line or comma-separated)..."
                      rows={5}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] bg-gray-50/50 font-mono text-sm resize-none transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 bg-amber-50/60 border-t border-amber-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">Serial numbers will be permanently locked to their selected SKU upon saving.</p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-[#1A2766] hover:bg-[#1A2766]/90 text-white px-7 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-[#1A2766]/20 disabled:opacity-50 text-sm"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PackageOpen className="w-4 h-4" />
              )}
              Save Receipt
            </button>
          </div>
        </form>
      </div>

      {/* Click-outside to close dropdown */}
      {skuDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSkuDropdownOpen(null)} />
      )}
    </div>
  );
}

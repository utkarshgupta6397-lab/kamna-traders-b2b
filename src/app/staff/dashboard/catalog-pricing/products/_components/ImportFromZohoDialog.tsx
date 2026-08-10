'use client';
import React, { useState } from 'react';
import { X, Search, Loader2, AlertTriangle, CheckCircle, ExternalLink, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface ImportFromZohoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function ImportFromZohoDialog({ isOpen, onClose, onImportSuccess }: ImportFromZohoDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<'SEARCH' | 'PREVIEW' | 'RESULT'>('SEARCH');
  
  // Search State
  const [searchField, setSearchField] = useState('NAME');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Preview State
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // Result State
  const [importedProductId, setImportedProductId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setHasSearched(false);
    try {
      const res = await fetch(`/api/staff/catalog/zoho-import/search?field=${searchField}&term=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to search Zoho Books');
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const handleSelect = async (remoteId: string) => {
    setIsPreviewing(true);
    try {
      const res = await fetch(`/api/staff/catalog/zoho-import/preview?remoteId=${remoteId}`);
      if (!res.ok) throw new Error('Preview failed');
      const data = await res.json();
      setPreviewData(data);
      setStep('PREVIEW');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!previewData || previewData.duplicateOf) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/staff/catalog/zoho-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteId: previewData.rawZohoItem.item_id })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Import failed');
      }
      const data = await res.json();
      setImportedProductId(data.productId);
      setStep('RESULT');
    } catch (err: any) {
      toast.error(err.message || 'Failed to import product');
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setStep('SEARCH');
    setSearchField('NAME');
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
    setPreviewData(null);
    setImportedProductId(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import from Zoho Books</h2>
            <p className="text-sm text-gray-500 mt-0.5">Search and import active items directly as standard products.</p>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          
          {step === 'SEARCH' && (
            <div className="space-y-6">
              <form onSubmit={handleSearch} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-3">
                <select 
                  className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-[13.5px] font-medium text-gray-700 outline-none focus:border-blue-500 w-40"
                  value={searchField}
                  onChange={e => setSearchField(e.target.value)}
                >
                  <option value="NAME">Item Name</option>
                  <option value="SKU">SKU</option>
                  <option value="ZOHO_ID">Zoho Item ID</option>
                </select>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder={`Search active items by ${searchField.replace('_', ' ').toLowerCase()}...`}
                    className="w-full pl-9 pr-4 h-10 text-[14px] bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isSearching || !searchTerm.trim()}
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white text-[13.5px] font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Search
                </button>
              </form>

              {hasSearched && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {searchResults.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <Search size={32} className="mx-auto mb-3 text-gray-300" />
                      <p className="font-medium text-gray-900">No active items found.</p>
                      <p className="text-sm mt-1">Try adjusting your search terms.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[12px] font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="px-4 py-3 w-12">Img</th>
                          <th className="px-4 py-3">Item Name</th>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3 text-right">Selling Price</th>
                          <th className="px-4 py-3 text-right">Zoho ID</th>
                          <th className="px-4 py-3 w-24"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {searchResults.map(item => (
                          <tr key={item.remoteId} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-4 py-2">
                              <div className="w-8 h-8 rounded border bg-white flex items-center justify-center overflow-hidden">
                                {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-300 text-[10px]">No Img</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2 font-medium text-gray-900 text-[13.5px] max-w-[300px] truncate" title={item.name}>{item.name}</td>
                            <td className="px-4 py-2 text-gray-600 text-[13.5px] font-mono">{item.sku}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900 text-[13.5px]">₹{item.price}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-[12px] font-mono">{item.remoteId}</td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleSelect(item.remoteId)}
                                disabled={isPreviewing}
                                className="px-3 py-1.5 bg-white border border-gray-200 hover:border-blue-500 hover:text-blue-600 text-gray-700 text-[12px] font-medium rounded transition-colors disabled:opacity-50"
                              >
                                Preview
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'PREVIEW' && previewData && (
            <div className="space-y-4">
              <button 
                onClick={() => setStep('SEARCH')}
                className="text-[13px] font-medium text-blue-600 hover:text-blue-700 mb-2 inline-flex items-center"
              >
                ← Back to Search
              </button>

              {previewData.duplicateOf && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h4 className="text-red-900 font-semibold text-[14px]">Product Already Exists</h4>
                    <p className="text-red-700 text-[13px] mt-1 mb-3">
                      This Zoho product already exists inside the ERP (Matched by {previewData.duplicateOf.type}). Duplicate imports are prevented.
                    </p>
                    <div className="bg-white/60 rounded border border-red-100 p-3 text-[13px] grid gap-2">
                      <div className="flex justify-between">
                        <span className="text-red-800/70">ERP Product SKU:</span>
                        <span className="font-mono font-medium text-red-900">{previewData.duplicateOf.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-800/70">Zoho Item ID:</span>
                        <span className="font-mono font-medium text-red-900">{previewData.duplicateOf.zohoBookItemId || 'Not linked'}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button 
                        onClick={() => {
                          handleClose();
                          router.push(`/staff/dashboard/catalog-pricing/products/${previewData.duplicateOf.productId}`);
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium rounded shadow-sm flex items-center gap-2 transition-colors"
                      >
                        <ExternalLink size={14} /> Open Product
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 text-[14px]">Mapped ERP Preview</h3>
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase">Standard Product</span>
                </div>
                <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4 text-[13px]">
                  <div>
                    <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Product Name</span>
                    <span className="font-medium text-gray-900">{previewData.product.name}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">SKU</span>
                    <span className="font-mono text-gray-900">{previewData.product.code || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Category</span>
                    <span className="text-gray-900">{previewData.product.category || <span className="text-amber-600 text-[12px] italic">Will be left blank</span>}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Brand / Mfr</span>
                    <span className="text-gray-900">{previewData.product.brand || '-'} / {previewData.product.manufacturer || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Pricing (Purchase / Selling)</span>
                    <span className="font-medium text-gray-900">₹{previewData.product.purchasePrice} / ₹{previewData.product.sellingPrice}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Taxes (HSN / GST Rate)</span>
                    <span className="text-gray-900">{previewData.product.hsnCode || '-'} / {previewData.product.taxPercentage ? `${previewData.product.taxPercentage}%` : '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Description</span>
                    <p className="text-gray-700 line-clamp-2">{previewData.product.description || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'RESULT' && (
            <div className="py-12 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="text-green-600 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Successful!</h2>
              <p className="text-gray-500 max-w-md mx-auto mb-8">
                The product has been successfully created in the ERP and linked with its Zoho Books ID. You can now map any missing fields or upload additional images.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    handleClose();
                    if (importedProductId) {
                      router.push(`/staff/dashboard/catalog-pricing/products/${importedProductId}`);
                    }
                  }}
                  className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center gap-2"
                >
                  <ExternalLink size={18} /> Open Product
                </button>
                <button 
                  onClick={() => {
                    resetState();
                    onImportSuccess();
                  }}
                  className="h-11 px-6 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors shadow-sm flex items-center gap-2"
                >
                  <Download size={18} /> Import Another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'PREVIEW' && previewData && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            <button 
              onClick={() => setStep('SEARCH')}
              disabled={isImporting}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-[13.5px] font-medium transition-colors"
            >
              Cancel
            </button>
            {!previewData.duplicateOf && (
              <button 
                onClick={handleImport}
                disabled={isImporting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[13.5px] font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {isImporting && <Loader2 size={14} className="animate-spin" />}
                Confirm & Import
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

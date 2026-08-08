import React, { useState, useEffect, useRef } from 'react';
import { X, Search, AlertCircle, CheckCircle2, Box, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportOrphanModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: string;
  onSuccess: () => void;
}

export default function ImportOrphanModal({ isOpen, onClose, familyId, onSuccess }: ImportOrphanModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [orphans, setOrphans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  
  // Validation feedback state
  const [validationPassed, setValidationPassed] = useState<string[]>([]);
  const [validationFailed, setValidationFailed] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setOrphans([]);
      setValidationPassed([]);
      setValidationFailed([]);
      setGeneralError(null);
      fetchOrphans('');
    }
  }, [isOpen]);

  const fetchOrphans = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${familyId}/eligible-orphans?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setOrphans(data || []);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to fetch products');
      }
    } catch (e: any) {
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchOrphans(val);
    }, 400);
  };

  const handleImport = async (orphanId: string) => {
    if (!confirm('This will move the selected standalone product into this Product Family. No inventory, pricing, SKU, or history will be modified. Continue?')) {
      return;
    }

    setImportingId(orphanId);
    setValidationPassed([]);
    setValidationFailed([]);
    setGeneralError(null);
    
    try {
      const res = await fetch(`/api/staff/catalog/products/${familyId}/import-orphan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orphanProductId: orphanId })
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Product successfully imported into Product Family.');
        onSuccess();
        onClose();
      } else {
        if (data.validationFailed && data.validationFailed.length > 0) {
          setValidationPassed(data.validationPassed || []);
          setValidationFailed(data.validationFailed || []);
        } else {
          setGeneralError(data.error || 'Import failed');
        }
      }
    } catch (e: any) {
      setGeneralError(e.message || 'Network error');
    } finally {
      setImportingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Product</h2>
            <p className="text-sm text-gray-500 mt-1">Select an existing standalone product to attach to this Product Family.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {generalError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle size={20} className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-red-800">Import Rejected</h4>
                <p className="text-sm text-red-600 mt-1">{generalError}</p>
              </div>
            </div>
          )}

          {validationFailed.length > 0 && (
            <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b border-gray-200 flex items-center">
                <AlertCircle size={18} className="text-red-500 mr-2" />
                <h4 className="text-sm font-semibold text-red-800">Validation Checklist</h4>
              </div>
              <div className="p-4 bg-white">
                <ul className="space-y-2 text-sm">
                  {validationPassed.map((msg, i) => (
                    <li key={`pass-${i}`} className="flex items-start text-green-700">
                      <CheckCircle2 size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                      <span>{msg}</span>
                    </li>
                  ))}
                  {validationFailed.map((msg, i) => (
                    <li key={`fail-${i}`} className="flex items-start text-red-600 font-medium">
                      <XCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                      <span>{msg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Product Name, Code, or SKU..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
            />
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Searching products...</div>
            ) : orphans.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <Box size={40} className="text-gray-300 mb-3" />
                <p className="font-medium text-gray-700">No active standalone products found</p>
                <p className="text-sm mt-1 max-w-md mx-auto">Only active products that do not belong to a family will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {orphans.map(o => (
                  <div key={o.id} className="p-4 hover:bg-gray-50 flex items-center justify-between transition-colors">
                    <div>
                      <h4 className="font-medium text-gray-900">{o.name}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                        <span><span className="text-gray-400">Code:</span> {o.code}</span>
                        {o.sku && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span><span className="text-gray-400">SKU:</span> {o.sku}</span>
                          </>
                        )}
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-green-600 font-medium">₹{o.sellingPrice.toFixed(2)}</span>
                        
                        <div className="w-full mt-1 flex flex-wrap gap-2 text-xs">
                          {o.category !== '-' && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">Cat: {o.category}</span>}
                          {o.brand !== '-' && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">Brand: {o.brand}</span>}
                          {o.manufacturer !== '-' && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">Mfg: {o.manufacturer}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(o.id)}
                      disabled={importingId !== null}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {importingId === o.id ? 'Importing...' : 'Import'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

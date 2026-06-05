'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Clock, CheckCircle, AlertTriangle, Package, FileText, User, Tag } from 'lucide-react';
import SerialHistoryModal from '@/components/dcr/SerialHistoryModal';

const statusColors: Record<string, string> = {
  AVAILABLE:          'bg-gray-100 text-gray-600 border-gray-200',
  ALLOCATED:          'bg-blue-50 text-blue-700 border-blue-200',
  HOLD:               'bg-amber-50 text-amber-700 border-amber-200',
  READY_TO_ISSUE:     'bg-teal-50 text-teal-700 border-teal-200',
  ISSUED:             'bg-green-50 text-green-700 border-green-200',
  RETURNED:           'bg-red-50 text-red-600 border-red-200',
};

const vendorDcrColors: Record<string, string> = {
  RECEIVED:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  NOT_RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function SerialSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historySerial, setHistorySerial] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/dcr/serial-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.serials || []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);
  }, [query]);

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Serial Search</h1>
          <p className="text-sm text-gray-500 mt-1">Find any serial instantly by serial number, invoice, or customer.</p>
        </div>

        {/* Search bar */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by serial number, invoice number, or customer name..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] transition-all bg-gray-50/50"
              autoFocus
            />
          </div>
          {isLoading && (
            <div className="w-5 h-5 border-2 border-[#1A2766]/20 border-t-[#1A2766] rounded-full animate-spin flex-shrink-0" />
          )}
        </div>

        {/* Hint */}
        {!query && (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Start typing to search</p>
            <p className="text-xs mt-1">Search by serial number, invoice, or customer name</p>
          </div>
        )}

        {/* No results */}
        {query.length >= 2 && !isLoading && results.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No results found for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">{results.length} Result{results.length !== 1 ? 's' : ''}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">Serial Number</th>
                    <th className="px-5 py-3.5">SKU</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Vendor DCR</th>
                    <th className="px-5 py-3.5">Invoice</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {results.map((serial, idx) => {
                    const allocation = serial.allocations?.[0];
                    return (
                      <tr key={serial.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <span className="font-mono font-semibold text-[#1A2766] text-sm">{serial.serialNumber}</span>
                          {serial.serialSource === 'SALES_AUTO_CREATED' && (
                            <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 uppercase">Auto-Created</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {allocation?.invoiceItem?.itemName ? (
                            <span className="text-xs text-gray-600 max-w-[160px] truncate block">{allocation.invoiceItem.itemName}</span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${statusColors[serial.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {serial.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${vendorDcrColors[serial.vendorDcrStatus] || ''}`}>
                            {serial.vendorDcrStatus === 'RECEIVED' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {serial.vendorDcrStatus === 'RECEIVED' ? 'RECEIVED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {allocation?.invoice ? (
                            <span className="text-sm font-medium text-gray-800">{allocation.invoice.invoiceNumber}</span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unallocated</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {allocation?.invoice?.customerName ? (
                            <span className="text-sm text-gray-600">{allocation.invoice.customerName}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setHistorySerial(serial.serialNumber)}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#1A2766] hover:bg-[#1A2766]/5 px-3 py-1.5 rounded-lg transition-colors border border-[#1A2766]/20"
                          >
                            <Clock className="w-3.5 h-3.5" /> Timeline
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <SerialHistoryModal
        serialNumber={historySerial || ''}
        isOpen={!!historySerial}
        onClose={() => setHistorySerial(null)}
      />
    </div>
  );
}

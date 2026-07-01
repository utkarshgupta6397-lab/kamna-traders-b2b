'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2, CheckCircle2, Building2, Phone, Mail } from 'lucide-react';
import { ZohoDuplicateAlertModal } from '@/components/ZohoDuplicateAlertModal';

export default function ZohoCustomerMapper({ orderId }: { orderId: string }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [mapping, setMapping] = useState(false);
  const [error, setError] = useState('');
  const [duplicateError, setDuplicateError] = useState<any>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch customers
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setCustomers([]);
      return;
    }

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/solar-orders/zoho/search-customers?q=${encodeURIComponent(debouncedQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [debouncedQuery]);

  const handleMapCustomer = async () => {
    if (!selectedCustomer) return;
    
    setMapping(true);
    setError('');
    
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/zoho-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedCustomer.contact_id,
          contact_name: selectedCustomer.contact_name
        })
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.code === 'ZOHO_CUSTOMER_ALREADY_LINKED') {
          setDuplicateError({ ...data, customerName: selectedCustomer.contact_name });
          setMapping(false);
          return;
        }
        throw new Error(data.error || 'Failed to map customer');
      }

      // Reload page to show dashboard
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setMapping(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Connect Zoho Books Customer</h2>
        <p className="text-sm text-gray-500">
          This order is not currently linked to a Zoho Books contact. Search for an active customer in Zoho Books to map it to this order.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-[#1A2766] focus:border-[#1A2766] sm:text-sm"
            placeholder="Search by Name, Email, or Phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <Loader2 className="h-5 w-5 text-[#1A2766] animate-spin" />
            </div>
          )}
        </div>

        {/* Results */}
        {query.length >= 2 && customers.length === 0 && !loading && (
          <div className="text-center py-6 text-gray-500 text-sm">
            No active customers found matching "{query}"
          </div>
        )}

        {customers.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2">
            {customers.map((c) => (
              <button
                key={c.contact_id}
                type="button"
                onClick={() => setSelectedCustomer(c)}
                className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start justify-between ${
                  selectedCustomer?.contact_id === c.contact_id 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="font-medium text-gray-900">{c.contact_name}</div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                    {c.company_name && (
                      <span className="flex items-center gap-1"><Building2 size={12}/> {c.company_name}</span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1"><Mail size={12}/> {c.email}</span>
                    )}
                  </div>
                  {c.gst_no && (
                    <div className="mt-1 text-xs font-mono text-gray-500">GST: {c.gst_no}</div>
                  )}
                </div>
                {selectedCustomer?.contact_id === c.contact_id && (
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Action */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleMapCustomer}
          disabled={!selectedCustomer || mapping}
          className="w-full py-3 px-4 bg-[#1A2766] hover:bg-[#111A44] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-2"
        >
          {mapping && <Loader2 className="h-4 w-4 animate-spin" />}
          {mapping ? 'Mapping Customer...' : 'Map Selected Customer'}
        </button>
      </div>

      {duplicateError && (
        <ZohoDuplicateAlertModal
          customerName={duplicateError.customerName}
          existingOrderId={duplicateError.existingOrderId}
          existingOrderNumber={duplicateError.existingOrderNumber}
          existingStatus={duplicateError.existingStatus}
          onClose={() => setDuplicateError(null)}
        />
      )}
    </div>
  );
}

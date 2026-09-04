'use client';
import React, { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvoiceConfirmationStep({ order, workflow, onRefresh }: { order: any, workflow: any, onRefresh: () => void }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (workflow.invoiceConfirmStatus === 'COMPLETED') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-500" size={24} />
          <div>
            <h3 className="font-bold text-emerald-800">Pre-Dispatch Completed!</h3>
            <p className="text-sm text-emerald-600">Invoice <span className="font-bold">{workflow.mappedInvoiceNumber}</span> has been confirmed.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleComplete = async () => {
    if (!invoiceNumber.trim()) {
      toast.error('Invoice Number is required');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/invoice-confirmation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber, mappingMethod: 'MANUAL' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to complete Invoice Confirmation');
      
      toast.success('Invoice Confirmation Completed');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6 max-w-xl">
      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-6">Map Invoice (Manual Fallback)</h3>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Invoice Number <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            value={invoiceNumber} 
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="e.g. INV-2023-001"
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
          />
          <p className="text-xs text-gray-500 mt-2">Enter the invoice number created in Zoho Books manually.</p>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleComplete}
          disabled={!invoiceNumber.trim() || submitting}
          className="bg-[#1A2766] text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Confirm Invoice & Complete
        </button>
      </div>
    </div>
  );
}

'use client';
import React, { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReadyForInvoiceStep({ order, workflow, onRefresh }: { order: any, workflow: any, onRefresh: () => void }) {
  const [billingVerified, setBillingVerified] = useState(false);
  const [shippingVerified, setShippingVerified] = useState(false);
  const [warehouseVerified, setWarehouseVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (workflow.readyForInvoiceStatus === 'COMPLETED') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-500" size={24} />
          <div>
            <h3 className="font-bold text-emerald-800">Ready For Invoice Completed</h3>
            <p className="text-sm text-emerald-600">All checklist items have been verified.</p>
          </div>
        </div>
      </div>
    );
  }

  const isAllVerified = billingVerified && shippingVerified && warehouseVerified;

  const handleComplete = async () => {
    if (!isAllVerified) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/ready-for-invoice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingVerified, shippingVerified, warehouseVerified })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to complete Ready For Invoice');
      
      toast.success('Ready For Invoice Completed');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const addressFormat = (addr: any) => {
    if (!addr) return 'Not available';
    return `${addr.address || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}`;
  };

  const so = order.zohoDetailsJson || {};

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Ready For Invoice Checklist</h3>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          <input type="checkbox" id="chk-billing" checked={billingVerified} onChange={(e) => setBillingVerified(e.target.checked)} className="w-5 h-5 mt-1 text-[#1A2766] rounded" />
          <div>
            <label htmlFor="chk-billing" className="font-bold text-gray-800 cursor-pointer block text-sm">Billing Address Verified</label>
            <p className="text-sm text-gray-600 mt-1">{addressFormat(so.billing_address)}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          <input type="checkbox" id="chk-shipping" checked={shippingVerified} onChange={(e) => setShippingVerified(e.target.checked)} className="w-5 h-5 mt-1 text-[#1A2766] rounded" />
          <div>
            <label htmlFor="chk-shipping" className="font-bold text-gray-800 cursor-pointer block text-sm">Shipping Address Verified</label>
            <p className="text-sm text-gray-600 mt-1">{addressFormat(so.shipping_address)}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
          <input type="checkbox" id="chk-warehouse" checked={warehouseVerified} onChange={(e) => setWarehouseVerified(e.target.checked)} className="w-5 h-5 mt-1 text-[#1A2766] rounded" />
          <div>
            <label htmlFor="chk-warehouse" className="font-bold text-gray-800 cursor-pointer block text-sm">Dispatch Warehouse Verified</label>
            <p className="text-sm text-gray-600 mt-1">N/A (Check internally)</p>
          </div>
        </div>
      </div>

      <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleComplete}
          disabled={!isAllVerified || submitting}
          className="bg-[#1A2766] text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Complete Ready For Invoice
        </button>
      </div>
    </div>
  );
}

'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MiniCustomerStatement from '@/components/zoho/MiniCustomerStatement';

export default function PaymentVerificationStep({ order, workflow, onRefresh }: { order: any, workflow: any, onRefresh: () => void }) {
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(true);
  
  const [decision, setDecision] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!order.customerId) return;
    setStatementLoading(true);
    fetch(`/api/dispatch/incoming-orders/${order.id}/statement`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setStatementData(d.data);
        setStatementLoading(false);
      })
      .catch(() => setStatementLoading(false));
  }, [order.customerId, order.id]);

  if (workflow.paymentStatus === 'COMPLETED') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-500" size={24} />
          <div>
            <h3 className="font-bold text-emerald-800">Payment Verification Completed</h3>
            <p className="text-sm text-emerald-600">Decision: <span className="font-bold">{workflow.paymentDecision}</span></p>
            {workflow.paymentNote && <p className="text-sm text-emerald-600 mt-1">Note: {workflow.paymentNote}</p>}
          </div>
        </div>
      </div>
    );
  }

  const handleComplete = async () => {
    if (!decision) {
      toast.error('Please select a payment decision');
      return;
    }
    if ((decision === 'Partial Payment' || decision === 'Without Payment') && !note.trim()) {
      toast.error('A note is mandatory for this decision.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/payment-verification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note, audit: { total: order.total } })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to verify payment');
      
      toast.success('Payment Verification Completed');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left side: Statement */}
      <div className="w-full lg:w-3/5 border border-gray-200 rounded-lg overflow-hidden h-[500px]">
        {order.customerId ? (
          <MiniCustomerStatement customerId={order.customerId} statementData={statementData} statementLoading={statementLoading} />
        ) : (
          <div className="p-6 text-gray-500">Customer not mapped.</div>
        )}
      </div>
      
      {/* Right side: Decision */}
      <div className="w-full lg:w-2/5 flex flex-col">
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex-1 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Payment Decision</h3>
          
          <div className="space-y-3 mb-6">
            {['Complete Payment', 'Partial Payment', 'Without Payment'].map(opt => (
              <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${decision === opt ? 'border-[#1A2766] bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="paymentDecision" value={opt} checked={decision === opt} onChange={() => setDecision(opt)} className="w-4 h-4 text-[#1A2766]" />
                <span className="font-medium text-gray-800 text-sm">{opt}</span>
              </label>
            ))}
          </div>
          
          <div className="space-y-2 mb-6">
            <label className="block text-xs font-bold text-gray-600 uppercase">Internal Note {(decision === 'Partial Payment' || decision === 'Without Payment') && <span className="text-red-500">*</span>}</label>
            <textarea 
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Enter details..."
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-transparent outline-none min-h-[100px]"
            />
          </div>
          
          <button
            onClick={handleComplete}
            disabled={!decision || submitting}
            className="w-full bg-[#1A2766] text-white px-4 py-2.5 rounded-lg font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Complete Payment Verification
          </button>
        </div>
      </div>
    </div>
  );
}

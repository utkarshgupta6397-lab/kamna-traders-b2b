'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MiniCustomerStatement from '@/components/zoho/MiniCustomerStatement';

export default function PaymentVerificationStep({ order, workflow, onRefresh }: { order: any, workflow: any, onRefresh: () => void }) {
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(true);
  const [statementRefreshing, setStatementRefreshing] = useState(false);
  
  const [decision, setDecision] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStatement = async (isManualRefresh = false) => {
    if (!order.customerId) return;
    if (isManualRefresh) {
      setStatementRefreshing(true);
    } else {
      setStatementLoading(true);
    }

    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/statement`);
      const d = await res.json();
      if (d.success) {
        setStatementData(d.data);
        if (isManualRefresh) {
          toast.success('Customer statement refreshed');
        }
      } else if (isManualRefresh) {
        toast.error(d.error || 'Failed to refresh statement');
      }
    } catch (err: any) {
      if (isManualRefresh) {
        toast.error(err.message || 'Error refreshing statement');
      }
    } finally {
      setStatementLoading(false);
      setStatementRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatement(false);
  }, [order.customerId, order.id]);

  const handleRefreshStatement = () => {
    return fetchStatement(true);
  };

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

  const orderTotal = Number(order.zohoDetailsJson?.total || order.total || 0);

  return (
    <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 w-full h-full">
      {/* Left side: Statement */}
      <div className="w-full lg:w-3/5 border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1 min-h-[380px] lg:min-h-0 h-[520px] lg:h-full">
        {order.customerId ? (
          <MiniCustomerStatement 
            customerId={order.customerId} 
            statementData={statementData} 
            statementLoading={statementLoading}
            orderTotal={orderTotal}
            onRefresh={handleRefreshStatement}
            refreshing={statementRefreshing}
          />
        ) : (
          <div className="p-6 text-gray-500">Customer not mapped.</div>
        )}
      </div>
      
      {/* Right side: Decision */}
      <div className="w-full lg:w-2/5 flex flex-col flex-1 min-h-[380px] lg:min-h-0 h-auto lg:h-full">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col flex-1 h-full overflow-hidden">
          {/* Scrollable inputs area */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Payment Decision</h3>
              
              <div className="space-y-2.5">
                {['Complete Payment', 'Partial Payment', 'Without Payment'].map(opt => (
                  <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${decision === opt ? 'border-[#1A2766] bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="paymentDecision" value={opt} checked={decision === opt} onChange={() => setDecision(opt)} className="w-4 h-4 text-[#1A2766]" />
                    <span className="font-medium text-gray-800 text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-600 uppercase">Internal Note <span className="text-gray-400 font-normal lowercase">(optional)</span></label>
              <textarea 
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Enter details or reference (optional)..."
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-transparent outline-none min-h-[90px] resize-y"
              />
            </div>
          </div>
          
          {/* Sticky anchored action button at bottom */}
          <div className="pt-4 border-t border-gray-100 mt-4 shrink-0">
            <button
              onClick={handleComplete}
              disabled={!decision || submitting}
              className="w-full bg-[#1A2766] text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Complete Payment Verification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

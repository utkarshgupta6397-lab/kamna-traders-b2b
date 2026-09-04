'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, ArrowLeft, Lock, RefreshCw, Loader2, ExternalLink, CircleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import RateReviewStep from './RateReviewStep';
import PaymentVerificationStep from './PaymentVerificationStep';
import ReadyForInvoiceStep from './ReadyForInvoiceStep';
import InvoiceConfirmationStep from './InvoiceConfirmationStep';

function LiveTimer({ receivedAt }: { receivedAt: string | Date }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const start = new Date(receivedAt).getTime();
      const diff = now - start;
      
      if (diff < 60000) {
        setElapsed(Math.floor(diff / 1000) + 's');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      if (days > 0) setElapsed(`${days}d ${hours}h ${minutes}m`);
      else if (hours > 0) setElapsed(`${hours}h ${minutes}m`);
      else setElapsed(`${minutes}m ${seconds}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [receivedAt]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center w-2 h-2">
        <div className="absolute inline-flex w-full h-full bg-red-400 rounded-full opacity-75 animate-ping"></div>
        <div className="relative inline-flex w-2 h-2 bg-red-500 rounded-full"></div>
      </div>
      <div className="text-2xl font-black text-[#1A2766] tabular-nums tracking-tight">{elapsed}</div>
    </div>
  );
}

const formatINR = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

function formatDate(dateString: string | Date) {
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function PreDispatchWorkflowClient({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkflow = async () => {
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${id}/workflow`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load workflow');
      setData(json.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  if (loading && !data) {
    return <div className="flex items-center justify-center p-12 h-full"><Loader2 size={32} className="animate-spin text-[#1A2766]" /></div>;
  }

  if (!data) return <div className="p-6 text-red-500 font-medium">Failed to load sales order workflow.</div>;

  const { order, workflow } = data;
  
  const steps = [
    { id: 1, title: 'Rate Review', status: workflow.rateReviewStatus },
    { id: 2, title: 'Payment Verification', status: workflow.paymentStatus },
    { id: 3, title: 'Ready For Invoice', status: workflow.readyForInvoiceStatus },
    { id: 4, title: 'Invoice Confirmation', status: workflow.invoiceConfirmStatus }
  ];

  const currentStep = workflow.currentStep;
  const isTruckCompleted = workflow.truckDetailsStatus === 'COMPLETED';

  const canAccessStep = (stepId: number) => {
    if (stepId === 1) return true;
    if (stepId === 2) return workflow.rateReviewStatus === 'COMPLETED';
    if (stepId === 3) return workflow.paymentStatus === 'COMPLETED' && isTruckCompleted;
    if (stepId === 4) return workflow.readyForInvoiceStatus === 'COMPLETED';
    return false;
  };

  const lineItemsCount = order.zohoDetailsJson?.line_items?.length || 0;
  const zohoSoUrl = `https://books.zoho.in/app#/salesorders/${order.zohoSalesorderId}`;

  let displayStatus = workflow.overallStatus.replace(/_/g, ' ');
  if (displayStatus === 'IN PROGRESS') {
    if (currentStep === 1) displayStatus = 'RATE REVIEW IN PROGRESS';
    else if (currentStep === 2) displayStatus = 'PAYMENT VERIFICATION IN PROGRESS';
    else if (currentStep === 3) displayStatus = 'READY FOR INVOICE IN PROGRESS';
    else if (currentStep === 4) displayStatus = 'INVOICE CONFIRMATION IN PROGRESS';
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 w-full overflow-hidden">
      {/* COMPACT HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0 flex items-center justify-between shadow-sm z-10">
        <div className="flex flex-col gap-1.5">
          {/* ROW 1 */}
          <div className="flex items-center gap-3 text-sm">
            <button onClick={() => router.push('/staff/dashboard/dispatch/incoming')} className="flex items-center gap-1.5 font-semibold text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span>
            </button>
            <div className="h-4 w-px bg-gray-300" />
            <a 
              href={zohoSoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-lg font-bold text-[#1A2766] hover:text-blue-700 transition-colors flex items-center gap-1.5 group cursor-pointer"
            >
              {order.salesorderNumber || order.zohoSalesorderId}
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            <div className="h-4 w-px bg-gray-300 hidden sm:block" />
            <div className={`hidden sm:flex px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border ${workflow.overallStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
              {displayStatus}
            </div>
            
            <div className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border ${isTruckCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              🚚 {isTruckCompleted ? 'Truck Details Completed' : 'Truck Details Pending'}
              {isTruckCompleted && workflow.truckPhotoUrl && (
                <a href={workflow.truckPhotoUrl} target="_blank" className="ml-1 text-emerald-800 hover:underline">Photo ↗</a>
              )}
            </div>
          </div>
          
          {/* ROW 2 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            <div className="font-semibold text-gray-900">{order.customerName}</div>
            {order.customerGst && (
              <>
                <div className="text-gray-300">|</div>
                <div className="text-xs">GSTIN: <span className="font-medium text-gray-800">{order.customerGst}</span></div>
              </>
            )}
            <div className="text-gray-300">|</div>
            <div className="text-xs">Order Date: <span className="font-medium text-gray-800">{formatDate(order.receivedAt)}</span></div>
            <div className="text-gray-300">|</div>
            <div className="text-xs">Items: <span className="font-medium text-gray-800">{lineItemsCount}</span></div>
            <div className="text-gray-300">|</div>
            <div className="text-xs">Total: <span className="font-bold text-gray-900">{formatINR(order.zohoDetailsJson?.total || order.total || 0)}</span></div>
          </div>
        </div>

        {/* RIGHT: LIVE TIMER */}
        <div className="text-right flex flex-col items-end shrink-0 ml-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Total Elapsed</div>
          <LiveTimer receivedAt={order.receivedAt} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {/* HORIZONTAL STEPPER */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 flex items-center justify-between">
          {steps.map((s, idx) => {
            const active = currentStep === s.id;
            const completed = s.id < currentStep || (s.id === currentStep && s.status === 'COMPLETED');
            const blocked = !canAccessStep(s.id);
            
            return (
              <React.Fragment key={s.id}>
                <div className={`flex flex-col items-center gap-1.5 w-32 ${blocked ? 'opacity-50' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors
                    ${completed ? 'bg-emerald-500 text-white' : active ? 'bg-[#1A2766] text-white ring-4 ring-blue-50' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                    {completed ? <CheckCircle2 size={14} strokeWidth={3} /> : blocked ? <Lock size={12} /> : s.id}
                  </div>
                  <span className={`text-[11px] font-bold text-center uppercase tracking-wide
                    ${completed ? 'text-emerald-700' : active ? 'text-[#1A2766]' : 'text-gray-500'}`}>
                    {s.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full ${s.id < currentStep ? 'bg-emerald-500' : 'bg-gray-100'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* WORKFLOW CONTENT */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {!isTruckCompleted && currentStep >= 3 && (
            <div className="m-6 mb-0 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
              <CircleAlert className="text-amber-500 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-amber-800 text-sm">🚚 Truck Details Pending</h3>
                <p className="text-sm text-amber-700 mt-1">
                  The <span className="font-semibold">Ready For Invoice</span> stage requires Operations to upload Truck Details via the mobile app.
                </p>
                <button onClick={fetchWorkflow} className="mt-3 text-xs flex items-center gap-1 font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded hover:bg-amber-200 transition-colors shadow-sm">
                  <RefreshCw size={12} /> Check Status
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col relative w-full h-full">
            {currentStep === 1 && <RateReviewStep order={order} workflow={workflow} onRefresh={fetchWorkflow} />}
            {currentStep === 2 && canAccessStep(2) && <div className="p-6"><PaymentVerificationStep order={order} workflow={workflow} onRefresh={fetchWorkflow} /></div>}
            {currentStep === 3 && canAccessStep(3) && <div className="p-6"><ReadyForInvoiceStep order={order} workflow={workflow} onRefresh={fetchWorkflow} /></div>}
            {currentStep === 4 && canAccessStep(4) && <div className="p-6"><InvoiceConfirmationStep order={order} workflow={workflow} onRefresh={fetchWorkflow} /></div>}
            
            {workflow.overallStatus === 'PRE_DISPATCH_COMPLETED' && (
               <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                 <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                   <CheckCircle2 size={40} />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-900 mb-2">Pre-Dispatch Complete!</h2>
                 <p className="text-gray-500">The workflow for this Sales Order is successfully finished.</p>
                 <button onClick={() => router.push('/staff/dashboard/dispatch/incoming')} className="mt-6 bg-[#1A2766] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-900 transition-colors shadow-sm">
                   Return to Queue
                 </button>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

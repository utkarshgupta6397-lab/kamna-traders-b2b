import React, { useState } from 'react';
import { CheckCircle2, Loader2, Edit2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const formatINR = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

function getSolarWattage(item: any): number | null {
  const name = (item.name || '').toLowerCase();
  const group = (item.group_name || '').toLowerCase();
  
  if (name.includes('solar panel') || name.includes('solar module') || group.includes('solar panel') || group.includes('solar module')) {
    const match = name.match(/(\d+(?:\.\d+)?)\s*(?:w|watt|wp)/i) || group.match(/(\d+(?:\.\d+)?)\s*(?:w|watt|wp)/i);
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
  }
  return null;
}

export default function RateReviewStep({ order, workflow, onRefresh }: { order: any, workflow: any, onRefresh: () => void }) {
  const lineItems = order.zohoDetailsJson?.line_items || [];
  
  const initialAudit = workflow.rateReviewAudit || { items: {} };
  const [audit, setAudit] = useState<any>(initialAudit);
  
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [savingIntermediate, setSavingIntermediate] = useState(false);

  // Use the actual currentStep from workflow to lock down edits
  const isEditable = workflow.currentStep === 1;

  const saveAuditState = async (newAudit: any) => {
    setSavingIntermediate(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/rate-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit: newAudit, action: 'save' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onRefresh(); // To update the header status immediately
      }
    } catch (err) {
      console.error('Failed to save audit state', err);
    } finally {
      setSavingIntermediate(false);
    }
  };

  const handleVerify = (itemId: string, lineItem: any) => {
    if (!isEditable) return;
    const nextAudit = {
      ...audit,
      items: {
        ...audit.items,
        [itemId]: {
          verified: true,
          rate: lineItem.rate,
          tax: lineItem.tax_percentage || 0
        }
      }
    };
    setAudit(nextAudit);
    saveAuditState(nextAudit);
  };

  const handleUnverify = (itemId: string) => {
    if (!isEditable) return;
    const nextAudit = { ...audit };
    if (nextAudit.items && nextAudit.items[itemId]) {
      delete nextAudit.items[itemId];
    }
    setAudit(nextAudit);
    saveAuditState(nextAudit);
  };

  const handleEditSave = async (lineItemId: string, itemId: string) => {
    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/rate-review/item`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItemId, itemId, newRate: editRate })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update rate');
      
      toast.success('Rate updated in Zoho Books successfully');
      setEditingItem(null);
      
      const nextAudit = { ...audit };
      if (nextAudit.items && nextAudit.items[itemId]) {
        delete nextAudit.items[itemId];
      }
      setAudit(nextAudit);
      saveAuditState(nextAudit);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const numVerified = lineItems.filter((item: any) => audit.items?.[item.item_id]?.verified).length;
  const totalItems = lineItems.length;
  const pendingItems = totalItems - numVerified;
  const isAllVerified = totalItems > 0 && pendingItems === 0;

  const handleComplete = async () => {
    if (!isAllVerified || !isEditable) return;
    setSubmittingComplete(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/rate-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit, action: 'complete' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to complete Rate Review');
      
      toast.success('Rate Review Completed');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingComplete(false);
    }
  };

  const taxTotal = lineItems.reduce((acc: number, item: any) => acc + (item.item_tax || 0), 0) || order.zohoDetailsJson?.tax_total || order.totalTax || 0;
  const grandTotal = order.zohoDetailsJson?.total || order.total || 0;

  const progressText = pendingItems === 0 
    ? `All ${totalItems} Items Verified ✓`
    : `${numVerified} / ${totalItems} Items Verified · ${pendingItems} Pending`;

  const ctaText = pendingItems === 0 
    ? 'Complete Rate Review →' 
    : `Verify Remaining ${pendingItems} Item${pendingItems > 1 ? 's' : ''}`;

  return (
    <div className="flex flex-col h-full bg-white relative">
      {!isEditable && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center gap-3 shrink-0">
          <CheckCircle2 className="text-emerald-600" size={18} />
          <div>
            <h3 className="font-bold text-emerald-800 text-sm">Rate Review Completed</h3>
            <p className="text-xs text-emerald-700 font-medium">All items have been reviewed and locked.</p>
          </div>
        </div>
      )}

      {/* LEDGER TABLE */}
      <div className="overflow-x-auto flex-1 border-b border-gray-200">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-2 font-bold text-gray-700 text-center w-12 border-r border-gray-200">#</th>
              <th className="px-4 py-2 font-bold text-gray-700 text-left border-r border-gray-200">Item Description</th>
              <th className="px-4 py-2 font-bold text-gray-700 text-right border-r border-gray-200 w-24">Qty</th>
              <th className="px-4 py-2 font-bold text-gray-700 text-right border-r border-gray-200 w-32">Rate</th>
              <th className="px-4 py-2 font-bold text-gray-700 text-right border-r border-gray-200 w-24">GST</th>
              <th className="px-4 py-2 font-bold text-gray-700 text-right border-r border-gray-200 w-32">Amount</th>
              <th className="px-4 py-2 font-bold text-gray-700 text-right w-40">Status / Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lineItems.map((item: any, idx: number) => {
              const isVerified = audit.items?.[item.item_id]?.verified;
              const isEditing = editingItem === item.item_id;
              
              const wattage = getSolarWattage(item);
              const isSolar = wattage !== null;

              let rowClass = 'bg-white hover:bg-gray-50/50';
              if (isEditing) rowClass = 'bg-amber-50/50';
              else if (isVerified) rowClass = 'bg-emerald-50/70';

              return (
                <tr key={item.item_id} className={`transition-colors ${rowClass}`}>
                  <td className="px-4 py-3 text-center text-gray-500 font-medium border-r border-gray-100">{idx + 1}</td>
                  <td className="px-4 py-3 border-r border-gray-100 whitespace-normal min-w-[250px]">
                    <div className="font-semibold text-gray-900">{item.name}</div>
                    {item.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1" title={item.description}>{item.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800 border-r border-gray-100">
                    {item.quantity} <span className="text-gray-500 text-xs ml-0.5">{item.unit || ''}</span>
                  </td>
                  <td className="px-4 py-3 text-right border-r border-gray-100">
                    {isEditing ? (
                      <div className="flex justify-end">
                        <input 
                          type="number" 
                          value={editRate} 
                          onChange={(e) => setEditRate(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-white border border-amber-400 rounded-sm text-right text-sm shadow-inner focus:outline-none focus:ring-1 focus:ring-amber-500"
                          disabled={submittingEdit}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-end justify-center">
                        <span className="font-medium text-gray-900">{formatINR(item.rate)}</span>
                        {isSolar && (
                          <span className="text-xs font-bold text-red-600 mt-0.5 tracking-tight">
                            {formatINR(item.rate / wattage!)}/W <span className="text-red-400/80 font-medium">({wattage} W)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 border-r border-gray-100 font-medium">
                    {item.tax_percentage ? `${item.tax_percentage}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 border-r border-gray-100">
                    {formatINR(item.item_total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => setEditingItem(null)} 
                          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-900 bg-white border border-gray-300 px-2 py-1 rounded shadow-sm transition-colors" 
                          disabled={submittingEdit}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleEditSave(item.line_item_id, item.item_id)} 
                          disabled={submittingEdit}
                          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-[#1A2766] text-white px-2 py-1 rounded shadow-sm hover:bg-blue-900 transition-colors"
                        >
                          {submittingEdit ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        {isVerified ? (
                          isEditable ? (
                            <button 
                              onClick={() => handleUnverify(item.item_id)} 
                              className="group flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-100 border border-emerald-300 text-emerald-800 px-2 py-1 rounded shadow-sm hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                            >
                              <span className="group-hover:hidden flex items-center gap-1"><CheckCircle2 size={12} /> Verified</span>
                              <span className="hidden group-hover:flex items-center gap-1"><X size={12} /> Unverify</span>
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-100 border border-emerald-200 text-emerald-800 px-2 py-1 rounded shadow-sm cursor-default">
                              <CheckCircle2 size={12} /> Verified
                            </span>
                          )
                        ) : (
                          <>
                            {isEditable && (
                              <button 
                                onClick={() => { setEditingItem(item.item_id); setEditRate(item.rate); }} 
                                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-600 bg-white border border-gray-300 px-2 py-1 rounded shadow-sm hover:bg-gray-50 hover:text-[#1A2766] transition-colors"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                            )}
                            <button 
                              onClick={() => handleVerify(item.item_id, item)} 
                              disabled={!isEditable}
                              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded shadow-sm hover:bg-[#1A2766] hover:border-[#1A2766] hover:text-white transition-colors disabled:opacity-50"
                            >
                              <Check size={12} /> Verify
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* STICKY FOOTER SUMMARY & ACTION */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-300 p-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-20 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* PROGRESS */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${pendingItems === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-[#1A2766]'}`}>
              {pendingItems === 0 ? <CheckCircle2 size={18} /> : <span className="font-bold text-sm">{numVerified}</span>}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">{progressText}</div>
              <div className="text-xs font-medium text-gray-500">Rate Review Progress</div>
            </div>
          </div>
          
          {/* TOTALS & CTA */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end gap-1 text-sm bg-gray-50 px-4 py-2 rounded border border-gray-200">
              <div className="flex items-center justify-between w-48">
                <span className="text-gray-500 font-medium">Total Tax</span>
                <span className="font-semibold text-gray-700">{formatINR(taxTotal)}</span>
              </div>
              <div className="w-full h-px bg-gray-200 my-0.5" />
              <div className="flex items-center justify-between w-48">
                <span className="text-gray-800 font-bold uppercase tracking-wide text-xs">Total Value</span>
                <span className="font-black text-gray-900 text-base">{formatINR(grandTotal)}</span>
              </div>
            </div>

            {isEditable && (
              <button
                onClick={handleComplete}
                disabled={!isAllVerified || submittingComplete}
                className={`px-8 py-3.5 rounded-md font-bold transition-all shadow-sm flex items-center gap-2 text-sm
                  ${isAllVerified 
                    ? 'bg-[#1A2766] text-white hover:bg-blue-900 hover:shadow-md' 
                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  }`}
              >
                {submittingComplete && <Loader2 size={16} className="animate-spin" />}
                {ctaText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

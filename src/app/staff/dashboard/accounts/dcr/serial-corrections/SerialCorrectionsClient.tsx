'use client';

import { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle, Shield, Clock, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type CorrectionType = 'CHANGE_SKU' | 'FIX_PURCHASE' | 'FIX_DCR' | 'CHANGE_SERIAL' | 'DELETE_SERIAL' | 'UNDO_ISSUE';

export default function SerialCorrectionsClient() {
  const [searchSerial, setSearchSerial] = useState('');
  const [serial, setSerial] = useState<any | null>(null);
  const [skuName, setSkuName] = useState('');
  const [skuDetails, setSkuDetails] = useState<any | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Correction form state
  const [correctionType, setCorrectionType] = useState<CorrectionType>('CHANGE_SKU');
  const [reason, setReason] = useState('');

  // SKU change values
  const [newSkuId, setNewSkuId] = useState('');
  const [newSkuSearch, setNewSkuSearch] = useState('');
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const [allSkus, setAllSkus] = useState<any[]>([]);
  const filteredSkus = allSkus.filter(s => s.name.toLowerCase().includes(newSkuSearch.toLowerCase())).slice(0, 20);

  // Purchase fix values
  const [newPurchaseReceived, setNewPurchaseReceived] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newBillNumber, setNewBillNumber] = useState('');

  // DCR fix values
  const [newVendorDcrStatus, setNewVendorDcrStatus] = useState<'RECEIVED' | 'NOT_RECEIVED'>('RECEIVED');

  // Change Serial values
  const [newSerialNumber, setNewSerialNumber] = useState('');

  useEffect(() => {
    fetch('/api/staff/skus')
      .then(r => r.json())
      .then(data => setAllSkus((data.skus || data || []).filter((s: any) => s.caseSize > 1 && s.isActive !== false)))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchSerial.trim()) return;
    setIsFetching(true);
    setSerial(null);
    try {
      const res = await fetch(`/api/admin/dcr/serial-corrections?serial=${encodeURIComponent(searchSerial.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSerial(data.serial);
      setSkuName(data.skuName || '');
      setSkuDetails(data.skuDetails || null);
      // Pre-fill form
      setNewPurchaseReceived(data.serial.purchaseReceived);
      setNewVendorName(data.serial.vendorName || '');
      setNewBillNumber(data.serial.billNumber || '');
      setNewVendorDcrStatus(data.serial.vendorDcrStatus);
    } catch (err: any) {
      toast.error(err.message || 'Serial not found');
    } finally {
      setIsFetching(false);
    }
  };

  const handleCorrect = async () => {
    if (!serial || !reason.trim()) { toast.error('Please provide a reason for the correction'); return; }

    let newValues: Record<string, any> = {};
    if (correctionType === 'CHANGE_SKU') {
      if (!newSkuId) { toast.error('Please select a new SKU'); return; }
      newValues = { skuId: newSkuId };
    } else if (correctionType === 'FIX_PURCHASE') {
      newValues = { purchaseReceived: newPurchaseReceived, vendorName: newVendorName, billNumber: newBillNumber };
    } else if (correctionType === 'FIX_DCR') {
      newValues = { vendorDcrStatus: newVendorDcrStatus };
    } else if (correctionType === 'CHANGE_SERIAL') {
      const trimmedNewSerial = newSerialNumber.trim().toUpperCase();
      if (!trimmedNewSerial) { toast.error('New serial cannot be empty'); return; }
      if (trimmedNewSerial === serial.serialNumber) { toast.error('New serial cannot equal current serial'); return; }

      // Check global uniqueness
      setIsSubmitting(true);
      try {
        const checkRes = await fetch(`/api/admin/dcr/serial-corrections?serial=${encodeURIComponent(trimmedNewSerial)}`);
        if (checkRes.ok) {
          setIsSubmitting(false);
          toast.error('Serial number already exists. Choose a different serial.');
          return;
        }
      } catch (err) {
        // If it throws an error other than 404, we can't be sure, but 404 means it's unique
      }
      setIsSubmitting(false);

      newValues = { serialNumber: trimmedNewSerial };
    } else if (correctionType === 'UNDO_ISSUE') {
      if (serial.status !== 'ISSUED') {
        toast.error('Only ISSUED serials can be un-issued');
        return;
      }
      newValues = {};
    } else if (correctionType === 'DELETE_SERIAL') {
      if (reason.trim().length < 5) {
        toast.error('Reason must be at least 5 characters');
        return;
      }
      if (['ISSUED', 'READY_TO_ISSUE'].includes(serial.status)) {
        toast.error('Cannot delete serial: Status is ' + serial.status);
        return;
      }
      const hasIssueHistory = serial.history?.some((h: any) => h.eventType.includes('ISSUE'));
      if (hasIssueHistory) {
        toast.error('Cannot delete serial: Serial has been issued previously');
        return;
      }
      newValues = {};
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/dcr/serial-corrections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber: serial.serialNumber, correctionType, newValues, reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Correction applied successfully. Audit trail recorded.');
      setReason('');
      setNewSerialNumber('');
      // Refresh serial data
      handleSearch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply correction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0 mt-0.5">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Serial Corrections</h1>
            <p className="text-sm text-gray-500 mt-1">Admin-only. Change SKU mapping or fix purchase/DCR records. Every change is fully audited.</p>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-bold mb-0.5">Use with extreme caution</p>
            <p className="text-red-700/80">This module overrides locked records. Every correction is permanently logged with your identity, timestamp, old and new values.</p>
          </div>
        </div>

        {/* Serial lookup */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Find Serial</h2>
          </div>
          <div className="p-5 flex gap-3">
            <input
              type="text"
              value={searchSerial}
              onChange={e => setSearchSerial(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Enter exact serial number..."
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] font-mono text-sm transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={isFetching || !searchSerial.trim()}
              className="flex items-center gap-2 bg-[#1A2766] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A2766]/90 disabled:opacity-50 transition-all"
            >
              {isFetching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
        </div>

        {/* Serial detail + correction form */}
        {serial && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left: Serial Info */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Current Serial State</h2>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Serial Number</span>
                  <span className="font-mono font-bold text-[#1A2766]">{serial.serialNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current SKU</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%] text-xs">
                    {skuDetails?.name || skuName || 'Unknown Product'}
                  </span>
                </div>
                {skuDetails?.zohoBooksId2 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">SKU Code</span>
                    <span className="font-mono text-xs text-gray-600 text-right">{skuDetails.zohoBooksId2}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Source</span>
                  <span className="font-mono text-xs text-gray-600">{serial.serialSource}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium text-gray-900">{serial.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Purchase Received</span>
                  <span className={`font-semibold text-xs ${serial.purchaseReceived ? 'text-green-600' : 'text-amber-600'}`}>
                    {serial.purchaseReceived ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vendor Name</span>
                  <span className="text-gray-700 text-xs">{serial.vendorName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bill Number</span>
                  <span className="text-gray-700 text-xs">{serial.billNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vendor DCR</span>
                  <div className="text-right">
                    <span className={`font-semibold text-xs ${serial.vendorDcrStatus === 'RECEIVED' ? 'text-green-600' : 'text-amber-600'}`}>
                      {serial.vendorDcrStatus}
                    </span>
                    {serial.vendorDcrStatus === 'RECEIVED' && serial.vendorDcrReceivedAt && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(serial.vendorDcrReceivedAt), 'dd MMM yyyy, h:mm a')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                {serial.history?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> History ({serial.history.length} events)
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {serial.history.map((h: any) => (
                        <div key={h.id} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#1A2766] mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{h.eventType.replace(/_/g, ' ')}</p>
                            <p className="text-[11px] text-gray-500">{format(new Date(h.createdAt), 'dd MMM yyyy, h:mm a')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Correction Form */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Apply Correction</h2>
              </div>
              <div className="p-5 space-y-5">

                {/* Correction type */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Correction Type</label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {(([
                      'CHANGE_SKU', 'FIX_PURCHASE', 'FIX_DCR', 'CHANGE_SERIAL', 'DELETE_SERIAL',
                      ...(serial?.status === 'ISSUED' ? ['UNDO_ISSUE'] : [])
                    ]) as CorrectionType[]).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCorrectionType(t)}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                          correctionType === t
                            ? 'bg-[#1A2766] text-white border-[#1A2766]'
                            : 'text-gray-600 border-gray-300 hover:border-[#1A2766]/40'
                        }`}
                      >
                        {t === 'CHANGE_SKU' ? 'Change SKU' : t === 'FIX_PURCHASE' ? 'Fix Purchase' : t === 'FIX_DCR' ? 'Fix DCR' : t === 'CHANGE_SERIAL' ? 'Change Serial' : t === 'UNDO_ISSUE' ? 'Undo Issue' : 'Delete Serial'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic fields */}
                {correctionType === 'CHANGE_SKU' && (
                  <div className="relative">
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">New SKU</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={skuDropdownOpen ? newSkuSearch : (allSkus.find(s => s.id === newSkuId)?.name || newSkuSearch)}
                        onFocus={() => { setSkuDropdownOpen(true); setNewSkuSearch(''); }}
                        onChange={e => setNewSkuSearch(e.target.value)}
                        placeholder="Search and select new SKU..."
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm pr-8 transition-colors"
                      />
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {skuDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredSkus.map(sku => (
                          <button
                            key={sku.id}
                            type="button"
                            onClick={() => { setNewSkuId(sku.id); setNewSkuSearch(sku.name); setSkuDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <span className="font-medium">{sku.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {correctionType === 'FIX_PURCHASE' && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={newPurchaseReceived} onChange={e => setNewPurchaseReceived(e.target.checked)} className="rounded text-[#1A2766]" />
                      <span className="text-sm font-medium text-gray-700">Mark as Purchase Received</span>
                    </label>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Vendor Name</label>
                      <input type="text" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Bill Number</label>
                      <input type="text" value={newBillNumber} onChange={e => setNewBillNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766]" />
                    </div>
                  </div>
                )}

                {correctionType === 'FIX_DCR' && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['RECEIVED', 'NOT_RECEIVED'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setNewVendorDcrStatus(status)}
                        className={`py-2.5 text-xs font-semibold rounded-lg border transition-all ${
                          newVendorDcrStatus === status
                            ? status === 'RECEIVED' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-amber-600 text-white border-amber-600'
                            : 'text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {status === 'RECEIVED' ? '✓ Received' : '✗ Not Received'}
                      </button>
                    ))}
                  </div>
                )}

                {correctionType === 'CHANGE_SERIAL' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Current Serial</label>
                      <input type="text" value={serial.serialNumber} disabled className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 cursor-not-allowed font-mono" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">New Serial Number</label>
                      <input 
                        type="text" 
                        value={newSerialNumber} 
                        onChange={e => setNewSerialNumber(e.target.value.toUpperCase().replace(/\s/g, ''))} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] font-mono" 
                        placeholder="Enter new serial number..."
                      />
                    </div>
                  </div>
                )}

                {correctionType === 'DELETE_SERIAL' && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                      <p className="font-bold mb-2">Impact Analysis: Will Update</p>
                      <ul className="space-y-1 ml-1">
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Allocation Records: <strong>{serial.allocations?.length || 0}</strong></li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Pending Serial Queue: <strong>{serial.allocations?.length > 0 ? 'Yes' : 'No'}</strong></li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Ready To Issue Queue: <strong>No</strong></li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Hold Queue: <strong>{serial.vendorDcrStatus === 'RECEIVED' && serial.status === 'ALLOCATED' ? 'Yes' : 'No'}</strong></li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Invoice Allocation Status: <strong>{serial.allocations?.length > 0 ? 'Yes' : 'No'}</strong></li>
                      </ul>
                      <p className="mt-3 text-red-700/80 italic text-xs">
                        This serial will be removed from active DCR processing. Allocation references will be updated automatically. Audit history will be preserved.
                      </p>
                    </div>
                  </div>
                )}

                {correctionType === 'UNDO_ISSUE' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                      <p className="font-bold mb-2">Impact Analysis: Undo Issue</p>
                      <ul className="space-y-1 ml-1">
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Serial Status: <strong>ISSUED → READY_TO_ISSUE</strong></li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Allocation: <strong>Unchanged</strong></li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Vendor DCR Status: <strong>Unchanged</strong></li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Invoice Status: <strong>Will recalculate automatically</strong></li>
                      </ul>
                      <p className="mt-3 text-blue-700/80 italic text-xs">
                        This will reverse the issue transaction. The serial will instantly reappear in the Ready To Issue queue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Reason for Correction <span className="text-red-500">*</span></label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Mandatory: Explain why this correction is being made..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm resize-none transition-colors"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleCorrect}
                    disabled={isSubmitting || !reason.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Apply Correction
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {skuDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSkuDropdownOpen(false)} />
      )}
    </div>
  );
}

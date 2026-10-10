'use client';

import React, { useState } from 'react';
import {
  X,
  Upload,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
  ShieldCheck,
  Ban
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportTagModal({ isOpen, onClose, onSuccess }: ImportTagModalProps) {
  const [step, setStep] = useState<'INPUT' | 'PREVIEW' | 'COMPLETED'>('INPUT');
  const [inputText, setInputText] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Preview Data
  const [previewSummary, setPreviewSummary] = useState<any>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  // Completion Data
  const [completionData, setCompletionData] = useState<any>(null);
  const [showSkippedRows, setShowSkippedRows] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (step === 'PREVIEW' && !isImporting) {
      if (window.confirm('You have unsaved preview changes. Are you sure you want to close?')) {
        resetState();
        onClose();
      }
      return;
    }
    resetState();
    onClose();
  };

  const resetState = () => {
    setStep('INPUT');
    setInputText('');
    setPreviewSummary(null);
    setPreviewRows([]);
    setCompletionData(null);
    setFilterAction('ALL');
  };

  const handlePreview = async () => {
    if (!inputText.trim()) {
      toast.error('Please paste data before previewing');
      return;
    }

    setIsValidating(true);
    try {
      const res = await fetch('/api/admin/dcr/serial-registry/import-tag/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate input');
      }

      setPreviewSummary(data.summary);
      setPreviewRows(data.rows || []);
      setStep('PREVIEW');
    } catch (err: any) {
      toast.error(err.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!inputText.trim() || isImporting) return;

    setIsImporting(true);
    try {
      const res = await fetch('/api/admin/dcr/serial-registry/import-tag/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText, // Server re-derives tags directly from original text (Zero Client Trust)
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setCompletionData(data);
      setStep('COMPLETED');
      toast.success('Serial tags imported successfully!');
      onSuccess(); // Refresh Serial Registry table and stats
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete import');
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered rows in preview
  const displayedPreviewRows = previewRows.filter(row => {
    if (filterAction === 'ALL') return true;
    if (filterAction === 'ELIGIBLE') return row.vendorDcrEligibility === 'ELIGIBLE_NOT_RECEIVED';
    if (filterAction === 'SKIPPED') return (
      row.vendorDcrEligibility === 'SKIPPED_ALREADY_RECEIVED' ||
      row.vendorDcrEligibility === 'SKIPPED_OTHER_STATUS' ||
      row.vendorDcrEligibility === 'SKIPPED_SERIAL_NOT_FOUND'
    );
    if (filterAction === 'DUPLICATES') return row.isDuplicate;
    if (filterAction === 'ISSUES') return row.vendorDcrEligibility === 'NEEDS_REVIEW' || row.action === 'INVALID_INPUT';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#1A2766]/10 text-[#1A2766] rounded-xl flex items-center justify-center">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import Serial Tags</h2>
              <p className="text-xs text-gray-500">Extract serial tags from vendor portal error remarks (Vendor DCR: Not Received only)</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200/50 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 1: INPUT & PASTE */}
          {step === 'INPUT' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info size={16} className="text-blue-600 shrink-0" />
                  Mandatory Rules & Eligibility
                </div>
                <div className="text-blue-800 space-y-1 pl-5">
                  <p>• <strong>Vendor DCR Status:</strong> Serial tags will <em>only</em> be updated if the serial is present in the DCR registry with Vendor DCR status <strong className="text-blue-950 font-bold">Not Received</strong>.</p>
                  <p>• <strong>Other Statuses / Missing:</strong> Serials that are already <em>Received</em>, have other statuses, or are missing from the registry are skipped safely.</p>
                  <p>• <strong>Rule A:</strong> Remarks with <code className="bg-blue-100/80 px-1 py-0.5 rounded font-mono">Invalid serial number</code> will set tag to <strong className="text-blue-950 font-bold">No Data</strong> (overwriting previous tags).</p>
                  <p>• <strong>Rule B:</strong> Vendor chains extract the last business/person entity immediately before the <code className="bg-blue-100/80 px-1 py-0.5 rounded font-mono">Claimed</code> marker (excluding the government claim reference). Chains missing <code className="bg-blue-100/80 px-1 py-0.5 rounded font-mono">Claimed</code> are flagged for review.</p>
                  <p>• <strong>Duplicates:</strong> If a serial appears multiple times, the <em>last valid occurrence</em> wins.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Paste Tabular Data or TSV
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Serial Number\tError Remarks\nWS08269076443811\tWaaree Energies Limited -> AMR Power Solutions (5601016510)\n26IT1072E100069166\tInvalid serial number (not manufactured or typographical error)`}
                  rows={14}
                  className="w-full p-4 font-mono text-xs bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-all resize-none text-gray-800 leading-relaxed"
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="text-xs text-gray-500">
                  {inputText ? `${inputText.split('\n').filter(l => l.trim()).length} lines detected` : 'No data pasted'}
                </div>
                <button
                  onClick={handlePreview}
                  disabled={isValidating || !inputText.trim()}
                  className="bg-[#1A2766] hover:bg-[#283885] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isValidating ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Parsing & Validating...
                    </>
                  ) : (
                    <>
                      Preview & Validate
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'PREVIEW' && previewSummary && (
            <div className="space-y-5">
              
              {/* Summary Stats Grid (7 tiles matching prompt requirements) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Total Parsed Rows</div>
                  <div className="text-lg font-bold text-gray-900">{previewSummary.totalParsedRows}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Unique Serials</div>
                  <div className="text-lg font-bold text-gray-900">{previewSummary.uniqueSerials}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Eligible for Import</div>
                  <div className="text-lg font-bold text-emerald-700">{previewSummary.eligibleForImport}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Skipped (Vendor DCR)</div>
                  <div className="text-lg font-bold text-amber-700">{previewSummary.skippedVendorDcr}</div>
                </div>
                <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-600 uppercase">Serials Not Found</div>
                  <div className="text-lg font-bold text-slate-700">{previewSummary.serialNotFound}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Duplicate Rows</div>
                  <div className="text-lg font-bold text-blue-700">{previewSummary.duplicateRows}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-rose-700 uppercase">Rows Requiring Review</div>
                  <div className="text-lg font-bold text-rose-700">{previewSummary.needsReviewCount}</div>
                </div>
              </div>

              {/* Informative Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
                <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Only {previewSummary.eligibleForImport} record(s) with Vendor DCR status &quot;Not Received&quot; will be updated.</strong>
                  <p className="mt-0.5 text-blue-800">
                    {previewSummary.skippedVendorDcr} serials already Received/other status and {previewSummary.serialNotFound} serials not found in registry will be skipped safely.
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 border-b border-gray-200 pb-2 text-xs overflow-x-auto">
                <button
                  onClick={() => setFilterAction('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${filterAction === 'ALL' ? 'bg-[#1A2766] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  All Rows ({previewRows.length})
                </button>
                <button
                  onClick={() => setFilterAction('ELIGIBLE')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${filterAction === 'ELIGIBLE' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Eligible ({previewSummary.eligibleForImport})
                </button>
                <button
                  onClick={() => setFilterAction('SKIPPED')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${filterAction === 'SKIPPED' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Skipped Status / Not Found ({previewSummary.skippedVendorDcr + previewSummary.serialNotFound})
                </button>
                <button
                  onClick={() => setFilterAction('DUPLICATES')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${filterAction === 'DUPLICATES' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Duplicates ({previewSummary.duplicateRows})
                </button>
                <button
                  onClick={() => setFilterAction('ISSUES')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${filterAction === 'ISSUES' ? 'bg-rose-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Needs Review ({previewSummary.needsReviewCount})
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Row</th>
                      <th className="py-2.5 px-3">Serial Number</th>
                      <th className="py-2.5 px-3">Extracted Tag</th>
                      <th className="py-2.5 px-3">Vendor DCR Status</th>
                      <th className="py-2.5 px-3">Eligibility / Status</th>
                      <th className="py-2.5 px-3">Current Tag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {displayedPreviewRows.map((row, idx) => (
                      <tr key={idx} className={row.vendorDcrEligibility === 'ELIGIBLE_NOT_RECEIVED' ? 'hover:bg-emerald-50/40 bg-white' : 'bg-gray-50/40 opacity-80'}>
                        <td className="py-2 px-3 text-center text-gray-400">{row.rowNumber}</td>
                        <td className="py-2 px-3 font-semibold text-gray-900">
                          {row.serialNumber || <span className="text-rose-500 italic">Empty</span>}
                          {row.duplicateNote && (
                            <div className="text-[10px] text-blue-700 font-sans font-medium">{row.duplicateNote}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {row.extractedTag ? (
                            <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                              {row.extractedTag}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {row.vendorDcrStatus ? (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              row.vendorDcrStatus === 'NOT_RECEIVED'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : row.vendorDcrStatus === 'RECEIVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {row.vendorDcrStatus.replace(/_/g, ' ')}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Not in DCR</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {row.vendorDcrEligibility === 'ELIGIBLE_NOT_RECEIVED' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle size={12} /> Eligible — Not Received
                            </span>
                          )}
                          {row.vendorDcrEligibility === 'SKIPPED_ALREADY_RECEIVED' && (
                            <span className="inline-flex items-center gap-1 text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title={row.reason}>
                              <Ban size={12} /> Skipped — Already Received
                            </span>
                          )}
                          {row.vendorDcrEligibility === 'SKIPPED_OTHER_STATUS' && (
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-300" title={row.reason}>
                              <Ban size={12} /> Skipped — Other Status
                            </span>
                          )}
                          {row.vendorDcrEligibility === 'SKIPPED_SERIAL_NOT_FOUND' && (
                            <span className="inline-flex items-center gap-1 text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded border border-gray-200" title={row.reason}>
                              <Ban size={12} /> Skipped — Serial Not Found
                            </span>
                          )}
                          {row.vendorDcrEligibility === 'DUPLICATE_SKIPPED' && (
                            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-medium">
                              Duplicate — Skipped
                            </span>
                          )}
                          {row.vendorDcrEligibility === 'NEEDS_REVIEW' && (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-medium" title={row.reason}>
                              <AlertTriangle size={12} className="inline mr-1" />
                              {row.reason || 'Needs Review'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-sans text-gray-600">
                          {row.currentTag ? (
                            <span className="text-gray-700">{row.currentTag}</span>
                          ) : (
                            <span className="text-gray-400 italic">Untagged</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep('INPUT')}
                  disabled={isImporting}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  Back to Edit Input
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClose}
                    disabled={isImporting}
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting || previewSummary.eligibleForImport === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Committing to Database...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} />
                        Confirm & Import {previewSummary.eligibleForImport} Eligible Records
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETED REPORT */}
          {step === 'COMPLETED' && completionData && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Serial Tag Import Completed</h3>
                <p className="text-xs text-gray-500 font-mono">Batch ID: {completionData.batchId}</p>
              </div>

              {/* Committed Summary Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 max-w-xl mx-auto space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Rows parsed:</span>
                    <span className="font-bold text-gray-900">{completionData.totalParsed}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Unique serials:</span>
                    <span className="font-bold text-gray-900">{completionData.uniqueSerials}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Eligible updates committed:</span>
                    <span className="font-bold text-emerald-700">{completionData.dcrSerialsUpdated}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Skipped (Vendor DCR):</span>
                    <span className="font-bold text-amber-700">{completionData.skippedVendorDcr}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Skipped (Not Found):</span>
                    <span className="font-bold text-slate-700">{completionData.serialNotFound}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Skipped duplicates:</span>
                    <span className="font-bold text-blue-700">{completionData.skippedDuplicates}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 col-span-2">
                    <span className="text-gray-500">Failed writes:</span>
                    <span className={`font-bold ${completionData.failedRowsCount > 0 ? 'text-rose-700' : 'text-gray-900'}`}>{completionData.failedRowsCount}</span>
                  </div>
                </div>
              </div>

              {/* Inspect Skipped / Failed Details Accordion */}
              {((completionData.skippedVendorDcrDetails && completionData.skippedVendorDcrDetails.length > 0) ||
                (completionData.skippedNotFoundDetails && completionData.skippedNotFoundDetails.length > 0) ||
                (completionData.errors && completionData.errors.length > 0)) && (
                <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 max-w-xl mx-auto">
                  <button
                    onClick={() => setShowSkippedRows(!showSkippedRows)}
                    className="flex justify-between items-center w-full text-xs font-semibold text-gray-700"
                  >
                    <span>
                      Inspect Skipped & Unprocessed Serials (
                      {(completionData.skippedVendorDcrDetails?.length || 0) +
                        (completionData.skippedNotFoundDetails?.length || 0) +
                        (completionData.errors?.length || 0)}
                      )
                    </span>
                    {showSkippedRows ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showSkippedRows && (
                    <div className="mt-3 max-h-48 overflow-y-auto space-y-2 text-xs divide-y divide-gray-200 font-mono">
                      {completionData.skippedVendorDcrDetails?.map((item: any, idx: number) => (
                        <div key={`vdcr-${idx}`} className="pt-1.5 flex justify-between">
                          <span className="font-semibold text-gray-800">{item.serialNumber}</span>
                          <span className="text-amber-700 font-sans">{item.reason}</span>
                        </div>
                      ))}
                      {completionData.skippedNotFoundDetails?.map((item: any, idx: number) => (
                        <div key={`nf-${idx}`} className="pt-1.5 flex justify-between">
                          <span className="font-semibold text-gray-800">{item.serialNumber}</span>
                          <span className="text-slate-600 font-sans">{item.reason}</span>
                        </div>
                      ))}
                      {completionData.errors?.map((err: any, idx: number) => (
                        <div key={`err-${idx}`} className="pt-1.5 flex justify-between">
                          <span className="font-semibold text-rose-800">{err.serialNumber}</span>
                          <span className="text-rose-600 font-sans">{err.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  onClick={() => {
                    resetState();
                    onClose();
                  }}
                  className="bg-[#1A2766] hover:bg-[#283885] text-white px-8 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

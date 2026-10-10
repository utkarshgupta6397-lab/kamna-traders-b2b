'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Ban,
  ChevronDown,
  ChevronUp,
  Check,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CleanSerialWhitespaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CleanSerialWhitespaceModal({
  isOpen,
  onClose,
  onSuccess
}: CleanSerialWhitespaceModalProps) {
  const [step, setStep] = useState<'SCANNING' | 'PREVIEW' | 'COMPLETED'>('SCANNING');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview Data
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'ELIGIBLE' | 'CONFLICTS'>('ALL');

  // Completion Data
  const [completionData, setCompletionData] = useState<any>(null);
  const [showSkippedDetails, setShowSkippedDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    } else {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setStep('SCANNING');
    setSummary(null);
    setRows([]);
    setCompletionData(null);
    setFilterTab('ALL');
    setIsLoading(false);
    setIsSubmitting(false);
    setShowSkippedDetails(false);
  };

  const loadPreview = async () => {
    setIsLoading(true);
    setStep('SCANNING');
    try {
      const res = await fetch('/api/admin/dcr/serial-corrections/clean-whitespace/preview');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan serial records');
      }

      setSummary(data.summary);
      setRows(data.rows || []);
      setStep('PREVIEW');
    } catch (err: any) {
      toast.error(err.message || 'Failed to scan database');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmClean = async () => {
    if (isSubmitting || !summary || summary.recordsEligible === 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/dcr/serial-corrections/clean-whitespace/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply whitespace corrections');
      }

      setCompletionData(data);
      setStep('COMPLETED');
      toast.success(`Successfully cleaned ${data.correctedCount} serial numbers!`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Correction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const displayedRows = rows.filter(row => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'ELIGIBLE') return row.isEligible;
    if (filterTab === 'CONFLICTS') return !row.isEligible;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Clean Non-Issued Serial Numbers</h2>
              <p className="text-xs text-gray-500">Scan and remove whitespace characters from non-issued DCR serial records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200/50 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 1: SCANNING */}
          {step === 'SCANNING' && (
            <div className="py-16 text-center space-y-4">
              <RefreshCw size={36} className="animate-spin text-indigo-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-gray-900">Scanning DCR Serial Registry</h3>
                <p className="text-xs text-gray-500 mt-1">Analyzing all non-issued serial numbers and checking for uniqueness collisions...</p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'PREVIEW' && summary && (
            <div className="space-y-5">
              
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Total Scanned</div>
                  <div className="text-lg font-bold text-gray-900">{summary.totalScanned}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">With Whitespace</div>
                  <div className="text-lg font-bold text-amber-700">{summary.recordsWithWhitespace}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Eligible to Clean</div>
                  <div className="text-lg font-bold text-emerald-700">{summary.recordsEligible}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-600 uppercase">Already Clean</div>
                  <div className="text-lg font-bold text-slate-700">{summary.recordsAlreadyClean}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-rose-700 uppercase">Conflicts Skipped</div>
                  <div className="text-lg font-bold text-rose-700">{summary.recordsSkippedConflict}</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
                  <div className="text-[10px] font-bold text-purple-700 uppercase">Issued Excluded</div>
                  <div className="text-lg font-bold text-purple-700">{summary.recordsSkippedIssued}</div>
                </div>
              </div>

              {/* Informative Banner / Empty State */}
              {summary.recordsWithWhitespace === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle size={32} className="text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-emerald-900">All Non-Issued Serial Numbers Are Clean</h4>
                  <p className="text-xs text-emerald-700 max-w-md mx-auto">
                    No whitespace characters were detected across all {summary.totalScanned} active serial records in the database.
                  </p>
                </div>
              ) : summary.recordsEligible === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>No eligible serial numbers could be cleaned.</strong>
                    <p className="mt-0.5 text-amber-800">
                      {summary.recordsWithWhitespace} record(s) contain whitespace, but all were skipped due to uniqueness collisions or ISSUED status.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
                  <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Ready to clean {summary.recordsEligible} non-issued serial number(s).</strong>
                    <p className="mt-0.5 text-blue-800">
                      Spaces and tabs will be safely removed. All relations, allocations, tags, and lifecycle statuses remain intact.
                    </p>
                  </div>
                </div>
              )}

              {/* Preview Table if whitespace records exist */}
              {rows.length > 0 && (
                <div className="space-y-2">
                  {/* Filter Tabs */}
                  <div className="flex gap-2 border-b border-gray-200 pb-2 text-xs">
                    <button
                      onClick={() => setFilterTab('ALL')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${filterTab === 'ALL' ? 'bg-[#1A2766] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      All Whitespace Rows ({rows.length})
                    </button>
                    <button
                      onClick={() => setFilterTab('ELIGIBLE')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${filterTab === 'ELIGIBLE' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      Eligible ({summary.recordsEligible})
                    </button>
                    <button
                      onClick={() => setFilterTab('CONFLICTS')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${filterTab === 'CONFLICTS' ? 'bg-rose-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      Conflicts & Skipped ({rows.filter(r => !r.isEligible).length})
                    </button>
                  </div>

                  {/* Table */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Current Serial Number</th>
                          <th className="py-2.5 px-3">Proposed Cleaned Serial</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Validation Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono">
                        {displayedRows.map((row, idx) => (
                          <tr key={idx} className={row.isEligible ? 'hover:bg-emerald-50/40 bg-white' : 'bg-rose-50/20'}>
                            <td className="py-2 px-3 font-semibold text-gray-900">
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 tracking-wide">
                                {row.currentSerialNumber}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {row.proposedSerialNumber ? (
                                <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {row.proposedSerialNumber}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-sans">
                              {row.validationResult === 'ELIGIBLE' && (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <Check size={12} /> Ready to Clean
                                </span>
                              )}
                              {row.validationResult === 'CONFLICT_EXISTS' && (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-200" title={row.reason}>
                                  <Ban size={12} /> Collision (Already in DB)
                                </span>
                              )}
                              {row.validationResult === 'CONFLICT_BATCH_DUPLICATE' && (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-200" title={row.reason}>
                                  <Ban size={12} /> Duplicate in Batch
                                </span>
                              )}
                              {row.validationResult === 'SKIPPED_ISSUED' && (
                                <span className="inline-flex items-center gap-1 text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  <Ban size={12} /> Skipped (ISSUED)
                                </span>
                              )}
                              {row.validationResult === 'INVALID_EMPTY' && (
                                <span className="text-rose-700 font-medium">Invalid Empty</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={loadPreview}
                    disabled={isSubmitting}
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    Rescan
                  </button>
                  {summary.recordsEligible > 0 && (
                    <button
                      onClick={handleConfirmClean}
                      disabled={isSubmitting || summary.recordsEligible === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Cleaning Database...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Clean {summary.recordsEligible} Serial Numbers
                        </>
                      )}
                    </button>
                  )}
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
                <h3 className="text-xl font-bold text-gray-900">Serial Cleaning Completed</h3>
                <p className="text-xs text-gray-500 font-mono">Batch ID: {completionData.batchId}</p>
              </div>

              {/* Committed Summary Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 max-w-lg mx-auto space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Total scanned:</span>
                    <span className="font-bold text-gray-900">{completionData.totalScanned}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Records with whitespace:</span>
                    <span className="font-bold text-gray-900">{completionData.recordsWithWhitespace}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Serials corrected:</span>
                    <span className="font-bold text-emerald-700">{completionData.correctedCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Already clean:</span>
                    <span className="font-bold text-slate-700">{completionData.recordsAlreadyClean}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Skipped (ISSUED):</span>
                    <span className="font-bold text-purple-700">{completionData.skippedIssuedCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">Skipped (Conflicts):</span>
                    <span className="font-bold text-rose-700">{completionData.conflictsCount}</span>
                  </div>
                </div>
              </div>

              {/* Inspect Skipped Records Details */}
              {completionData.skippedRecords && completionData.skippedRecords.length > 0 && (
                <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 max-w-lg mx-auto">
                  <button
                    onClick={() => setShowSkippedDetails(!showSkippedDetails)}
                    className="flex justify-between items-center w-full text-xs font-semibold text-gray-700"
                  >
                    <span>Inspect Skipped Records ({completionData.skippedRecords.length})</span>
                    {showSkippedDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showSkippedDetails && (
                    <div className="mt-3 max-h-40 overflow-y-auto space-y-2 text-xs divide-y divide-gray-200 font-mono">
                      {completionData.skippedRecords.map((item: any, idx: number) => (
                        <div key={idx} className="pt-1.5 flex justify-between">
                          <span className="font-semibold text-gray-800">{item.currentSerialNumber || item.serialNumber}</span>
                          <span className="text-rose-600 font-sans">{item.reason}</span>
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

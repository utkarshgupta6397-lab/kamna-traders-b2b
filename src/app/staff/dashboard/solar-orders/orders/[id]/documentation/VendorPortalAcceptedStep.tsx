'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function VendorPortalAcceptedStep({
  canProgress,
  onComplete,
  loading,
  isLoanOrder = false,
  initialAppNumber = '',
  initialLoanAppNumber = ''
}: {
  canProgress: boolean;
  onComplete: (status: string, notes?: string, metaOverride?: any) => Promise<void>;
  loading: boolean;
  isLoanOrder?: boolean;
  initialAppNumber?: string;
  initialLoanAppNumber?: string;
}) {
  const [appNumber, setAppNumber] = useState(initialAppNumber);
  const [loanAppNumber, setLoanAppNumber] = useState(initialLoanAppNumber);
  const [remarks, setRemarks] = useState('');

  const cleanedNumber = appNumber.trim().toUpperCase();
  const isValidAppNumber = /^[A-Z0-9-]{10,40}$/.test(cleanedNumber);

  const cleanedLoanNumber = loanAppNumber.trim();
  const isValidLoanNumber = !isLoanOrder || (cleanedLoanNumber.length >= 5 && cleanedLoanNumber.length <= 100);

  const isValid = isValidAppNumber && isValidLoanNumber;

  return (
    <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Vendor Portal Accepted</h3>
        <p className="text-sm text-gray-500">
          Capture the PM Surya Ghar Application Number {isLoanOrder && 'and Loan Application Number'} to complete this stage.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Application Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={appNumber}
            onChange={(e) => setAppNumber(e.target.value.toUpperCase())}
            placeholder="e.g. NP-UPPAV26-13516408"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm bg-white font-mono"
            disabled={loading || !canProgress}
          />
          {!isValidAppNumber && appNumber.length > 0 && (
            <p className="text-xs text-red-500 mt-1">
              Must be 10-40 characters. Only A-Z, 0-9, and Hyphen (-) allowed.
            </p>
          )}
        </div>

        {isLoanOrder && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Loan Application Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={loanAppNumber}
              onChange={(e) => setLoanAppNumber(e.target.value)}
              placeholder="e.g. LN-2026-458792"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm bg-white font-mono"
              disabled={loading || !canProgress}
            />
            {!isValidLoanNumber && loanAppNumber.length > 0 && (
              <p className="text-xs text-red-500 mt-1">
                Must be between 5 and 100 characters.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarks (Optional)
          </label>
          <textarea
            placeholder="Optional remarks before progressing..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-sm bg-white"
            rows={2}
            disabled={loading || !canProgress}
          />
        </div>
      </div>

      <button
        onClick={() => onComplete('COMPLETED', remarks, { 
          applicationNumber: cleanedNumber,
          ...(isLoanOrder && { loanApplicationNumber: cleanedLoanNumber })
        })}
        disabled={loading || !canProgress || !isValid}
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canProgress && isValid ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
      >
        {loading ? <Loader2 size={22} className="animate-spin" /> : (canProgress && isValid && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
        Complete: Vendor Portal Accepted
      </button>
    </div>
  );
}

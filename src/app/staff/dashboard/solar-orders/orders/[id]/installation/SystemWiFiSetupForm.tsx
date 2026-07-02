'use client';

import { useState, useRef } from 'react';
import { Loader2, CheckCircle2, X, Wifi, Upload, Save, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { getWorkflowStageName } from '@/lib/solar-workflow-config';
import { WorkflowStep } from '../components/WorkflowEngine';

interface SystemWiFiSetupFormProps {
  orderId: string;
  step: WorkflowStep;
  updateStep: (status: string, notes?: string, metaOverride?: any) => Promise<void>;
  canEdit: boolean;
  loadingStep: string | null;
}

const NOT_APPLICABLE_REASONS = [
  'Customer declined WiFi setup',
  'No WiFi available at site',
  'Inverter does not support WiFi',
  'Monitoring not required',
  'Temporary installation',
  'Other'
];

export default function SystemWiFiSetupForm({
  orderId,
  step,
  updateStep,
  canEdit,
  loadingStep,
}: SystemWiFiSetupFormProps) {
  const meta = step.metadata || {};
  const isCompleted = step.status === 'COMPLETED';
  const isNotApplicable = step.status === 'NOT_APPLICABLE';

  const [ssid, setSsid] = useState<string>(step.wifiSsid || meta.ssid || '');
  const [password, setPassword] = useState<string>(step.wifiPassword || meta.password || '');
  const [remarks, setRemarks] = useState<string>(meta.remarks || step.notes || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [showNAModal, setShowNAModal] = useState(false);
  const [naReason, setNaReason] = useState<string>('');
  const [naNotes, setNaNotes] = useState<string>('');

  const silentSave = async (updates: any) => {
    if (!canEdit) return;
    setSaveStatus('saving');
    try {
      const payload = {
        ...meta,
        ssid,
        password,
        remarks,
        ...updates,
        name: getWorkflowStageName(step.workflowType, step.stepKey),
      };
      const res = await fetch(`/api/solar-orders/${orderId}/workflow/${step.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          metadata: payload,
          wifiSsid: ssid,
          wifiPassword: password
        }),
      });
      if (res.ok) setSaveStatus('saved');
      else setSaveStatus('error');
    } catch (e) {
      setSaveStatus('error');
    } finally {
      setTimeout(() => setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev)), 2000);
    }
  };

  const isFormValid = () => {
    return ssid.trim() !== '' && password.trim() !== '';
  };

  const handleSubmit = () => {
    if (!isFormValid()) {
      toast.error('Please provide both SSID and Password.');
      return;
    }
    updateStep('COMPLETED', remarks, { wifiSsid: ssid, wifiPassword: password });
  };

  const handleMarkNotApplicable = () => {
    if (!naReason) {
      toast.error('Please select a reason.');
      return;
    }
    if (naReason === 'Other' && !naNotes.trim()) {
      toast.error('Please provide a reason description.');
      return;
    }
    updateStep('NOT_APPLICABLE', naNotes, { 
      wifiNotApplicableReason: naReason, 
      wifiNotApplicableNotes: naNotes 
    });
    setShowNAModal(false);
  };

  // Completed or Not Applicable view
  if (isCompleted || isNotApplicable) {
    return (
      <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center border-t border-gray-100 h-full">
        <div className={`border rounded-xl p-5 shadow-sm ${isCompleted ? 'bg-[#E5FAFF] border-[#00C2FF]' : 'bg-slate-100 border-slate-300'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md ${isCompleted ? 'bg-[#00C2FF]' : 'bg-slate-500'}`}>
              {isCompleted ? <CheckCircle2 size={24} /> : <Ban size={24} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                WiFi Setup {isCompleted ? 'Completed' : 'Not Applicable'}
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mt-4 p-4 bg-white rounded-lg border border-gray-200">
            {isCompleted ? (
              <>
                <div>
                  <span className="text-gray-500 font-medium block">WiFi Network (SSID)</span>
                  <p className="font-bold text-gray-900 mt-1">{step.wifiSsid || meta.ssid || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium block">WiFi Password</span>
                  <p className="font-bold text-gray-900 mt-1">••••••••••</p>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <span className="text-gray-500 font-medium block">Reason</span>
                <p className="font-bold text-gray-900 mt-1">{meta.wifiNotApplicableReason || step.metadata?.wifiNotApplicableReason || 'N/A'}</p>
                {(meta.wifiNotApplicableNotes || step.metadata?.wifiNotApplicableNotes) && (
                  <p className="text-gray-700 mt-2">{meta.wifiNotApplicableNotes || step.metadata?.wifiNotApplicableNotes}</p>
                )}
              </div>
            )}
            
            {remarks && (
              <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-500 font-medium block">Remarks</span>
                <p className="font-medium text-gray-900 mt-1 whitespace-pre-wrap">{remarks}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col h-full overflow-y-auto">
      <h3 className="text-xl font-bold text-gray-900 mb-4">System WiFi Setup</h3>
      {saveStatus === 'saving' && <p className="text-sm text-gray-500">Saving...</p>}
      {saveStatus === 'saved' && <p className="text-sm text-green-600">Saved</p>}
      {saveStatus === 'error' && <p className="text-sm text-red-600">Save error</p>}

      {/* SSID */}
      <div className="mb-4">
        <label className="block font-bold text-gray-700 mb-1">
          WiFi Name (SSID) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={ssid}
          placeholder="Enter customer's WiFi network name"
          onChange={e => setSsid(e.target.value)}
          onBlur={() => silentSave({ ssid })}
          disabled={!canEdit}
          className="w-full border-2 border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] bg-gray-50 focus:bg-white"
        />
        {!ssid.trim() && <p className="text-xs text-red-500 mt-1">WiFi Name is required.</p>}
      </div>

      {/* Password */}
      <div className="mb-4">
        <label className="block font-bold text-gray-700 mb-1">
          WiFi Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            placeholder="Enter customer's WiFi password"
            onChange={e => setPassword(e.target.value)}
            onBlur={() => silentSave({ password })}
            disabled={!canEdit}
            className="w-full border-2 border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] bg-gray-50 focus:bg-white"
          />
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        {!password.trim() && <p className="text-xs text-red-500 mt-1">WiFi Password is required.</p>}
      </div>

      {/* Remarks */}
      <div className="mb-6">
        <label className="block font-bold text-gray-700 mb-1">Remarks (optional)</label>
        <textarea
          placeholder="Any additional notes..."
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          onBlur={() => silentSave({ remarks })}
          disabled={!canEdit}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] bg-gray-50 focus:bg-white resize-none"
          rows={3}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loadingStep === step.id || !canEdit}
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md ${canEdit ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
      >
        Complete WiFi Setup
      </button>

      {canEdit && (
        <>
          <div className="relative flex items-center py-5">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 font-medium text-sm">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>
          
          <button
            onClick={() => setShowNAModal(true)}
            disabled={loadingStep === step.id}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 font-bold text-base rounded-xl transition-all border-2 border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Mark as Not Applicable
          </button>
        </>
      )}

      {/* NA Modal */}
      {showNAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Mark WiFi Setup as Not Applicable?</h3>
                <button onClick={() => setShowNAModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="mb-4">
                <label className="block font-bold text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={naReason}
                  onChange={e => setNaReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                >
                  <option value="">-- Select Reason --</option>
                  {NOT_APPLICABLE_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {naReason === 'Other' && (
                <div className="mb-4">
                  <label className="block font-bold text-gray-700 mb-1">
                    Reason Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={naNotes}
                    onChange={e => setNaNotes(e.target.value)}
                    placeholder="Provide details..."
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 resize-none"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowNAModal(false)}
                className="flex-1 py-3 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkNotApplicable}
                disabled={loadingStep === step.id}
                className="flex-1 py-3 px-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loadingStep === step.id ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

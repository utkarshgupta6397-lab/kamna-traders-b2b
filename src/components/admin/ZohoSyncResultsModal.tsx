import React, { useState } from 'react';
import { X, CheckCircle2, ShieldAlert, Clock, ChevronDown, ChevronUp, Server, ArrowRight, Copy } from 'lucide-react';

export default function ZohoSyncResultsModal({ 
  isOpen, 
  onClose, 
  logData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  logData: any;
}) {
  const [showRequest, setShowRequest] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  if (!isOpen || !logData) return null;

  const isSuccess = logData.status === 'SUCCESS' || logData.zohoSyncStatus === 'SYNCED';
  const hasTimeline = logData.timeline && Array.isArray(logData.timeline);
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-xl">
          <div className="flex items-center gap-3">
            {isSuccess ? <CheckCircle2 className="text-emerald-500" size={24} /> : <ShieldAlert className="text-red-500" size={24} />}
            <h2 className="text-lg font-bold text-gray-900">Zoho Books Synchronization</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 space-y-6">
          
          {/* Summary Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</div>
                <div className={`text-[13px] font-bold ${isSuccess ? 'text-emerald-700' : 'text-red-700'}`}>
                  {logData.status || logData.zohoSyncStatus}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Trigger Source</div>
                <div className="text-[13px] font-medium text-gray-900">{logData.triggerSource || 'MANUAL_SYNC'}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Zoho Books Item ID</div>
                <div className="text-[13px] font-mono font-medium text-gray-900">{logData.zohoBooksItemId || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Started At</div>
                <div className="text-[13px] font-medium text-gray-900">{logData.startedAt ? new Date(logData.startedAt).toLocaleString() : new Date().toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Completed At</div>
                <div className="text-[13px] font-medium text-gray-900">{logData.completedAt ? new Date(logData.completedAt).toLocaleString() : new Date().toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</div>
                <div className="text-[13px] font-medium text-gray-900 flex items-center gap-1">
                  <Clock size={12} className="text-gray-400" />
                  {logData.durationMs ? `${logData.durationMs}ms` : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Error Panel */}
          {(logData.apiError || logData.error) && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-5 shadow-sm">
              <h3 className="text-[11px] font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-red-100 pb-2">
                <ShieldAlert size={14} /> Exceptions & Errors
              </h3>
              <div className="text-[13px] font-mono text-red-800 whitespace-pre-wrap mt-2 overflow-x-auto">
                {logData.apiError || logData.error}
              </div>
              {((logData.apiError || logData.error)?.toLowerCase().includes('unit')) && (
                <div className="mt-3 bg-red-100 p-3 rounded text-sm text-red-900 flex items-start gap-2">
                  <span className="font-bold shrink-0">Recommendation:</span>
                  <span>Zoho Books rejected the unit. Consider editing the Unit Master and configuring the optional "Zoho Books Unit Name" field to match what Zoho expects (e.g. "Mtr", "Pcs").</span>
                </div>
              )}
            </div>
          )}

          {/* Timeline Section */}
          {hasTimeline && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Execution Timeline</h3>
              <div className="relative pl-3 border-l-2 border-gray-100 space-y-4 py-2">
                {logData.timeline.map((step: any, idx: number) => {
                  let stepColor = 'bg-gray-300 border-gray-300';
                  let textColor = 'text-gray-500';
                  if (step.status === 'success') { stepColor = 'bg-emerald-500 border-emerald-500'; textColor = 'text-gray-900'; }
                  if (step.status === 'error') { stepColor = 'bg-red-500 border-red-500'; textColor = 'text-red-600 font-bold'; }
                  if (step.status === 'pending') { stepColor = 'bg-blue-400 border-blue-400 animate-pulse'; textColor = 'text-blue-600'; }

                  return (
                    <div key={idx} className="relative flex items-center gap-3">
                      <div className={`absolute -left-[17px] w-3 h-3 rounded-full border-2 bg-white ${stepColor}`} />
                      <div className="flex-1 flex justify-between items-center bg-gray-50 px-3 py-2 rounded border border-gray-100">
                        <span className={`text-[13px] ${textColor}`}>{step.step}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(step.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unit Mapping Info */}
          {logData.requestPayload?._unitMapping && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Unit Mapping Resolution</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-4">
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ERP Unit ID</div>
                  <div className="text-[12px] font-mono font-medium text-gray-900">{logData.requestPayload._unitMapping.erpUnitId || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ERP Unit Name</div>
                  <div className="text-[12px] font-medium text-gray-900">{logData.requestPayload._unitMapping.erpUnitName || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ERP Abbreviation</div>
                  <div className="text-[12px] font-medium text-gray-900">{logData.requestPayload._unitMapping.erpAbbreviation || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Zoho Books Unit Name (DB)</div>
                  <div className="text-[12px] font-medium text-gray-900">{logData.requestPayload._unitMapping.zohoBooksUnitName || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Mapping Found</div>
                  <div className="text-[12px] font-medium text-gray-900">{logData.requestPayload._unitMapping.mappingFound ? 'Yes' : 'No'}</div>
                </div>
                
                <div className="col-span-2">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Origin</div>
                  <div className={`text-[11px] px-2 py-0.5 rounded-full inline-block font-semibold ${
                    logData.requestPayload._unitMapping.origin === 'Zoho Mapping' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {logData.requestPayload._unitMapping.origin}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Reason</div>
                  <div className="text-[12px] font-medium text-gray-600">{logData.requestPayload._unitMapping.reason || '-'}</div>
                </div>
                <div className="col-span-1">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Final Sent Value</div>
                  <div className="text-[13px] font-bold text-blue-700">{logData.requestPayload._unitMapping.finalUnitSent || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Request Payload */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button 
              onClick={() => setShowRequest(!showRequest)}
              className="w-full px-5 py-3 bg-gray-50/80 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <Server size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Request Payload</h3>
              </div>
              {showRequest ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {showRequest && (
              <div className="p-4 border-t border-gray-100 bg-[#1E1E1E]">
                <pre className="text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                  {logData.requestPayload ? JSON.stringify(logData.requestPayload, null, 2) : 'No payload'}
                </pre>
              </div>
            )}
          </div>

          {/* Response Payload */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button 
              onClick={() => setShowResponse(!showResponse)}
              className="w-full px-5 py-3 bg-gray-50/80 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <ArrowRight size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Response JSON</h3>
              </div>
              {showResponse ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {showResponse && (
              <div className="p-4 border-t border-gray-100 bg-[#1E1E1E]">
                <pre className="text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                  {logData.responsePayload ? JSON.stringify(logData.responsePayload, null, 2) : 'No response'}
                </pre>
              </div>
            )}
          </div>

        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-between items-center">
          <button
            onClick={() => {
              const report = [
                '# Zoho Books Sync Debug Report',
                `- Status: ${logData.status || logData.zohoSyncStatus}`,
                `- Trigger Source: ${logData.triggerSource || 'MANUAL_SYNC'}`,
                `- Zoho Books Item ID: ${logData.zohoBooksItemId || '-'}`,
                `- Started At: ${logData.startedAt ? new Date(logData.startedAt).toISOString() : ''}`,
                `- Duration: ${logData.durationMs || 0}ms`,
                '',
                '## Exception',
                '```text',
                logData.apiError || logData.error || 'None',
                '```',
                '',
                '## Execution Timeline',
                '```json',
                JSON.stringify(logData.timeline || [], null, 2),
                '```',
                '',
                '## Request Payload',
                '```json',
                JSON.stringify(logData.requestPayload || {}, null, 2),
                '```',
                '',
                '## Response Data',
                '```json',
                JSON.stringify(logData.responsePayload || {}, null, 2),
                '```'
              ].join('\n');
              
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(report);
                alert('Debug report copied to clipboard');
              } else {
                const textArea = document.createElement("textarea");
                textArea.value = report;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand('copy');
                  alert('Debug report copied to clipboard');
                } catch (err) {
                  alert('Failed to copy. Please manually copy the report.');
                }
                document.body.removeChild(textArea);
              }
            }}
            className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <Copy size={16} /> Copy Debug Report
          </button>
          
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, Download, Eye, AlertCircle, X } from 'lucide-react';
import { getWorkflowStageName } from '@/lib/solar-workflow-config';

interface DocumentationApprovalStageProps {
  order: any;
  steps: any[];
  selectedStep: any;
  onApprove: () => void;
  onRequestCorrections: (targetStepId: string, remarks: string) => void;
  canApprove: boolean;
  loadingStep: string | null;
}

export default function DocumentationApprovalStage({
  order,
  steps,
  selectedStep,
  onApprove,
  onRequestCorrections,
  canApprove,
  loadingStep
}: DocumentationApprovalStageProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);
  const [selectedCorrectionStepIds, setSelectedCorrectionStepIds] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const getDynamicFields = (orderObj: any) => {
    const ignoreKeys = ['id', 'createdAt', 'updatedAt', 'zohoSalesOrderId', 'vendorId', 'salesmanId', 'callingExecutiveId', 'subVendorId'];
    const fields: { label: string, value: any }[] = [];
    
    for (const [key, value] of Object.entries(orderObj)) {
      if (ignoreKeys.includes(key) || value === null || value === undefined || value === '') continue;
      
      // Skip objects and arrays (relations like files, steps, etc.)
      if (typeof value === 'object') continue;
      
      let displayValue = value;
      if (typeof value === 'boolean') {
        displayValue = value ? 'Yes' : 'No';
      } else if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('price')) {
        displayValue = `₹${Number(value).toLocaleString('en-IN')}`;
      } else if (key.toLowerCase().includes('date') || value instanceof Date) {
        displayValue = new Date(value as any).toLocaleDateString('en-IN');
      }
      
      fields.push({ label: formatLabel(key), value: displayValue });
    }
    
    return fields;
  };


  const stepName = getWorkflowStageName(selectedStep.workflowType, selectedStep.stepKey);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/solar-orders/${order.id}/files`);
        const data = await res.json();
        if (res.ok && data.files) {
          setFiles(data.files);
        }
      } catch (err) {
        console.error('Error fetching files:', err);
      } finally {
        setLoadingFiles(false);
      }
    };
    fetchFiles();
  }, [order.id]);

  // Determine which previous steps to show based on the current approval stage
  const getReviewableStepKeys = () => {
    if (stepName === 'Review & Approval') return ['DOC_1', 'DOC_2', 'DOC_3'];
    if (stepName === 'Review Pending') return ['DOC_5', 'DOC_6'];
    if (stepName === 'File Upload Approval Pending') return ['DOC_8', 'DOC_9', 'DOC_10'];
    return [];
  };

  const reviewableKeys = getReviewableStepKeys();
  const reviewableSteps = steps.filter(s => reviewableKeys.includes(s.stepKey)).sort((a, b) => a.stepIndex - b.stepIndex);

  const getFilesForStep = (stepKey: string) => {
    // Map step to file categories
    const categoryMap: Record<string, string[]> = {
      'DOC_1': ['DOCUMENTATION'],
      'DOC_5': ['DOCUMENTATION_NOTARISED'],
      'DOC_6': ['DOCUMENTATION_CUSTOMER_SIGNATURE'],
      'DOC_8': ['DOCUMENTATION_AUTHORITY_SIGNATURE'],
      'DOC_9': ['DOCUMENTATION_COMPANY_STAMP'],
      'DOC_10': ['DCR_CERTIFICATE']
    };
    const categories = categoryMap[stepKey];
    if (!categories) return [];
    
    // For DOC_1, it contains many types. The uploader saves with fileCategory='DOCUMENTATION'
    return files.filter(f => categories.includes(f.fileCategory));
  };

  const handleCorrectionSubmit = () => {
    if (!remarks.trim() || selectedCorrectionStepIds.length === 0) return;
    
    // Find the earliest step selected
    const selectedStepsData = steps.filter(s => selectedCorrectionStepIds.includes(s.id));
    selectedStepsData.sort((a, b) => a.stepIndex - b.stepIndex);
    const earliestStep = selectedStepsData[0];
    
    if (earliestStep) {
      onRequestCorrections(earliestStep.id, remarks);
    }
  };

  const toggleCorrectionStep = (stepId: string) => {
    setSelectedCorrectionStepIds(prev => 
      prev.includes(stepId) ? prev.filter(id => id !== stepId) : [...prev, stepId]
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
      <div className="p-6 md:p-8 flex-1 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Review Previous Stages</h3>
          <p className="text-sm text-gray-500">
            Please review the data from the preceding stages before making a decision.
          </p>
        </div>

        <div className="space-y-6">
          {reviewableSteps.map(step => {
            const name = getWorkflowStageName(step.workflowType, step.stepKey);
            const stepFiles = getFilesForStep(step.stepKey);
            
            return (
              <div key={step.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                  <h4 className="font-bold text-gray-800 text-sm">{name}</h4>
                  <div className="text-xs text-gray-500 mt-1 flex gap-3">
                    <span>Completed: {step.completedAt ? new Date(step.completedAt).toLocaleString() : 'N/A'}</span>
                    <span>By: {step.completedBy?.name || 'System'}</span>
                  </div>
                </div>
                
                <div className="p-4 space-y-4 text-sm text-gray-700">
                  {/* Step 1 specifics */}
                  {step.stepKey === 'DOC_1' && (
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                      {order.loanCustomer && (
                        <>
                          <div className="font-medium text-gray-500">Loan Quotation Amount:</div>
                          <div>₹{order.loanAmount?.toLocaleString('en-IN')}</div>
                          <div className="font-medium text-gray-500">Annual Income:</div>
                          <div>₹{order.annualIncome?.toLocaleString('en-IN') || 'N/A'}</div>
                        </>
                      )}
                      {order.customerEmail && (
                        <>
                          <div className="font-medium text-gray-500">Customer Email:</div>
                          <div>{order.customerEmail}</div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Step 2 specifics - Dynamic Rendering */}
                  {step.stepKey === 'DOC_2' && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-4">
                      {getDynamicFields(order).map((field, idx) => (
                        <div key={idx} className="flex flex-col">
                          <span className="font-medium text-gray-500 text-xs mb-0.5">{field.label}</span>
                          <span className="text-gray-900 break-words">{String(field.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step 3 specifics */}
                  {step.stepKey === 'DOC_3' && (
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                      <div className="font-medium text-gray-500">Application Number:</div>
                      <div className="font-mono bg-gray-100 px-1 rounded">{order.applicationNumber || 'N/A'}</div>
                      {order.loanApplicationNumber && (
                        <>
                          <div className="font-medium text-gray-500">Loan App Number:</div>
                          <div className="font-mono bg-gray-100 px-1 rounded">{order.loanApplicationNumber}</div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Remarks */}
                  {step.notes && (
                    <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100 text-orange-900 mt-2">
                      <span className="font-bold text-xs uppercase tracking-wider block mb-1 text-orange-600">Remarks</span>
                      {step.notes}
                    </div>
                  )}

                  {/* Files list */}
                  {stepFiles.length > 0 && (
                    <div className="mt-3">
                      <span className="font-bold text-xs uppercase tracking-wider block mb-2 text-gray-500">Uploaded Documents</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {stepFiles.map(file => (
                          <div key={file.id} className="flex flex-col p-2 border border-gray-100 rounded bg-gray-50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate pr-2" title={file.documentType || file.fileName}>{file.documentType || file.fileName}</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setPreviewFile(file)}
                                  className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1 rounded transition-colors flex flex-row items-center gap-1 px-2" 
                                  title="View"
                                >
                                  <Eye size={14} />
                                  <span className="text-[10px] font-bold">View</span>
                                </button>
                                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-800 bg-gray-100 p-1 rounded transition-colors flex flex-row items-center gap-1 px-2" title="Download">
                                  <Download size={14} />
                                  <span className="text-[10px] font-bold">Download</span>
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="text-[10px] text-gray-400">
                                 {new Date(file.uploadedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                               </div>
                            </div>
                            {file.metadata?.phone && (
                              <div className="text-[10px] text-gray-500 font-mono">
                                Phone: {file.metadata.phone}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {stepFiles.length === 0 && loadingFiles && (
                    <div className="text-xs text-gray-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Loading files...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 md:p-8 bg-white border-t border-gray-200 shrink-0">
        <div className="flex flex-col gap-3">
          {canApprove ? (
            <button
              onClick={onApprove}
              disabled={loadingStep === selectedStep.id}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 border border-green-700 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md disabled:opacity-50"
            >
              {loadingStep === selectedStep.id ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
              Approve Stage
            </button>
          ) : (
             <button disabled className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 text-gray-500 font-bold rounded-xl cursor-not-allowed border border-gray-300" title="You don't have permission to progress this workflow.">
               Waiting for Administrator
             </button>
          )}
          
          {canApprove && (
            <button
              onClick={() => {
                setSelectedCorrectionStepIds([]);
                setRemarks('');
                setShowCorrectionsModal(true);
              }}
              disabled={loadingStep === selectedStep.id}
              className="w-full px-6 py-3 bg-white border-2 border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-50"
            >
              Request Corrections
            </button>
          )}
        </div>
      </div>

      {showCorrectionsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-orange-50/50">
              <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-500" />
                Request Corrections
              </h3>
              <button onClick={() => setShowCorrectionsModal(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 border border-gray-200">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 bg-gray-50/30 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Select Stages for Correction <span className="text-orange-500">*</span>
                </label>
                <div className="space-y-2">
                  {reviewableSteps.map(step => (
                    <label key={step.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-white cursor-pointer hover:border-orange-300 transition-colors">
                      <div className="mt-0.5">
                        <input 
                          type="checkbox" 
                          checked={selectedCorrectionStepIds.includes(step.id)}
                          onChange={() => toggleCorrectionStep(step.id)}
                          className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800">{getWorkflowStageName(step.workflowType, step.stepKey)}</div>
                        <div className="text-xs text-gray-500">Completed by {step.completedBy?.name || 'System'}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Remarks / Issues <span className="text-orange-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g., Cancelled cheque is blurry, please re-upload."
                  className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all min-h-[100px] resize-none bg-white"
                />
              </div>

              <div className="bg-orange-50 text-orange-800 text-xs p-3 rounded-lg border border-orange-100">
                <strong>Notice:</strong> The workflow will roll back to the earliest selected stage. All subsequent stages will be locked until they are completed again.
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowCorrectionsModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCorrectionSubmit}
                disabled={loadingStep === selectedStep.id || !remarks.trim() || selectedCorrectionStepIds.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-orange-600 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {loadingStep === selectedStep.id && <Loader2 size={16} className="animate-spin" />}
                Rollback & Request Corrections
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 md:p-8 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 truncate pr-4">
                {previewFile.documentType || previewFile.fileName}
              </h3>
              <div className="flex items-center gap-3">
                <a 
                  href={previewFile.fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors"
                >
                  <Download size={16} />
                  Download
                </a>
                <button 
                  onClick={() => setPreviewFile(null)} 
                  className="text-gray-500 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 relative overflow-hidden flex items-center justify-center p-4">
              {previewFile.fileUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={previewFile.fileUrl} 
                  className="w-full h-full rounded-lg shadow-sm border border-gray-300 bg-white"
                  title="PDF Preview"
                />
              ) : previewFile.fileUrl.toLowerCase().endsWith('.heic') ? (
                <div className="flex flex-col items-center justify-center text-gray-500 gap-4">
                  <AlertCircle size={48} className="text-gray-400" />
                  <div className="text-center">
                    <p className="font-bold text-gray-700">HEIC preview not supported in browser</p>
                    <p className="text-sm">Please download the file to view it.</p>
                  </div>
                  <a href={previewFile.fileUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-sm">
                    Download File
                  </a>
                </div>
              ) : (
                <img 
                  src={previewFile.fileUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import React from 'react';
import { X } from 'lucide-react';
import WorkflowDocumentUploader from './WorkflowDocumentUploader';

interface CancelledChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  canProgress: boolean;
  onUploadComplete: () => void;
}

export function CancelledChequeModal({ isOpen, onClose, order, canProgress, onUploadComplete }: CancelledChequeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Upload Cancelled Cheque / Passbook</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-6">
            This document was optional during the initial document upload. 
            It is now required before the documentation can proceed to Final File Approval. 
            <br/><br/>
            Please upload either:<br/>
            • Cancelled Cheque<br/>
            OR<br/>
            • Bank Passbook
          </p>
          
          <div className="bg-white p-0 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <WorkflowDocumentUploader
              order={order}
              requirements={[
                {
                  type: 'CANCELLED_CHEQUE',
                  label: 'Cancelled Cheque / Passbook',
                  required: true,
                  maxMb: 2,
                  acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.heic']
                }
              ]}
              canProgress={canProgress}
              onComplete={onUploadComplete}
              isEditMode={true}
              submitButtonText="Save & Continue"
            />
          </div>
        </div>
        
      </div>
    </div>
  );
}

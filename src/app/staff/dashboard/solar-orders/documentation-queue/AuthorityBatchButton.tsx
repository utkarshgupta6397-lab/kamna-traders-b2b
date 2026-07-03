'use client';

import { useState } from 'react';
import { FileText, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuthorityBatchButtonProps {
  eligibleCount?: number;
}

export default function AuthorityBatchButton({ eligibleCount = 0 }: AuthorityBatchButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/solar-orders/documentation-dashboard/authority-batch');
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate PDF');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Authority_Approval_Sheet_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setShowModal(false);
      toast.success('Batch Approval Sheet generated successfully');
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="relative group">
        <button
          onClick={() => setShowModal(true)}
          disabled={eligibleCount === 0}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1A2766] text-white rounded-md text-[13px] font-medium hover:bg-[#1A2766]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto shadow-sm"
        >
          <FileText size={14} />
          Generate Authority Approval Sheet
        </button>
        {eligibleCount === 0 && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-2 bg-gray-900 text-white text-[11px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            No orders are currently waiting for Authority Signature approval.
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Generate Authority Approval Batch</h3>
              <button 
                onClick={() => !isGenerating && setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
                disabled={isGenerating}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-600 leading-relaxed">
                This will generate a printable approval sheet containing all orders currently eligible for Authority Signature.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                The sheet should be reviewed and signed internally before taking customer files for the Proprietor's signature.
              </p>
              
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
                <span className="font-medium text-blue-900">Eligible Orders</span>
                <span className="text-2xl font-bold text-blue-600">{eligibleCount}</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isGenerating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1A2766] border border-transparent rounded-lg hover:bg-[#1A2766]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A2766] disabled:opacity-75 min-w-[140px] justify-center"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate PDF'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface RollbackConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, cascade: boolean) => Promise<void>;
  stageName: string;
  hasSubsequentCompletedStages: boolean;
}

export default function RollbackConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  stageName,
  hasSubsequentCompletedStages
}: RollbackConfirmationModalProps) {
  const [reason, setReason] = useState('');
  const [cascade, setCascade] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    await onConfirm(reason, cascade);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Rollback Workflow Stage</h2>
            <p className="text-sm text-gray-500 mt-1">You are about to rollback <span className="font-bold text-gray-800">{stageName}</span></p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-gray-900">This action will:</p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
              <li>Mark this stage as <strong>Pending</strong></li>
              <li>Nullify stage-specific data captured during completion</li>
              <li>Reopen this workflow step for execution</li>
              <li>Preserve complete audit history of this action</li>
            </ul>
            <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100 mt-2">
              This action cannot be undone automatically.
            </p>
          </div>

          {hasSubsequentCompletedStages && (
            <div className="mb-6 p-4 rounded-xl border border-orange-200 bg-orange-50">
              <h4 className="text-sm font-bold text-orange-900 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-orange-600" />
                Downstream Stages Detected
              </h4>
              <p className="text-xs text-orange-800 mb-3">
                This workflow has completed stages after this point. Choose your rollback mode:
              </p>
              
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors bg-white hover:border-orange-300 border-gray-200">
                  <input
                    type="radio"
                    name="rollbackMode"
                    className="mt-1"
                    checked={!cascade}
                    onChange={() => setCascade(false)}
                    disabled={isSubmitting}
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">Rollback only this stage</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Subsequent stages remain untouched.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors bg-white hover:border-orange-300 border-gray-200">
                  <input
                    type="radio"
                    name="rollbackMode"
                    className="mt-1"
                    checked={cascade}
                    onChange={() => setCascade(true)}
                    disabled={isSubmitting}
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">Cascade Rollback</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Rollback this stage AND every completed stage after it.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Rollback <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong document uploaded, accidental completion..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none shadow-sm"
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-600/20"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Rollback Stage
          </button>
        </div>
      </div>
    </div>
  );
}

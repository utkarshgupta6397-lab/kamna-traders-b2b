import React from 'react';
import { MasterRecord, MasterConfig } from './types';
import { X, History, User, Clock, Tag } from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: MasterRecord | null;
  config: MasterConfig;
}

export default function HistoryDrawer({ isOpen, onClose, record, config }: HistoryDrawerProps) {
  if (!isOpen || !record) return null;

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATED': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'UPDATED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'SUBMITTED': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DECLINED': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ARCHIVED': return 'bg-red-50 text-red-700 border-red-200';
      case 'RESTORED': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const historyList = record.history || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#1A2766]/10 text-[#1A2766]">
                <History size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Audit History</h2>
                <p className="text-xs text-gray-500 font-mono">{record.name} ({record.code || record.id})</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
              <X size={18} />
            </button>
          </div>

          {/* Timeline Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {historyList.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No audit events recorded for this entity.
              </div>
            ) : (
              <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                {historyList.map((h, idx) => (
                  <div key={h.id || idx} className="relative pl-6">
                    {/* Dot */}
                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#1A2766]"></div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getActionColor(h.action)}`}>
                          {h.action}
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {formatDate(h.performedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                        <User size={13} className="text-gray-400" />
                        <span>{h.performedBy?.name || 'System'}</span>
                      </div>

                      {h.previousValue && h.newValue && (
                        <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded border border-gray-200 space-y-1">
                          <div><span className="text-red-500 font-semibold">- Previous:</span> {h.previousValue}</div>
                          <div><span className="text-emerald-600 font-semibold">+ New:</span> {h.newValue}</div>
                        </div>
                      )}

                      {h.remarks && (
                        <div className="text-xs text-gray-500 italic bg-white/60 px-2 py-1 rounded border border-gray-100">
                          "{h.remarks}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium"
            >
              Close History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

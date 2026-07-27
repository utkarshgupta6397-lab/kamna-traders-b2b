import React, { useState, useEffect } from 'react';
import { MasterRecord, MasterConfig } from './types';
import { X, History, User, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: MasterRecord | null;
  config: MasterConfig;
}

interface AuditChange {
  field: string;
  oldValue: string;
  newValue: string;
}

function getFieldName(key: string): string {
  const mapping: Record<string, string> = {
    name: 'Name',
    code: 'Code',
    description: 'Description',
    status: 'Status',
    remarks: 'Remarks',
    isActive: 'Active Status',
    active: 'Active Status',
    percentage: 'Tax Percentage',
    taxType: 'Tax Type',
    abbreviation: 'Display Abbreviation',
    defaultGstRateId: 'Default GST Rate',
    chapterCode: 'Chapter Code',
  };
  return mapping[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

function parseValue(val: string): any {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

function formatValue(val: any): string {
  if (val === undefined || val === null) return '(None)';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.map(formatValue).join(', ') || '(Empty List)';
    if (val.name) return String(val.name);
    if (val.title) return String(val.title);
    if (val.code) return String(val.code);
    if (val.id) return String(val.id);
    return '(Complex Data)';
  }
  return String(val);
}

function computeDiff(prev: string | null, next: string | null): AuditChange[] {
  if (!next) return [];
  const prevObj = prev ? parseValue(prev) : {};
  const nextObj = parseValue(next);

  if (!nextObj || typeof nextObj !== 'object') {
    return [{ field: 'Value', oldValue: formatValue(prev), newValue: formatValue(next) }];
  }

  const diffs: AuditChange[] = [];
  const keys = Array.from(new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]));
  
  const systemKeys = [
    'updatedAt', 'createdAt', 'approvedAt', 
    'createdById', 'updatedById', 'approvedById', 
    'createdBy', 'updatedBy', 'approvedBy',
    'id', 'version', 'history', 'companyId'
  ];

  for (const k of keys) {
    if (systemKeys.includes(k)) continue;
    if (k.endsWith('Id') && keys.includes(k.replace(/Id$/, ''))) continue;

    const oldVal = prevObj[k];
    const newVal = nextObj[k];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: getFieldName(k),
        oldValue: formatValue(oldVal),
        newValue: formatValue(newVal),
      });
    }
  }

  return diffs;
}

function HistoryEventCard({ h }: { h: any }) {
  const [expanded, setExpanded] = useState(false);
  const diffs = computeDiff(h.previousValue, h.newValue);
  const isLargeChange = diffs.length > 5;
  const visibleDiffs = expanded ? diffs : diffs.slice(0, 5);

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

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATED': return 'Created';
      case 'UPDATED': return 'Updated';
      case 'SUBMITTED': return 'Submitted for Approval';
      case 'APPROVED': return 'Approved (Legacy)';
      case 'ACTIVATED': return 'Activated';
      case 'DECLINED': return 'Declined';
      case 'ARCHIVED': return 'Archived';
      case 'RESTORED': return 'Reactivated';
      default: return action;
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

  return (
    <div className="relative pl-6">
      <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#1A2766]"></div>
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getActionColor(h.action)}`}>
            {getActionLabel(h.action)}
          </span>
          <span className="text-[11px] text-gray-400 font-mono">
            {formatDate(h.performedAt)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
          <User size={13} className="text-gray-400" />
          <span>{h.performedBy?.name || 'System'}</span>
        </div>

        {diffs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {visibleDiffs.map((d, index) => (
              <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-2 bg-white rounded border border-gray-150 gap-2">
                <span className="font-semibold text-gray-700 sm:w-1/4">{d.field}</span>
                <div className="flex flex-1 items-center gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 font-mono text-[11px] line-through">
                    {d.oldValue}
                  </span>
                  <ArrowRight size={12} className="text-gray-400" />
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono text-[11px]">
                    {d.newValue}
                  </span>
                </div>
              </div>
            ))}

            {isLargeChange && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#1A2766] hover:text-[#152052] transition-colors pt-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp size={14} /> Collapse {diffs.length - 5} changes
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Expand {diffs.length - 5} more changes
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {h.remarks && (
          <div className="text-xs text-gray-500 italic bg-white/60 px-2 py-1 rounded border border-gray-100">
            "{h.remarks}"
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryDrawer({ isOpen, onClose, record, config }: HistoryDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  const historyList = record.history || [];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col h-full">
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
                  <HistoryEventCard key={h.id || idx} h={h} />
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

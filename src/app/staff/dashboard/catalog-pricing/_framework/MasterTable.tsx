import React, { useMemo, useState } from 'react';
import { MasterRecord, MasterConfig } from './types';
import MasterStatusBadge from './MasterStatusBadge';
import { getRecordAuthorization } from './authorization';
import { Eye, Edit2, Send, CheckCircle2, XCircle, History, Archive, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface MasterTableProps {
  records: MasterRecord[];
  config: MasterConfig;
  loading: boolean;
  page: number;
  totalPages: number;
  totalRecords: number;
  limit: number | 'all';
  onPageChange: (newPage: number) => void;
  onLimitChange: (limit: number | 'all') => void;
  onViewEdit: (record: MasterRecord) => void;
  onSubmit: (record: MasterRecord) => void;
  onApprove: (record: MasterRecord) => void;
  onDecline: (record: MasterRecord) => void;
  onHistory: (record: MasterRecord) => void;
  onArchive: (record: MasterRecord) => void;
  onReactivate?: (record: MasterRecord) => void;
  onDeactivate?: (record: MasterRecord) => void;
  canCreate: boolean;
  canModify: boolean;
  canApprove: boolean;
  onRefresh?: () => void;
}

interface ColumnSchema {
  id: string;
  label: string;
  width: string;
  align?: 'left' | 'center' | 'right';
  condition?: (entityKey: string) => boolean;
  renderCell: (record: MasterRecord, index: number, page: number, limit: number | 'all') => React.ReactNode;
}

export default function MasterTable(props: MasterTableProps) {
  const {
    records,
    config,
    loading,
    page,
    totalPages,
    totalRecords,
    limit,
    onPageChange,
    onLimitChange,
    onViewEdit,
    onSubmit,
    onApprove,
    onDecline,
    onHistory,
    onArchive,
    onReactivate,
    onDeactivate,
    canCreate,
    canModify,
    canApprove,
  } = props;

  const [togglingDecimalId, setTogglingDecimalId] = useState<string | null>(null);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return <span className="text-gray-400">-</span>;
    const date = new Date(dateStr);
    const d = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const t = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="flex flex-col leading-tight gap-0.5">
        <span className="font-medium text-gray-800 text-[11px] uppercase tracking-wide">{d}</span>
        <span className="text-[10px] text-gray-500 font-mono">{t}</span>
      </div>
    );
  };

  const schema: ColumnSchema[] = useMemo(() => [
    {
      id: 'index',
      label: '#',
      width: 'w-[60px]',
      renderCell: (_, index, p, l) => (
        <span className="font-mono text-xs text-gray-500 font-medium">
          {l === 'all' ? index + 1 : (p - 1) * (l as number) + index + 1}
        </span>
      )
    },
    {
      id: 'code',
      label: 'Code',
      width: 'w-[120px]',
      renderCell: (r) => <span className="font-mono text-xs font-semibold text-gray-900">{r.code || '-'}</span>
    },
    {
      id: 'name',
      label: 'Name',
      width: 'w-[320px]',
      renderCell: (r) => (
        <div className={`font-medium text-gray-900 text-sm leading-tight ${config.entityKey === 'categories' && r.parentId ? 'pl-8' : ''}`}>
          {config.entityKey === 'categories' && r.parentId ? <span className="text-gray-400 mr-1.5 font-normal">↳</span> : null}
          {r.name}
        </div>
      )
    },
    {
      id: 'parentCategory',
      label: 'Parent Category',
      width: 'w-[200px]',
      condition: (key) => key === 'categories',
      renderCell: (r) => <span className="text-gray-600">{r.parent?.name || '-'}</span>
    },
    {
      id: 'productsMapped',
      label: 'Products Mapped',
      width: 'w-[90px]',
      align: 'center',
      renderCell: (r) => (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold text-[11px] px-1.5 py-0.5">
          {r.productsMappedCount || 0}
        </span>
      )
    },
    {
      id: 'taxPercent',
      label: 'Tax %',
      width: 'w-[100px]',
      condition: (key) => key === 'tax-rates',
      renderCell: (r) => <span className="font-medium text-gray-800">{r.percentage}% ({r.taxType || 'GST'})</span>
    },
    {
      id: 'abbr',
      label: 'Abbr',
      width: 'w-[100px]',
      condition: (key) => key === 'units',
      renderCell: (r) => <span className="text-gray-600">{r.abbreviation || '-'}</span>
    },
    {
      id: 'isDecimal',
      label: 'Is Decimal',
      width: 'w-[130px]',
      align: 'center',
      condition: (key) => key === 'units',
      renderCell: (r) => {
        const isDecimal = Boolean(r.is_decimal);
        const { canEdit } = getRecordAuthorization(r, { canCreate, canModify, canApprove });
        const isToggling = togglingDecimalId === r.id;

        return (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={!canEdit || isToggling}
              onClick={async (e) => {
                e.stopPropagation();
                if (!canEdit || isToggling) return;
                setTogglingDecimalId(r.id);
                try {
                  const res = await fetch(`/api/staff/catalog/units/${r.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_decimal: !isDecimal })
                  });
                  const resData = await res.json();
                  if (!res.ok) {
                    throw new Error(resData.error || 'Failed to update decimal precision');
                  }
                  toast.success(`Unit ${r.name}: Decimal precision ${!isDecimal ? 'ENABLED (Up to 2 decimals)' : 'DISABLED (Integers only)'}`);
                  if (props.onRefresh) props.onRefresh();
                } catch (err: any) {
                  toast.error(err.message || 'Error updating decimal precision');
                } finally {
                  setTogglingDecimalId(null);
                }
              }}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isDecimal ? 'bg-emerald-600' : 'bg-slate-300'
              } ${!canEdit || isToggling ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              title={canEdit ? (isDecimal ? 'Click to disable decimals (whole numbers only)' : 'Click to enable decimals (up to 2 decimal places)') : 'Read-only'}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isDecimal ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[11px] font-semibold ${isDecimal ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isDecimal ? 'Yes (.00)' : 'No'}
            </span>
          </div>
        );
      }
    },
    {
      id: 'zohoBooksUnitName',
      label: 'Zoho Unit',
      width: 'w-[120px]',
      condition: (key) => key === 'units',
      renderCell: (r) => (
        r.zohoBooksUnitName ? (
          <div className="flex flex-col gap-1 items-start">
            <span className="text-gray-900 font-medium">{r.zohoBooksUnitName}</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-sm font-semibold tracking-wide uppercase">Mapped</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 items-start">
            <span className="text-gray-400">-</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-sm font-semibold tracking-wide uppercase">Default</span>
          </div>
        )
      )
    },
    {
      id: 'gstRate',
      label: 'GST Rate',
      width: 'w-[100px]',
      condition: (key) => key === 'hsn-codes',
      renderCell: (r) => <span className="text-gray-600">{r.defaultGstRate?.percentage ? `${r.defaultGstRate.percentage}%` : '-'}</span>
    },
    {
      id: 'status',
      label: 'Status',
      width: 'w-[120px]',
      renderCell: (r) => <MasterStatusBadge status={r.status} />
    },
    {
      id: 'zohoBooksIntraTaxId',
      label: 'Intra-State Tax ID',
      width: 'w-[150px]',
      condition: (key) => key === 'tax-rates',
      renderCell: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-gray-700">{r.zohoBooksIntraTaxId || '-'}</span>
        </div>
      )
    },
    {
      id: 'zohoBooksInterTaxId',
      label: 'Inter-State Tax ID',
      width: 'w-[150px]',
      condition: (key) => key === 'tax-rates',
      renderCell: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-gray-700">{r.zohoBooksInterTaxId || '-'}</span>
          {!r.zohoBooksInterTaxId && (
            <span className="text-red-500" title="Missing Inter-State Tax ID. Sync will fail.">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </span>
          )}
        </div>
      )
    },
    {
      id: 'createdBy',
      label: 'Created By',
      width: 'w-[120px]',
      renderCell: (r) => <span className="text-[11px] font-medium text-gray-700">{r.createdBy?.name || 'System'}</span>
    },
    {
      id: 'createdAt',
      label: 'Created At',
      width: 'w-[120px]',
      renderCell: (r) => formatDateTime(r.createdAt)
    },
    {
      id: 'updatedBy',
      label: 'Updated By',
      width: 'w-[120px]',
      renderCell: (r) => <span className="text-[11px] font-medium text-gray-700">{r.updatedBy?.name || '-'}</span>
    },
    {
      id: 'updatedAt',
      label: 'Updated At',
      width: 'w-[120px]',
      renderCell: (r) => formatDateTime(r.updatedAt)
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 'w-[120px]',
      align: 'right',
      renderCell: (r) => {
        const { canEdit, canSubmit, canApproveAction, canArchive } = getRecordAuthorization(r, { canCreate, canModify, canApprove });
        return (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => onViewEdit(r)} className="p-1.5 text-gray-500 hover:text-[#1A2766] hover:bg-gray-100 rounded-md transition-colors" title={canEdit ? 'Edit Record' : 'View Record'}>
              {canEdit ? <Edit2 size={15} /> : <Eye size={15} />}
            </button>
            {canSubmit && (
              <button onClick={() => onSubmit(r)} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors" title="Submit for Approval">
                <Send size={15} />
              </button>
            )}
            {canApproveAction && (
              <>
                <button onClick={() => onApprove(r)} className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors" title="Approve Record">
                  <CheckCircle2 size={15} />
                </button>
                <button onClick={() => onDecline(r)} className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors" title="Decline Record">
                  <XCircle size={15} />
                </button>
              </>
            )}
            {r.status === 'Inactive' && canModify && onReactivate && (
              <button onClick={() => onReactivate(r)} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors" title="Reactivate Record">
                <RotateCcw size={15} />
              </button>
            )}
            {r.status === 'Active' && canModify && onDeactivate && (
              <button onClick={() => onDeactivate(r)} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors" title="Mark Inactive">
                <XCircle size={15} />
              </button>
            )}
            {canArchive && (
              <button onClick={() => onArchive(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Archive Record">
                <Archive size={15} />
              </button>
            )}
            <button onClick={() => onHistory(r)} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" title="View Audit History">
              <History size={15} />
            </button>
          </div>
        );
      }
    }
  ], [config.entityKey, canCreate, canModify, canApprove]);

  const activeColumns = useMemo(() => {
    return schema.filter(col => !col.condition || col.condition(config.entityKey));
  }, [schema, config.entityKey]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse table-fixed min-w-max">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-white z-10">
              {activeColumns.map(col => (
                <th key={col.id} className={`py-2 px-3 ${col.width} ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {loading ? (
              <tr>
                <td colSpan={activeColumns.length} className="py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#1A2766] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs">Loading {config.title.toLowerCase()}...</span>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length} className="py-12 text-center text-gray-400">
                  No {config.title.toLowerCase()} found matching the current filters.
                </td>
              </tr>
            ) : (
              records.map((r, index) => {
                const cells = activeColumns.map(col => (
                  <td key={col.id} className={`py-2 px-3 ${col.width} ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.renderCell(r, index, page, limit)}
                  </td>
                ));
                
                if (cells.length !== activeColumns.length) {
                  console.warn(`Row cell count (${cells.length}) does not match header count (${activeColumns.length})`);
                }

                return (
                  <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                    {cells}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-200 flex items-center justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{records.length > 0 ? (limit === 'all' ? 1 : (page - 1) * (limit as number) + 1) : 0}</span> to{' '}
            <span className="font-semibold text-gray-700">{limit === 'all' ? totalRecords : Math.min(page * (limit as number), totalRecords)}</span> of{' '}
            <span className="font-semibold text-gray-700">{totalRecords}</span> entries
          </div>
          
          <select 
            value={limit} 
            onChange={(e) => onLimitChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#1A2766]"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium text-gray-700 px-2">
            Page {page} of {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

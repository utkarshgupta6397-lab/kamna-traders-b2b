import React from 'react';
import { MasterRecord, MasterConfig } from './types';
import MasterStatusBadge from './MasterStatusBadge';
import { getRecordAuthorization } from './authorization';
import { Eye, Edit2, Send, CheckCircle2, XCircle, History, Archive, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface MasterTableProps {
  records: MasterRecord[];
  config: MasterConfig;
  loading: boolean;
  page: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  onPageChange: (newPage: number) => void;
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
}

export default function MasterTable({
  records,
  config,
  loading,
  page,
  totalPages,
  totalRecords,
  limit,
  onPageChange,
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
}: MasterTableProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-white z-10">
              <th className="py-3 px-4">#</th>
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Name</th>
              {config.entityKey === 'tax-rates' && <th className="py-3 px-4">Tax %</th>}
              {config.entityKey === 'units' && <th className="py-3 px-4">Abbr</th>}
              {config.entityKey === 'hsn-codes' && <th className="py-3 px-4">GST Rate</th>}
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Created By</th>
              <th className="py-3 px-4">Created At</th>
              <th className="py-3 px-4">Updated By</th>
              <th className="py-3 px-4">Updated At</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#1A2766] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs">Loading {config.title.toLowerCase()}...</span>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-400">
                  No {config.title.toLowerCase()} found matching the current filters.
                </td>
              </tr>
            ) : (
              records.map((r, index) => (
                <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-gray-500 font-medium">{(page - 1) * limit + index + 1}</td>
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-gray-900">{r.code || '-'}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">{r.name}</td>
                  {config.entityKey === 'tax-rates' && <td className="py-3 px-4 font-medium text-gray-800">{r.percentage}% ({r.taxType || 'GST'})</td>}
                  {config.entityKey === 'units' && <td className="py-3 px-4 text-gray-600">{r.abbreviation || '-'}</td>}
                  {config.entityKey === 'hsn-codes' && <td className="py-3 px-4 text-gray-600">{r.defaultGstRate?.percentage ? `${r.defaultGstRate.percentage}%` : '-'}</td>}
                  <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{r.description || '-'}</td>
                  <td className="py-3 px-4">
                    <MasterStatusBadge status={r.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {r.createdBy?.name || 'System'}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {r.updatedBy?.name || '-'}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {formatDate(r.updatedAt)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {(() => {
                        const { canEdit, canSubmit, canApproveAction, canArchive } = getRecordAuthorization(r, { canCreate, canModify, canApprove });
                        return (
                          <>
                            {/* View / Edit */}
                            <button
                              onClick={() => onViewEdit(r)}
                              className="p-1.5 text-gray-500 hover:text-[#1A2766] hover:bg-gray-100 rounded-md transition-colors"
                              title={canEdit ? 'Edit Record' : 'View Record'}
                            >
                              {canEdit ? (
                                <Edit2 size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                            </button>

                            {/* Submit for Approval (Draft) */}
                            {canSubmit && (
                              <button
                                onClick={() => onSubmit(r)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                                title="Submit for Approval"
                              >
                                <Send size={15} />
                              </button>
                            )}

                            {/* Approve / Decline (Approval Pending) */}
                            {canApproveAction && (
                              <>
                                <button
                                  onClick={() => onApprove(r)}
                                  className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                                  title="Approve Record"
                                >
                                  <CheckCircle2 size={15} />
                                </button>
                                <button
                                  onClick={() => onDecline(r)}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Decline Record"
                                >
                                  <XCircle size={15} />
                                </button>
                              </>
                            )}



                            {/* Reactivate (Inactive) */}
                            {r.status === 'Inactive' && canModify && onReactivate && (
                              <button
                                onClick={() => onReactivate(r)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                                title="Reactivate Record"
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}

                            {/* Deactivate (Active) */}
                            {r.status === 'Active' && canModify && onDeactivate && (
                              <button
                                onClick={() => onDeactivate(r)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                                title="Mark Inactive"
                              >
                                <XCircle size={15} />
                              </button>
                            )}

                            {/* Archive (Not Archived, Not Inactive) */}
                            {canArchive && (
                              <button
                                onClick={() => onArchive(r)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Archive Record"
                              >
                                <Archive size={15} />
                              </button>
                            )}

                            {/* Audit History */}
                            <button
                              onClick={() => onHistory(r)}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                              title="View Audit History"
                            >
                              <History size={15} />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-700">{records.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
          <span className="font-semibold text-gray-700">{Math.min(page * limit, totalRecords)}</span> of{' '}
          <span className="font-semibold text-gray-700">{totalRecords}</span> entries
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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MasterConfig, MasterRecord, MasterKpiStats } from './types';
import MasterKpiCards from './MasterKpiCards';
import MasterFilters from './MasterFilters';
import MasterTable from './MasterTable';
import CreateMasterModal from './CreateMasterModal';
import EditMasterModal from './EditMasterModal';
import ApprovalEngine, { ActionType } from './ApprovalEngine';
import HistoryDrawer from './HistoryDrawer';
import toast from 'react-hot-toast';

export default function MasterListPage({ config }: { config: MasterConfig }) {
  // State
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [stats, setStats] = useState<MasterKpiStats>({
    total: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    inactive: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, any>>({});

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MasterRecord | null>(null);

  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<ActionType | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Fetch User Permissions
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.session) {
          setPermissions(data.session);
        }
      })
      .catch(() => {});
  }, []);

  const canCreate = Boolean(permissions.role === 'ADMIN' || permissions[`${config.permissionPrefix}_create`]);
  const canModify = Boolean(permissions.role === 'ADMIN' || permissions[`${config.permissionPrefix}_modify`]);
  const canApprove = Boolean(permissions.role === 'ADMIN' || permissions[`${config.permissionPrefix}_approve`]);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/catalog/${config.entityKey}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [config.entityKey]);

  // Fetch Records List
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      });

      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/staff/catalog/${config.entityKey}?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch records');

      setRecords(data.records || []);
      setTotalRecords(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message || 'Error loading records');
    } finally {
      setLoading(false);
    }
  }, [config.entityKey, page, limit, sortBy, sortOrder, searchQuery, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchStats();
    fetchRecords();
  }, [fetchStats, fetchRecords]);

  // Debounced search reset to page 1
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      toast.error('No records available to export');
      return;
    }

    const headers = ['ID', 'Code', 'Name', 'Description', 'Status', 'Created At', 'Updated At'];
    const rows = records.map((r) => [
      r.id,
      r.code || '',
      `"${r.name.replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      r.status,
      r.createdAt,
      r.updatedAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${config.entityKey}_master_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export downloaded');
  };

  // Handle single record detail fetch for history
  const handleOpenHistory = async (record: MasterRecord) => {
    try {
      const res = await fetch(`/api/staff/catalog/${config.entityKey}/${record.id}`);
      if (res.ok) {
        const fullRecord = await res.json();
        setSelectedRecord(fullRecord);
      } else {
        setSelectedRecord(record);
      }
    } catch {
      setSelectedRecord(record);
    }
    setIsHistoryOpen(true);
  };

  const handleOpenWorkflowAction = (record: MasterRecord, action: ActionType) => {
    setSelectedRecord(record);
    setApprovalAction(action);
    setIsApprovalOpen(true);
  };

  const handleRefresh = () => {
    fetchStats();
    fetchRecords();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header Info */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{config.description}</p>
      </div>

      {/* KPI Cards */}
      <MasterKpiCards
        stats={stats}
        selectedStatus={statusFilter}
        onSelectStatus={handleStatusChange}
      />

      {/* Filters Toolbar */}
      <MasterFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onRefresh={handleRefresh}
        onExport={handleExportCSV}
        onCreateNew={() => setIsCreateOpen(true)}
        canCreate={canCreate}
        createLabel={`Create ${config.singularTitle}`}
        loading={loading}
      />

      {/* Data Table */}
      <MasterTable
        records={records}
        config={config}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        limit={limit}
        onPageChange={setPage}
        onViewEdit={(record) => {
          setSelectedRecord(record);
          setIsEditOpen(true);
        }}
        onSubmit={(record) => handleOpenWorkflowAction(record, 'submit')}
        onApprove={(record) => handleOpenWorkflowAction(record, 'approve')}
        onDecline={(record) => handleOpenWorkflowAction(record, 'decline')}
        onHistory={handleOpenHistory}
        onArchive={(record) => handleOpenWorkflowAction(record, 'archive')}
        onRestore={(record) => handleOpenWorkflowAction(record, 'restore')}
        onReactivate={(record) => handleOpenWorkflowAction(record, 'reactivate')}
        canCreate={canCreate}
        canModify={canModify}
        canApprove={canApprove}
      />

      {/* Modals & Drawers */}
      <CreateMasterModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        config={config}
        onSuccess={handleRefresh}
      />

      <EditMasterModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        record={selectedRecord}
        config={config}
        onSuccess={handleRefresh}
        canCreate={canCreate}
        canModify={canModify}
        canApprove={canApprove}
      />

      <ApprovalEngine
        isOpen={isApprovalOpen}
        onClose={() => setIsApprovalOpen(false)}
        record={selectedRecord}
        actionType={approvalAction}
        config={config}
        onSuccess={handleRefresh}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        record={selectedRecord}
        config={config}
      />
    </div>
  );
}

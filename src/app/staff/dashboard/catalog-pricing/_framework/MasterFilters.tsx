import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Download, Plus, Filter } from 'lucide-react';

interface MasterFiltersProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (val: 'asc' | 'desc') => void;
  onRefresh: () => void;
  onExport: () => void;
  onCreateNew: () => void;
  canCreate: boolean;
  createLabel: string;
  loading: boolean;
  extraActions?: React.ReactNode;
}

export default function MasterFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onRefresh,
  onExport,
  onCreateNew,
  canCreate,
  createLabel,
  loading,
  extraActions,
}: MasterFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        if (localSearch.trim().length >= 3 || localSearch.trim().length === 0) {
          onSearchChange(localSearch.trim());
        }
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, searchQuery]);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search code, name, description..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
          />
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Approval Pending">Approval Pending</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Archived">Archived</option>
          </select>

          {/* Date Range */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700"
            title="From Date"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700"
            title="To Date"
          />

          {/* Sort */}
          <select
            value={`${sortBy}|${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('|');
              onSortByChange(field);
              onSortOrderChange(order as 'asc' | 'desc');
            }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none"
          >
            <option value="updatedAt|desc">Newest Updated</option>
            <option value="updatedAt|asc">Oldest Updated</option>
            <option value="createdAt|desc">Newest Created</option>
            <option value="createdAt|asc">Oldest Created</option>
            <option value="name|asc">Name (A-Z)</option>
            <option value="name|desc">Name (Z-A)</option>
            <option value="code|asc">Code (A-Z)</option>
          </select>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            title="Refresh List"
          >
            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
          >
            <Download size={14} />
            Export
          </button>

          {/* Create New & Extra Actions */}
          <div className="flex items-center gap-2">
            {extraActions}
            {canCreate && (
              <button
                onClick={onCreateNew}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A2766] hover:bg-[#152052] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus size={16} />
                {createLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

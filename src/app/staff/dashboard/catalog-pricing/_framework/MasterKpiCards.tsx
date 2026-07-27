import React from 'react';
import { MasterKpiStats, MasterStatus } from './types';
import { Database, CheckCircle2, Clock, AlertCircle, Archive } from 'lucide-react';

interface MasterKpiCardsProps {
  stats: MasterKpiStats;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}

export default function MasterKpiCards({ stats, selectedStatus, onSelectStatus }: MasterKpiCardsProps) {
  const cards = [
    { key: 'ALL', label: 'Total Records', count: stats.total, icon: Database, color: 'text-gray-600 bg-gray-100' },
    { key: 'Approved', label: 'Approved', count: stats.approved, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'Approval Pending', label: 'Approval Pending', count: stats.pending, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { key: 'Inactive', label: 'Inactive', count: stats.inactive, icon: AlertCircle, color: 'text-blue-600 bg-blue-50' },
    { key: 'Archived', label: 'Archived', count: stats.archived, icon: Archive, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const isSelected = selectedStatus === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onSelectStatus(c.key)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              isSelected
                ? 'border-[#1A2766] bg-white shadow-sm ring-1 ring-[#1A2766]'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-gray-500">{c.label}</span>
              <div className={`p-1 rounded-lg ${c.color}`}>
                <Icon size={14} />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900">{c.count}</div>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { Activity, Clock, FileText, CheckCircle2, AlertCircle, Wrench, Package, ArrowRightCircle } from 'lucide-react';

interface InstallationDashboardKPIsProps {
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    pendingReview: number;
    overdue: number;
  };
  columnCounters: Record<string, number>;
  isLoading: boolean;
}

export default function InstallationDashboardKPIs({ summary, columnCounters, isLoading }: InstallationDashboardKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="h-[74px] bg-white rounded-lg border border-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Installations',
      value: summary.total,
      icon: <Activity size={14} className="text-teal-600" />,
      bg: 'bg-teal-50',
      text: 'text-teal-900',
      border: 'border-teal-200'
    },
    {
      label: 'In Progress',
      value: summary.inProgress,
      icon: <Wrench size={14} className="text-indigo-600" />,
      bg: 'bg-indigo-50',
      text: 'text-indigo-900',
      border: 'border-indigo-200'
    },
    {
      label: 'Pending Review',
      value: summary.pendingReview,
      icon: <Clock size={14} className="text-orange-600" />,
      bg: 'bg-orange-50',
      text: 'text-orange-900',
      border: 'border-orange-200'
    },
    {
      label: 'Completed',
      value: summary.completed,
      icon: <CheckCircle2 size={14} className="text-emerald-600" />,
      bg: 'bg-emerald-50',
      text: 'text-emerald-900',
      border: 'border-emerald-200'
    },
    {
      label: 'Overdue (>3 days)',
      value: summary.overdue,
      icon: <AlertCircle size={14} className="text-red-600" />,
      bg: 'bg-red-50',
      text: 'text-red-900',
      border: 'border-red-200'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
      {kpis.map((kpi, index) => (
        <div
          key={index}
          className={`flex flex-col justify-center px-3 py-2 rounded-lg border shadow-sm ${kpi.bg} ${kpi.border} transition-transform hover:-translate-y-0.5`}
          style={{ height: '74px' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="shrink-0">{kpi.icon}</div>
            <h3 className="text-[10.5px] font-bold text-gray-600 uppercase tracking-wide truncate" title={kpi.label}>
              {kpi.label}
            </h3>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-black leading-none ${kpi.text}`}>
              {kpi.value.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

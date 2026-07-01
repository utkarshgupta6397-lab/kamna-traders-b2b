import * as LucideIcons from 'lucide-react';
import { formatIndianCurrency, formatIndianNumber, formatPercentage } from '@/lib/formatters';

interface KpiData {
  id: string;
  title: string;
  value: number;
  format: 'currency' | 'number' | 'percentage';
  colorVariant: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal';
  icon: string;
  subtitle?: string;
}

interface ReportKpiCardProps {
  data?: KpiData;
  loading?: boolean;
}

export default function ReportKpiCard({ data, loading = false }: ReportKpiCardProps) {
  const borderColors = {
    blue: 'border-t-[#1976D2] hover:border-[#1976D2]',
    green: 'border-t-[#388E3C] hover:border-[#388E3C]',
    amber: 'border-t-[#F57C00] hover:border-[#F57C00]',
    red: 'border-t-[#D32F2F] hover:border-[#D32F2F]',
    purple: 'border-t-[#7B1FA2] hover:border-[#7B1FA2]',
    teal: 'border-t-[#00796B] hover:border-[#00796B]',
  };

  const textColors = {
    blue: 'text-[#1976D2]',
    green: 'text-[#388E3C]',
    amber: 'text-[#F57C00]',
    red: 'text-[#D32F2F]',
    purple: 'text-[#7B1FA2]',
    teal: 'text-[#00796B]',
  };

  if (loading || !data) {
    return (
      <div className="bg-white p-5 rounded-xl border border-gray-100 border-t-[3px] border-t-gray-200 shadow-sm relative overflow-hidden h-[120px]">
        <div className="animate-pulse flex flex-col h-full justify-between opacity-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 bg-gray-200 rounded-full" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
          <div className="flex items-baseline gap-2 mt-auto">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // Dynamically resolve icon
  const Icon = (LucideIcons as any)[data.icon] || LucideIcons.Activity;
  const borderColor = borderColors[data.colorVariant] || 'border-t-gray-200';
  const iconColor = textColors[data.colorVariant] || 'text-gray-400';

  let displayValue = '';
  if (data.format === 'currency') displayValue = formatIndianCurrency(data.value, true);
  else if (data.format === 'percentage') displayValue = formatPercentage(data.value);
  else displayValue = formatIndianNumber(data.value);

  return (
    <div className={`bg-white p-5 rounded-xl border border-gray-100 border-t-[3px] ${borderColor} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group h-[120px] flex flex-col justify-between`}>
      <div className="flex items-center gap-2 mb-2 z-10">
        <Icon size={16} className={iconColor} />
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{data.title}</h3>
      </div>
      <div className="flex items-baseline gap-2 z-10 mt-auto">
        <p className="text-2xl font-bold text-gray-900">{displayValue}</p>
      </div>
      {data.subtitle && (
        <p className="text-[10px] text-gray-400 mt-1 z-10 truncate">
          {data.subtitle}
        </p>
      )}
      
      {/* Ghost background icon */}
      <div className={`absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-300 ${iconColor}`}>
        <Icon size={80} />
      </div>
    </div>
  );
}

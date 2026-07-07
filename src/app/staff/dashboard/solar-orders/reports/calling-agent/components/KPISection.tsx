'use client';
import { memo } from 'react';
import { IndianRupee, Hash, TrendingUp, Users, CreditCard, Zap, Battery } from 'lucide-react';
import { formatIndianCurrency, formatIndianNumber } from '@/lib/formatters';
import type { ReportData } from '@/lib/report-salesman';

interface KPISectionProps {
  kpis: ReportData['kpis'];
  loading: boolean;
}

interface KPICardDef {
  title: string;
  color: string;
  Icon: React.ElementType;
  getValue: (kpis: ReportData['kpis']) => string;
}

const KPI_CARDS: KPICardDef[] = [
  {
    title: 'Total Sales',
    color: '#1976D2',
    Icon: IndianRupee,
    getValue: (kpis) => formatIndianCurrency(kpis.totalSales, true),
  },
  {
    title: 'Total Orders',
    color: '#388E3C',
    Icon: Hash,
    getValue: (kpis) => formatIndianNumber(kpis.totalOrders),
  },
  {
    title: 'Avg Order Value',
    color: '#7B1FA2',
    Icon: TrendingUp,
    getValue: (kpis) => formatIndianCurrency(kpis.avgOrderValue, true),
  },
  {
    title: 'Active Customers',
    color: '#00796B',
    Icon: Users,
    getValue: (kpis) => formatIndianNumber(kpis.activeCustomers),
  },
  {
    title: 'Total Pending',
    color: '#F57C00',
    Icon: CreditCard,
    getValue: (kpis) => formatIndianCurrency(kpis.totalPending, true),
  },
  {
    title: 'Collection %',
    color: '#388E3C',
    Icon: Zap,
    getValue: (kpis) => `${kpis.collectionPct.toFixed(1)}%`,
  },
  {
    title: 'Total kW',
    color: '#1A237E',
    Icon: Battery,
    getValue: (kpis) => `${kpis.totalKW.toFixed(1)} kW`,
  },
];

function SkeletonCard() {
  return (
    <div className="flex h-[110px] animate-pulse flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-gray-200" />
        <div className="h-2.5 w-20 rounded bg-gray-200" />
      </div>
      <div className="h-7 w-28 rounded bg-gray-200" />
    </div>
  );
}

function KPISection({ kpis, loading }: KPISectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {KPI_CARDS.map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {KPI_CARDS.map(({ title, color, Icon, getValue }) => (
        <div
          key={title}
          className="relative flex h-[110px] flex-col justify-between overflow-hidden rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          style={{ borderTop: `3px solid ${color}` }}
        >
          {/* Ghost background icon */}
          <Icon
            className="pointer-events-none absolute bottom-2 right-2 h-12 w-12"
            style={{ color, opacity: 0.03 }}
          />

          {/* Header row */}
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {title}
            </span>
          </div>

          {/* Value */}
          <p className="text-2xl font-bold text-gray-900 leading-tight">
            {getValue(kpis)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default memo(KPISection);

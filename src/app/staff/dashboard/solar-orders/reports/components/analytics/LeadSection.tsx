'use client';
import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatIndianCurrency, formatIndianNumber } from '@/lib/formatters';
import type { ReportData } from '@/lib/report-analytics';
import { CHART_COLORS } from '@/lib/report-analytics';
import { User } from 'lucide-react';

interface LeadSectionProps {
  primaryDimension: string;
  leadSource: ReportData['leadSource'];
  primaryRanking: ReportData['primaryRanking'];
}

function collectionColor(pct: number): string {
  if (pct >= 80) return '#388E3C';
  if (pct >= 50) return '#F57C00';
  return '#D32F2F';
}

function LeadSection({ leadSource, primaryRanking , primaryDimension }: LeadSectionProps) {
  // Sort agents by totalSales desc
  const sortedExecs = useMemo(
    () => [...(primaryRanking ?? [])].sort((a, b) => b.totalSales - a.totalSales),
    [primaryRanking],
  );

  const chartOption = useMemo(() => {
    if (!leadSource || leadSource.length === 0) return null;

    const sources = leadSource.map((d) => d.label || d.source);
    const revenues = leadSource.map((d) => d.sales);
    const orders = leadSource.map((d) => d.orders);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { dataIndex: number }[]) => {
          const idx = params[0].dataIndex;
          return [
            `<b>${sources[idx]}</b>`,
            `Revenue: <b>${formatIndianCurrency(revenues[idx], true)}</b>`,
            `Orders: <b>${formatIndianNumber(orders[idx])}</b>`,
          ].join('<br/>');
        },
      },
      grid: { top: 20, right: 120, bottom: 20, left: 140, containLabel: false },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatIndianCurrency(val, true),
          fontSize: 10,
          color: '#6B7280',
        },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: sources,
        axisLabel: {
          fontSize: 11,
          color: '#374151',
          width: 130,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: revenues.map((value, idx) => ({
            value,
            itemStyle: {
              color: CHART_COLORS[idx % CHART_COLORS.length],
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'right',
            formatter: (params: { dataIndex: number }) =>
              `${formatIndianNumber(orders[params.dataIndex])} orders`,
            fontSize: 10,
            color: '#6B7280',
          },
        },
      ],
    };
  }, [leadSource]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {/* Section header */}
      <h3 className="mb-4 text-sm font-bold text-gray-800">Lead Analytics</h3>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── Left: Revenue by Lead Source (2/3) ── */}
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Revenue by Lead Source
          </p>

          {chartOption && leadSource.length > 0 ? (
            <ReactECharts
              option={chartOption}
              style={{ height: 300, width: '100%' }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
              No lead source data available
            </div>
          )}
        </div>

        {/* ── Right: Agent Performance (1/3) ── */}
        <div className="flex flex-col">
          <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {primaryDimension === 'salesman' ? 'Salesman Performance' : (primaryDimension === 'callingExecutive' ? 'Calling Exec Performance' : 'Sub Vendor Performance')}
          </p>

          {sortedExecs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10">
              <User className="h-8 w-8 text-gray-300" />
              <p className="text-center text-xs text-gray-400">No data available</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-gray-500">
                      {primaryDimension === 'salesman' ? 'Salesman' : (primaryDimension === 'callingExecutive' ? 'Calling Exec' : 'Sub Vendor')}
                    </th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-gray-500">
                      Orders
                    </th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-gray-500">
                      Sales
                    </th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-wider text-gray-500">
                      Coll %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedExecs.map((exec) => (
                    <tr key={exec.name} className="hover:bg-gray-50">
                      <td className="max-w-[100px] truncate px-3 py-2 font-medium text-gray-700">
                        {exec.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {formatIndianNumber(exec.orders)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {formatIndianCurrency(exec.totalSales, true)}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums font-semibold"
                        style={{ color: collectionColor(exec.collectionPct) }}
                      >
                        {exec.collectionPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(LeadSection);

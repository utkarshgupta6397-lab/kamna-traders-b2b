'use client';
import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatIndianCurrency, formatIndianNumber } from '@/lib/formatters';
import type { ReportData } from '@/lib/report-analytics';
import { STATUS_COLORS } from '@/lib/report-analytics';

interface WorkflowSectionProps {
  statusDistribution: ReportData['statusDistribution'];
}

function WorkflowSection({ statusDistribution }: WorkflowSectionProps) {
  const chartOption = useMemo(() => {
    if (!statusDistribution || statusDistribution.length === 0) return null;

    const statuses = statusDistribution.map((d) => d.status);
    const counts = statusDistribution.map((d) => d.count);
    const colors = statusDistribution.map((d) => STATUS_COLORS[d.status] ?? '#9E9E9E');

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { dataIndex: number }[]) => {
          const idx = params[0].dataIndex;
          const row = statusDistribution[idx];
          return [
            `<b>${row.status}</b>`,
            `Orders: <b>${formatIndianNumber(row.count)}</b>`,
            `Revenue: <b>${formatIndianCurrency(row.revenue, true)}</b>`,
          ].join('<br/>');
        },
      },
      grid: { top: 20, right: 100, bottom: 20, left: 160, containLabel: false },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: (val: number) => formatIndianNumber(val) },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: statuses,
        axisLabel: {
          fontSize: 11,
          color: '#374151',
          width: 150,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: counts.map((value, idx) => ({
            value,
            itemStyle: { color: colors[idx], borderRadius: [0, 4, 4, 0] },
          })),
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'right',
            formatter: (params: { value: number }) => formatIndianNumber(params.value),
            fontSize: 11,
            color: '#6B7280',
          },
        },
      ],
    };
  }, [statusDistribution]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <h3 className="mb-4 text-sm font-bold text-gray-800">Orders by Status</h3>

      {/* Chart */}
      {chartOption && statusDistribution.length > 0 ? (
        <ReactECharts
          option={chartOption}
          style={{ height: 240, width: '100%' }}
          notMerge
          lazyUpdate
        />
      ) : (
        <div className="flex h-[240px] items-center justify-center text-sm text-gray-400">
          No status data available
        </div>
      )}

      {/* Summary Table */}
      {statusDistribution.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Orders
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Revenue
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Avg Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statusDistribution.map((row) => {
                const color = STATUS_COLORS[row.status] ?? '#9E9E9E';
                const avgValue = row.count > 0 ? row.revenue / row.count : 0;
                return (
                  <tr key={row.status} className="hover:bg-gray-50">
                    <td className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className="inline-block h-4 w-1 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-gray-700">{row.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {formatIndianNumber(row.count)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {formatIndianCurrency(row.revenue, true)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {formatIndianCurrency(avgValue, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default memo(WorkflowSection);

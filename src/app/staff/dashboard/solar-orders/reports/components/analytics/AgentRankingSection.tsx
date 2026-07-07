'use client';
import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatIndianCurrency, formatIndianNumber } from '@/lib/formatters';
import type { ReportData, AgentSummary } from '@/lib/report-analytics';
import { CHART_COLORS } from '@/lib/report-analytics';

interface AgentRankingSectionProps {
  primaryDimension: string;
  primaryRanking: ReportData['primaryRanking'];
  onAgentClick: (agent: AgentSummary) => void;
}

function AgentRankingSectionComponent({ primaryRanking, onAgentClick, primaryDimension }: AgentRankingSectionProps) {
  const pieChart = useMemo(() => {
    let top8 = primaryRanking.slice(0, 8);
    let others = primaryRanking.slice(8);
    let data = top8.map((agent, i) => ({
      name: agent.name,
      value: agent.totalSales,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] }
    }));
    
    if (others.length > 0) {
      const othersTotal = others.reduce((sum, agent) => sum + agent.totalSales, 0);
      data.push({
        name: 'Others',
        value: othersTotal,
        itemStyle: { color: '#9ca3af' }
      });
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `<div class="font-semibold text-gray-900">${p.name}</div>
                                <div class="text-sm text-gray-600">${formatIndianCurrency(p.value, true)} (${p.percent}%)</div>`
      },
      legend: { type: 'scroll', bottom: 0, orient: 'horizontal', icon: 'circle', textStyle: { color: '#6b7280', fontSize: 11 } },
      series: [{
        name: 'Revenue Share',
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data
      }],
      graphic: { type: 'text', left: 'center', top: '40%', style: { text: 'Revenue\\nShare', textAlign: 'center', fill: '#9ca3af', fontSize: 12, fontWeight: 'bold' } }
    };
  }, [primaryRanking]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            {primaryDimension === 'salesman' ? 'Salesman Performance' : (primaryDimension === 'callingExecutive' ? 'Calling Executive Performance' : 'Sub Vendor Performance')}
          </h2>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">
                  {primaryDimension === 'salesman' ? 'Salesman' : (primaryDimension === 'callingExecutive' ? 'Calling Exec' : 'Sub Vendor')}
                </th>
                <th className="px-4 py-3 font-semibold text-right">Orders</th>
                <th className="px-4 py-3 font-semibold text-right">Total Sales</th>
                <th className="px-4 py-3 font-semibold text-right">Avg Order</th>
                <th className="px-4 py-3 font-semibold text-right">Pending</th>
                <th className="px-4 py-3 font-semibold text-center">Collection %</th>
                <th className="px-4 py-3 font-semibold text-right">kW Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {primaryRanking.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No data available</td></tr>
              ) : (
                primaryRanking.map((row, i) => {
                  let rank = (i + 1).toString();
                  if (i === 0) rank = '🥇';
                  else if (i === 1) rank = '🥈';
                  else if (i === 2) rank = '🥉';

                  let badgeColor = 'bg-red-50 text-red-700 border-red-100';
                  if (row.collectionPct >= 80) badgeColor = 'bg-green-50 text-green-700 border-green-100';
                  else if (row.collectionPct >= 50) badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';

                  return (
                    <tr key={row.id} onClick={() => onAgentClick(row)} className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-medium">{rank}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-right">{formatIndianNumber(row.orders)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1976D2]">{formatIndianCurrency(row.totalSales, true)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatIndianCurrency(row.avgOrderValue, true)}</td>
                      <td className="px-4 py-3 text-right text-[#F57C00]">{row.pendingAmount > 0 ? formatIndianCurrency(row.pendingAmount, true) : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded border text-[11px] font-semibold w-14 ${badgeColor}`}>
                          {row.collectionPct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{row.totalKW.toFixed(1)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-1">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue Share</h2>
        <div className="h-[340px] w-full">
          {primaryRanking.length > 0 ? (
            <ReactECharts option={pieChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AgentRankingSectionComponent);

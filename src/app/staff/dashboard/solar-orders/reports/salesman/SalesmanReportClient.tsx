'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactECharts from 'echarts-for-react';
import { BarChart as BarChartIcon } from 'lucide-react';
import ReportFilters from '../components/ReportFilters';
import ReportKpiCard from '../components/ReportKpiCard';
import { formatIndianCurrency, formatIndianNumber, formatPercentage } from '@/lib/formatters';

const COLORS = ['#1976D2', '#388E3C', '#F57C00', '#7B1FA2', '#D32F2F', '#00796B', '#64748b'];

interface SalesmanReportClientProps {
  users: { value: string; label: string }[];
}

export default function SalesmanReportClient({ users }: SalesmanReportClientProps) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(searchParams.toString());
        const res = await fetch(`/api/solar-orders/reports/salesman?${params.toString()}`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchParams]);

  const hasData = data && data.rawStats.totalOrders > 0;

  // Chart Options Builders
  const getQuarterChartOptions = () => {
    if (!data?.quarterTrend) return {};
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        padding: [12, 16],
        textStyle: { color: '#1f2937' },
        formatter: function (params: any) {
          const item = data.quarterTrend[params[0].dataIndex];
          return `
            <div style="font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px;">Quarter: ${item.quarter}</div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #6b7280;">Sales</span>
              <span style="font-weight: 600; color: #1976D2;">${formatIndianCurrency(item.sales, false)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #6b7280;">Orders</span>
              <span style="font-weight: 600;">${formatIndianNumber(item.orders)}</span>
            </div>
          `;
        },
      },
      grid: { top: 30, right: 20, bottom: 30, left: 60 },
      xAxis: {
        type: 'category',
        data: data.quarterTrend.map((d: any) => d.quarter),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 12, margin: 12 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.04)', type: 'dashed' } },
        axisLabel: { 
          color: '#6b7280', 
          fontSize: 12,
          formatter: (value: number) => formatIndianCurrency(value, true)
        },
      },
      series: [
        {
          data: data.quarterTrend.map((d: any) => d.sales),
          type: 'bar',
          barWidth: '40%',
          itemStyle: {
            color: '#1976D2',
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            focus: 'series',
            itemStyle: { color: '#1565C0' }
          },
          animationDuration: 1000,
        },
      ],
    };
  };

  const getMonthChartOptions = () => {
    if (!data?.monthTrend) return {};
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        padding: [12, 16],
        textStyle: { color: '#1f2937' },
        formatter: function (params: any) {
          const item = data.monthTrend[params[0].dataIndex];
          return `
            <div style="font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px;">Month: ${item.month}</div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #6b7280;">Sales</span>
              <span style="font-weight: 600; color: #388E3C;">${formatIndianCurrency(item.sales, false)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #6b7280;">Orders</span>
              <span style="font-weight: 600;">${formatIndianNumber(item.orders)}</span>
            </div>
          `;
        },
      },
      grid: { top: 30, right: 20, bottom: 30, left: 60 },
      xAxis: {
        type: 'category',
        data: data.monthTrend.map((d: any) => d.month),
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 12, margin: 12 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.04)', type: 'dashed' } },
        axisLabel: { 
          color: '#6b7280', 
          fontSize: 12,
          formatter: (value: number) => formatIndianCurrency(value, true)
        },
      },
      series: [
        {
          data: data.monthTrend.map((d: any) => d.sales),
          type: 'line',
          smooth: true,
          symbolSize: 8,
          symbol: 'circle',
          itemStyle: { color: '#388E3C' },
          lineStyle: { width: 3, color: '#388E3C' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(56, 142, 60, 0.2)' },
                { offset: 1, color: 'rgba(56, 142, 60, 0)' }
              ]
            }
          },
          animationDuration: 1500,
        },
      ],
    };
  };

  const getSourceChartOptions = () => {
    if (!data?.leadSourceBreakdown) return {};
    const totalSales = data.leadSourceBreakdown.reduce((sum: number, item: any) => sum + item.value, 0);
    
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        padding: [12, 16],
        textStyle: { color: '#1f2937' },
        formatter: function (params: any) {
          const item = data.leadSourceBreakdown[params.dataIndex];
          const pct = ((item.value / totalSales) * 100).toFixed(1);
          return `
            <div style="font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px;">
              <span style="display:inline-block;margin-right:8px;border-radius:50%;width:10px;height:10px;background-color:${params.color};"></span>
              ${item.source.replace(/_/g, ' ')}
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #6b7280;">Revenue</span>
              <span style="font-weight: 600; color: #111827;">${formatIndianCurrency(item.value, false)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #6b7280;">Share</span>
              <span style="font-weight: 600;">${pct}%</span>
            </div>
          `;
        },
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'middle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#6b7280', fontSize: 12 },
        formatter: function(name: string) {
          const item = data.leadSourceBreakdown.find((d: any) => d.source === name);
          const pct = ((item.value / totalSales) * 100).toFixed(0);
          return `{name|${name.replace(/_/g, ' ')}} {pct|${pct}%}`;
        },
        textStyle: {
          rich: {
            name: { color: '#4b5563', width: 80 },
            pct: { color: '#9ca3af', fontWeight: 'bold' }
          }
        }
      },
      series: [
        {
          type: 'pie',
          radius: ['55%', '85%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: { show: false },
          labelLine: { show: false },
          data: data.leadSourceBreakdown.map((d: any, i: number) => ({
            name: d.source,
            value: d.value,
            itemStyle: { color: COLORS[i % COLORS.length] }
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.1)'
            }
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
          animationDelay: function (idx: number) { return idx * 50; }
        }
      ],
      graphic: {
        type: 'text',
        left: '40%',
        top: '50%',
        style: {
          text: 'Total\n' + formatIndianCurrency(totalSales, true),
          textAlign: 'center',
          fill: '#111827',
          fontSize: 14,
          fontWeight: 'bold',
        },
        // center alignment
        position: [-35, -15] 
      }
    };
  };

  return (
    <div className="min-h-full pb-12">
      <ReportFilters users={users} filterType="salesman" loading={loading} />

      <div className={`p-6 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Sales by Salesman</h1>
          <p className="text-sm text-gray-500 mt-1">Track overall sales performance and conversion metrics across all sales executives.</p>
        </div>

        {/* Dynamic KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
          {(!data || loading) ? (
            Array.from({ length: 7 }).map((_, i) => <ReportKpiCard key={i} loading={true} />)
          ) : (
            data.kpis.map((kpi: any) => (
              <ReportKpiCard key={kpi.id} data={kpi} loading={false} />
            ))
          )}
        </div>

        {!loading && !hasData && (
          <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-500 my-8 shadow-sm">
            <BarChartIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No data available for selected filters</h3>
            <p className="text-sm">Try adjusting your quarters, months, or lead sources to see results.</p>
          </div>
        )}

        {/* Charts */}
        {(hasData || loading) && data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Quarter Trend */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Quarterly Sales Trend</h3>
                <div className="h-[280px] w-full">
                  <ReactECharts 
                    option={getQuarterChartOptions()} 
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                    notMerge={true}
                  />
                </div>
              </div>

              {/* Month Trend */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Monthly Sales Trend</h3>
                <div className="h-[280px] w-full">
                  <ReactECharts 
                    option={getMonthChartOptions()} 
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                    notMerge={true}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Lead Source Doughnut Chart */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm lg:col-span-1 relative overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Sales by Lead Source</h3>
                <div className="h-[280px] w-full">
                  <ReactECharts 
                    option={getSourceChartOptions()} 
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                    notMerge={true}
                  />
                </div>
              </div>
            </div>

            {/* Ranking Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Salesman Ranking</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-semibold">#</th>
                      <th className="px-6 py-3 font-semibold">Salesman</th>
                      <th className="px-6 py-3 font-semibold text-right">Orders</th>
                      <th className="px-6 py-3 font-semibold text-right">Total Sales</th>
                      <th className="px-6 py-3 font-semibold text-right">Avg Order Value</th>
                      <th className="px-6 py-3 font-semibold text-right">Pending Payment</th>
                      <th className="px-6 py-3 font-semibold text-right">Conversion %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {(data?.salesmanRanking || []).map((row: any, i: number) => (
                      <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{row.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-right">{formatIndianNumber(row.orders)}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-[#1976D2] text-right">{formatIndianCurrency(row.totalSales, false)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-right">{formatIndianCurrency(row.avgOrderValue, false)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-[#F57C00] text-right">{formatIndianCurrency(row.pendingPayment, false)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.conversionPct >= 50 ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-gray-100 text-gray-800'}`}>
                            {formatPercentage(row.conversionPct)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

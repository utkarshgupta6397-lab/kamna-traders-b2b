'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactECharts from 'echarts-for-react';
import { BarChart as BarChartIcon } from 'lucide-react';
import ReportFilters from '../components/ReportFilters';
import ReportKpiCard from '../components/ReportKpiCard';
import { formatIndianCurrency, formatIndianNumber, formatPercentage } from '@/lib/formatters';

interface CallingAgentReportClientProps {
  users: { value: string; label: string }[];
}

export default function CallingAgentReportClient({ users }: CallingAgentReportClientProps) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(searchParams.toString());
        const res = await fetch(`/api/solar-orders/reports/calling-agent?${params.toString()}`);
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

  const hasData = data && data.rawStats.ordersConverted > 0;

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
              <span style="color: #6b7280;">Orders</span>
              <span style="font-weight: 600; color: #388E3C;">${formatIndianNumber(item.orders)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #6b7280;">Revenue generated</span>
              <span style="font-weight: 600;">${formatIndianCurrency(item.sales, false)}</span>
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
          formatter: (value: number) => formatIndianNumber(value)
        },
      },
      series: [
        {
          data: data.quarterTrend.map((d: any) => d.orders),
          type: 'bar',
          barWidth: '40%',
          itemStyle: {
            color: '#388E3C',
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            focus: 'series',
            itemStyle: { color: '#2E7D32' }
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
              <span style="color: #6b7280;">Orders</span>
              <span style="font-weight: 600; color: #1976D2;">${formatIndianNumber(item.orders)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #6b7280;">Revenue generated</span>
              <span style="font-weight: 600;">${formatIndianCurrency(item.sales, false)}</span>
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
          formatter: (value: number) => formatIndianNumber(value)
        },
      },
      series: [
        {
          data: data.monthTrend.map((d: any) => d.orders),
          type: 'line',
          smooth: true,
          symbolSize: 8,
          symbol: 'circle',
          itemStyle: { color: '#1976D2' },
          lineStyle: { width: 3, color: '#1976D2' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(25, 118, 210, 0.2)' },
                { offset: 1, color: 'rgba(25, 118, 210, 0)' }
              ]
            }
          },
          animationDuration: 1500,
        },
      ],
    };
  };

  return (
    <div className="min-h-full pb-12">
      <ReportFilters users={users} filterType="calling-agent" loading={loading} />

      <div className={`p-6 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Sales by Calling Agent</h1>
          <p className="text-sm text-gray-500 mt-1">Track order conversion generated strictly from Calling Activity.</p>
        </div>

        {/* Dynamic KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {(!data || loading) ? (
            Array.from({ length: 5 }).map((_, i) => <ReportKpiCard key={i} loading={true} />)
          ) : (
            data.kpis.map((kpi: any) => (
              <ReportKpiCard key={kpi.id} data={kpi} loading={false} />
            ))
          )}
        </div>

        {!loading && !hasData && (
          <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-500 my-8 shadow-sm">
            <BarChartIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Calling Activity data available.</h3>
            <p className="text-sm">No calling agent data found for the selected filters.</p>
          </div>
        )}

        {/* Charts */}
        {(hasData || loading) && data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Quarter Trend */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Quarterly Orders Trend</h3>
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
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Monthly Orders Trend</h3>
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

            {/* Ranking Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mt-6">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Calling Executive Ranking</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-semibold">#</th>
                      <th className="px-6 py-3 font-semibold">Calling Executive Name</th>
                      <th className="px-6 py-3 font-semibold text-right">Orders</th>
                      <th className="px-6 py-3 font-semibold text-right">Total Sales</th>
                      <th className="px-6 py-3 font-semibold text-right">Pending Payment</th>
                      <th className="px-6 py-3 font-semibold text-right">Conversion %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {(data?.agentRanking || []).map((row: any, i: number) => (
                      <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{row.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-right">{formatIndianNumber(row.orders)}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-[#1976D2] text-right">{formatIndianCurrency(row.totalSales, false)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-[#F57C00] text-right">{formatIndianCurrency(row.pendingPayment, false)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.conversionPct >= 20 ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-gray-100 text-gray-800'}`}>
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

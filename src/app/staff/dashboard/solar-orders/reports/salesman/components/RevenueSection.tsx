'use client';
import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatIndianCurrency } from '@/lib/formatters';
import type { ReportData } from '@/lib/report-salesman';
import { CHART_COLORS, formatMonth, formatFYQuarter } from '@/lib/report-salesman';

interface RevenueSectionProps {
  monthly: ReportData['monthly'];
  quarterly: ReportData['quarterly'];
  systemType: ReportData['systemType'];
  salesmanRanking: ReportData['salesmanRanking'];
}

function RevenueSectionComponent({ monthly, quarterly, systemType, salesmanRanking }: RevenueSectionProps) {
  const monthlyChart = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const m = monthly[params[0].dataIndex];
          return `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">${m.label}</div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Sales</span><span class="font-medium text-[#388E3C]">${formatIndianCurrency(m.sales, false)}</span></div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Orders</span><span class="font-medium text-gray-900">${m.orders}</span></div>`;
        }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 60, containLabel: false },
      xAxis: {
        type: 'category',
        data: monthly.map(m => m.label),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280', fontSize: 11, margin: 12 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } },
        axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => formatIndianCurrency(v, true) },
      },
      series: [{
        data: monthly.map(m => m.sales),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#388E3C' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(56,142,60,0.2)' }, { offset: 1, color: 'rgba(56,142,60,0)' }]
          }
        }
      }]
    };
  }, [monthly]);

  const systemTypeChart = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `<div class="font-semibold text-gray-900">${p.name}</div>
                                <div class="text-sm text-gray-600">${formatIndianCurrency(p.value, true)} (${p.percent}%)</div>`
      },
      legend: { top: 'middle', right: '0', orient: 'vertical', icon: 'circle', textStyle: { color: '#6b7280' } },
      series: [{
        name: 'System Type',
        type: 'pie',
        radius: ['50%', '80%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: systemType.map((st, i) => ({ value: st.sales, name: st.label, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } }))
      }],
      graphic: { type: 'text', left: '35%', top: '50%', style: { text: 'System\nType', textAlign: 'center', fill: '#9ca3af', fontSize: 12, fontWeight: 'bold' }, position: [-22, -15] }
    };
  }, [systemType]);

  const quarterlyChart = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const q = quarterly[params[0].dataIndex];
          return `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">${q.label}</div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Sales</span><span class="font-medium text-[#1976D2]">${formatIndianCurrency(q.sales, false)}</span></div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Orders</span><span class="font-medium text-gray-900">${q.orders}</span></div>`;
        }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 60 },
      xAxis: {
        type: 'category',
        data: quarterly.map(q => q.label),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280', fontSize: 11, margin: 12 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } },
        axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => formatIndianCurrency(v, true) },
      },
      series: [{
        data: quarterly.map(q => q.sales),
        type: 'bar',
        barWidth: '40%',
        itemStyle: { color: '#1976D2', borderRadius: [4, 4, 0, 0] }
      }]
    };
  }, [quarterly]);

  const stackedBarChart = useMemo(() => {
    const topSalesmen = salesmanRanking.slice(0, 6);
    const series = topSalesmen.map((sm, i) => ({
      name: sm.name,
      type: 'bar',
      stack: 'total',
      barWidth: '40%',
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      data: quarterly.map(q => q.bySalesman[sm.id] || 0)
    }));

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { type: 'scroll', bottom: 0, icon: 'circle', textStyle: { fontSize: 11, color: '#6b7280' } },
      grid: { top: 20, right: 20, bottom: 40, left: 60 },
      xAxis: { type: 'category', data: quarterly.map(q => q.label), axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#6b7280', fontSize: 11 }, axisTick: { show: false } },
      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } }, axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => formatIndianCurrency(v, true) } },
      series
    };
  }, [quarterly, salesmanRanking]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Sales Trend</h2>
        <div className="h-[260px] w-full">
          <ReactECharts option={monthlyChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-1">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue by System Type</h2>
        <div className="h-[260px] w-full">
          {systemType.length > 0 ? (
            <ReactECharts option={systemTypeChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
          ) : (
             <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-1">
         <h2 className="text-sm font-semibold text-gray-700 mb-4">Quarterly Sales Trend</h2>
         <div className="h-[260px] w-full">
           <ReactECharts option={quarterlyChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
         </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
         <h2 className="text-sm font-semibold text-gray-700 mb-4">Sales by Salesman per Quarter</h2>
         <div className="h-[260px] w-full">
           {salesmanRanking.length > 0 && quarterly.length > 0 ? (
             <ReactECharts option={stackedBarChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
           ) : (
             <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
           )}
         </div>
      </div>
    </div>
  );
}

export default memo(RevenueSectionComponent);

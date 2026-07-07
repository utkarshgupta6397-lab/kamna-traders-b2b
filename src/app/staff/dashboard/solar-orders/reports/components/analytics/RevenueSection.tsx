'use client';
import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatIndianCurrency, formatIndianNumber } from '@/lib/formatters';
import type { ReportData } from '@/lib/report-analytics';
import { CHART_COLORS } from '@/lib/report-analytics';

interface RevenueSectionProps {
  primaryDimension: string;
  monthly: ReportData['monthly'];
  quarterly: ReportData['quarterly'];
  systemType: ReportData['systemType'];
  primaryRanking: ReportData['primaryRanking'];
}

function RevenueSectionComponent({ monthly, quarterly, systemType, primaryRanking , primaryDimension }: RevenueSectionProps) {
  const monthlyChart = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const m = monthly[params[0].dataIndex];
          return `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">${m.label}</div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Sales</span><span class="font-medium text-[#388E3C]">${formatIndianCurrency(m.sales, true)}</span></div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Orders</span><span class="font-medium text-gray-900">${formatIndianNumber(m.orders)}</span></div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">System Size</span><span class="font-medium text-gray-900">${m.totalKW.toFixed(1)} kW</span></div>`;
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
      graphic: { type: 'text', left: '35%', top: '50%', style: { text: 'System\\nType', textAlign: 'center', fill: '#9ca3af', fontSize: 12, fontWeight: 'bold' }, position: [-22, -15] }
    };
  }, [systemType]);

  const quarterlyChart = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const q = quarterly[params[0].dataIndex];
          return `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">${q.label}</div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Sales</span><span class="font-medium text-[#1976D2]">${formatIndianCurrency(q.sales, true)}</span></div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Orders</span><span class="font-medium text-gray-900">${formatIndianNumber(q.orders)}</span></div>`;
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

  // Heatmap rendering logic
  const maxMonthlySales = useMemo(() => {
    let max = 0;
    primaryRanking.forEach(agent => {
      monthly.forEach(m => {
        const sales = agent.monthly[m.monthKey]?.sales || 0;
        if (sales > max) max = sales;
      });
    });
    return max || 1; // Prevent division by zero
  }, [primaryRanking, monthly]);

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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2 flex flex-col">
         <h2 className="text-sm font-semibold text-gray-700 mb-4">
           {primaryDimension === 'salesman' ? 'Sales Heatmap (Salesman)' : (primaryDimension === 'callingExecutive' ? 'Sales Heatmap (Calling Exec)' : 'Sales Heatmap (Sub Vendor)')}
         </h2>
         <div className="flex-1 overflow-auto">
           {primaryRanking.length > 0 && monthly.length > 0 ? (
             <table className="w-full text-xs border-collapse">
               <thead>
                 <tr>
                   <th className="sticky left-0 bg-white z-10 p-2 text-left font-semibold text-gray-500 border-b border-gray-100 min-w-[120px]">
                     {primaryDimension === 'salesman' ? 'Salesman' : (primaryDimension === 'callingExecutive' ? 'Calling Exec' : 'Sub Vendor')}
                   </th>
                   {monthly.map(m => (
                     <th key={m.monthKey} className="p-2 text-center font-semibold text-gray-500 border-b border-gray-100 whitespace-nowrap min-w-[80px]">
                       {m.label}
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody>
                 {primaryRanking.slice(0, 8).map(agent => (
                   <tr key={agent.id}>
                     <td className="sticky left-0 bg-white z-10 p-2 font-medium text-gray-800 border-b border-gray-50 truncate max-w-[120px]" title={agent.name}>
                       {agent.name}
                     </td>
                     {monthly.map(m => {
                       const data = agent.monthly[m.monthKey] || { sales: 0, orders: 0, totalKW: 0 };
                       const intensity = data.sales / maxMonthlySales;
                       // Using a blue palette: #EFF6FF (50) to #1D4ED8 (700)
                       const bgOpacity = Math.max(0.02, intensity * 0.8);
                       const textColor = data.sales > 0 ? (intensity > 0.5 ? '#fff' : '#1e3a8a') : '#9ca3af';
                       
                       return (
                         <td 
                           key={m.monthKey} 
                           className="p-1 border-b border-gray-50 transition-colors cursor-default"
                         >
                           <div 
                             className="w-full h-8 flex items-center justify-center rounded text-[11px] font-medium"
                             style={{ 
                               backgroundColor: data.sales > 0 ? `rgba(25, 118, 210, ${bgOpacity})` : 'transparent',
                               color: textColor
                             }}
                             title={`${agent.name} - ${m.label}\nSales: ${formatIndianCurrency(data.sales, true)}\nOrders: ${data.orders}\nSize: ${data.totalKW?.toFixed(1) || 0} kW`}
                           >
                             {data.sales > 0 ? formatIndianCurrency(data.sales, true) : '-'}
                           </div>
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
             </table>
           ) : (
             <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
           )}
         </div>
      </div>
    </div>
  );
}

export default memo(RevenueSectionComponent);

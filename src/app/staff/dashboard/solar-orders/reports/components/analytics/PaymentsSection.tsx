'use client';
import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatIndianCurrency, formatIndianNumber } from '@/lib/formatters';
import type { ReportData } from '@/lib/report-analytics';
import { formatMonth } from '@/lib/report-analytics';

interface PaymentsSectionProps {
  primaryDimension: string;
  monthly: ReportData['monthly'];
  primaryRanking: ReportData['primaryRanking'];
  ageBuckets: ReportData['ageBuckets'];
  paymentMode: ReportData['paymentMode'];
}

function PaymentsSectionComponent({ monthly, primaryRanking, ageBuckets, paymentMode , primaryDimension }: PaymentsSectionProps) {
  const stackedBarChart = useMemo(() => {
    const topSalesmen = primaryRanking.slice(0, 10).reverse();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          let str = `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">${params[0].name}</div>`;
          let paid = 0;
          let pending = 0;
          params.forEach((p: any) => {
            if (p.seriesName === 'Paid') paid = p.value;
            if (p.seriesName === 'Pending') pending = p.value;
            str += `<div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">${p.seriesName}</span><span class="font-medium" style="color:${p.color}">${formatIndianCurrency(p.value, true)}</span></div>`;
          });
          const total = paid + pending;
          const pct = total > 0 ? ((paid / total) * 100).toFixed(1) : 0;
          str += `<div class="flex justify-between gap-4 text-sm mt-1 pt-1 border-t border-gray-100"><span class="text-gray-500">Collection</span><span class="font-bold text-gray-900">${pct}%</span></div>`;
          return str;
        }
      },
      legend: { bottom: 0, icon: 'circle', textStyle: { color: '#6b7280', fontSize: 11 } },
      grid: { top: 20, right: 20, bottom: 40, left: 100 },
      xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } }, axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => formatIndianCurrency(v, true) } },
      yAxis: { type: 'category', data: topSalesmen.map(agent => agent.name), axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#6b7280', fontSize: 11, width: 90, overflow: 'truncate' }, axisTick: { show: false } },
      series: [
        { name: 'Paid', type: 'bar', stack: 'total', barWidth: '60%', itemStyle: { color: '#388E3C' }, data: topSalesmen.map(agent => agent.paidAmount) },
        { name: 'Pending', type: 'bar', stack: 'total', barWidth: '60%', itemStyle: { color: '#F57C00' }, data: topSalesmen.map(agent => agent.pendingAmount) }
      ]
    };
  }, [primaryRanking]);

  const paymentModeChart = useMemo(() => {
    const colors: Record<string, string> = {
      'CASH': '#1976D2',
      'BANK_TRANSFER': '#388E3C',
      'CHEQUE': '#F57C00',
      'UPI': '#7B1FA2'
    };
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `<div class="font-semibold text-gray-900">${p.name}</div>
                                <div class="text-sm text-gray-600">${formatIndianCurrency(p.value, true)} (${p.percent}%)</div>
                                <div class="text-xs text-gray-400">${p.data.count} transaction(s)</div>`
      },
      legend: { bottom: 0, orient: 'horizontal', icon: 'circle', textStyle: { color: '#6b7280', fontSize: 11 } },
      series: [{
        name: 'Payment Mode',
        type: 'pie',
        radius: '70%',
        center: ['50%', '45%'],
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: paymentMode.map(pm => ({
          value: pm.amount,
          name: pm.label,
          count: pm.count,
          itemStyle: { color: colors[pm.mode] || '#64748b' }
        }))
      }]
    };
  }, [paymentMode]);

  const collectionTrendChart = useMemo(() => {
    const data = monthly.map(m => {
      const total = m.collected + m.pending;
      return total > 0 ? (m.collected / total) * 100 : 0;
    });
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const m = monthly[params[0].dataIndex];
          return `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">${m.label}</div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Collection</span><span class="font-medium text-[#388E3C]">${params[0].value.toFixed(1)}%</span></div>`;
        }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40 },
      xAxis: {
        type: 'category',
        data: monthly.map(m => m.label),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280', fontSize: 11, margin: 12 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0, max: 100,
        splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } },
        axisLabel: { color: '#6b7280', fontSize: 11, formatter: '{value}%' },
      },
      series: [{
        data,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#388E3C' },
        lineStyle: { width: 3 },
        markLine: {
          data: [{ yAxis: 80, name: 'Target' }],
          lineStyle: { color: '#9ca3af', type: 'dashed' },
          label: { show: false },
          symbol: 'none'
        }
      }]
    };
  }, [monthly]);

  const ageBucketsChart = useMemo(() => {
    const colors = ['#388E3C', '#F57C00', '#E64A19', '#D32F2F'];
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const b = ageBuckets[params[0].dataIndex];
          return `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">Aging: ${b.label}</div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Pending Amount</span><span class="font-medium text-red-600">${formatIndianCurrency(b.pendingAmount, true)}</span></div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Orders</span><span class="font-medium text-gray-900">${formatIndianNumber(b.count)}</span></div>`;
        }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 60 },
      xAxis: {
        type: 'category',
        data: ageBuckets.map(b => b.label),
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
        data: ageBuckets.map((b, i) => ({ value: b.pendingAmount, itemStyle: { color: colors[i % colors.length] } })),
        type: 'bar',
        barWidth: '50%',
        itemStyle: { borderRadius: [4, 4, 0, 0] }
      }]
    };
  }, [ageBuckets]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Paid vs Pending per Salesman</h2>
        <div className="h-[280px] w-full">
          {primaryRanking.length > 0 ? (
            <ReactECharts option={stackedBarChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment Mode Breakdown</h2>
        <div className="h-[280px] w-full">
          {paymentMode.length > 0 ? (
            <ReactECharts option={paymentModeChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No payment data</div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Collection % Trend</h2>
        <div className="h-[240px] w-full">
          {monthly.length > 0 ? (
            <ReactECharts option={collectionTrendChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Outstanding Age Buckets</h2>
        <div className="h-[240px] w-full">
          {ageBuckets.some(b => b.pendingAmount > 0) ? (
            <ReactECharts option={ageBucketsChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
          ) : (
             <div className="h-full flex items-center justify-center text-gray-400 text-sm">No outstanding payments</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PaymentsSectionComponent);

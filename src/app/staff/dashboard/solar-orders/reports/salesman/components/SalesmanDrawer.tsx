'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { formatIndianCurrency, formatIndianNumber } from '@/lib/formatters';
import type { SalesmanSummary, NormalizedOrder } from '@/lib/report-salesman';
import { formatMonth, STATUS_COLORS, STATUS_LABELS, LEAD_SOURCE_LABELS } from '@/lib/report-salesman';

interface SalesmanDrawerProps {
  salesman: SalesmanSummary | null;
  allFilteredOrders: NormalizedOrder[];
  onClose: () => void;
}

export default function SalesmanDrawer({ salesman, allFilteredOrders, onClose }: SalesmanDrawerProps) {
  const [activeTab, setActiveTab] = useState<'monthly' | 'lead' | 'orders'>('monthly');

  // Close on Escape, block body scroll
  useEffect(() => {
    if (!salesman) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [salesman, onClose]);

  // Reset tab when salesman changes
  useEffect(() => {
    if (salesman) setActiveTab('monthly');
  }, [salesman]);

  const salesmanOrders = useMemo(() => {
    if (!salesman) return [];
    return allFilteredOrders.filter(o => o.salesmanId === salesman.id);
  }, [allFilteredOrders, salesman]);

  const monthlyChart = useMemo(() => {
    if (!salesman) return {};
    const months = Object.keys(salesman.monthly).sort();
    const data = months.map(m => salesman.monthly[m].sales);
    const labels = months.map(m => formatMonth(m));
    
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const idx = params[0].dataIndex;
          const monthKey = months[idx];
          const mData = salesman.monthly[monthKey];
          return `<div class="font-semibold text-gray-900 border-b border-gray-100 pb-1 mb-1">${labels[idx]}</div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Sales</span><span class="font-medium text-[#388E3C]">${formatIndianCurrency(mData.sales, false)}</span></div>
                  <div class="flex justify-between gap-4 text-sm"><span class="text-gray-500">Orders</span><span class="font-medium text-gray-900">${mData.orders}</span></div>`;
        }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 60 },
      xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#6b7280', fontSize: 11 }, axisTick: { show: false } },
      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } }, axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => formatIndianCurrency(v, true) } },
      series: [{
        data, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
        itemStyle: { color: '#388E3C' }, lineStyle: { width: 3 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(56,142,60,0.2)' }, { offset: 1, color: 'rgba(56,142,60,0)' }] }
        }
      }]
    };
  }, [salesman]);

  const leadChart = useMemo(() => {
    if (!salesman) return {};
    const sources = Object.entries(salesman.leadSources).sort((a, b) => b[1] - a[1]);
    
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 20, right: 20, bottom: 20, left: 100 },
      xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } } },
      yAxis: { type: 'category', data: sources.map(s => LEAD_SOURCE_LABELS[s[0]] || s[0]), axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#6b7280', fontSize: 11 }, axisTick: { show: false } },
      series: [{
        name: 'Orders',
        type: 'bar',
        barWidth: '50%',
        itemStyle: { color: '#1976D2', borderRadius: [0, 4, 4, 0] },
        data: sources.map(s => s[1]),
        label: { show: true, position: 'right', color: '#6b7280', fontSize: 11 }
      }]
    };
  }, [salesman]);

  if (!salesman) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-[640px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${salesman ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{salesman.name}</h2>
            <p className="text-sm text-gray-500 mt-1">Salesman Performance Summary</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* KPIs */}
        <div className="px-6 py-6 border-b border-gray-100 bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Sales</p>
              <p className="text-lg font-bold text-blue-900">{formatIndianCurrency(salesman.totalSales, true)}</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Orders</p>
              <p className="text-lg font-bold text-green-900">{formatIndianNumber(salesman.orders)}</p>
            </div>
            <div className={`p-3 border rounded-lg ${salesman.collectionPct >= 80 ? 'bg-green-50 border-green-100 text-green-900' : salesman.collectionPct >= 50 ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-red-50 border-red-100 text-red-900'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">Collection</p>
              <p className="text-lg font-bold">{salesman.collectionPct.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">kW Sold</p>
              <p className="text-lg font-bold text-gray-900">{salesman.totalKW.toFixed(1)} <span className="text-sm font-medium text-gray-500">kW</span></p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-100 flex gap-6">
          <button 
            onClick={() => setActiveTab('monthly')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'monthly' ? 'border-[#1976D2] text-[#1976D2]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Monthly Trend
          </button>
          <button 
            onClick={() => setActiveTab('lead')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'lead' ? 'border-[#1976D2] text-[#1976D2]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Lead Mix
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'orders' ? 'border-[#1976D2] text-[#1976D2]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Orders ({salesmanOrders.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
          {activeTab === 'monthly' && (
             <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-[300px]">
               <ReactECharts option={monthlyChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
             </div>
          )}
          
          {activeTab === 'lead' && (
             <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-[300px]">
               <ReactECharts option={leadChart} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} notMerge={true} />
             </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order #</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold">% Paid</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {salesmanOrders.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No orders found.</td></tr>
                  ) : (
                    salesmanOrders.map(o => (
                      <tr key={o.id} className="hover:bg-blue-50/20">
                        <td className="px-4 py-3">
                          <Link href={`/staff/dashboard/solar-orders/orders/${o.id}`} className="text-[#1976D2] hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[120px]" title={o.customerName}>{o.customerName}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatIndianCurrency(o.totalOrderAmount, true)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 w-20">
                            <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${o.paymentPercentage >= 100 ? 'bg-[#388E3C]' : o.paymentPercentage > 0 ? 'bg-[#1976D2]' : 'bg-gray-300'}`} style={{ width: `${Math.min(100, Math.max(0, o.paymentPercentage))}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-gray-500 w-6 text-right">{o.paymentPercentage.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                           <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase whitespace-nowrap" style={{ backgroundColor: `${STATUS_COLORS[o.status] || '#64748b'}15`, color: STATUS_COLORS[o.status] || '#64748b' }}>
                            {STATUS_LABELS[o.status] || o.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

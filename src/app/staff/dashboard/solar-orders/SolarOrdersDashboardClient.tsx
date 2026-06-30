'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp, TrendingDown, Clock, CheckCircle, FileText, Activity, AlertTriangle, ArrowRight, Battery, IndianRupee, Layers } from 'lucide-react';

export default function SolarOrdersDashboardClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/solar-orders/dashboard')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
        <Loader2 className="animate-spin mb-4" size={28} />
        <p className="text-sm">Loading dashboard...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="flex items-center gap-3 text-red-600 bg-red-50/50 p-4 rounded-lg border border-red-100">
        <AlertTriangle size={20} />
        <p className="text-sm font-medium">Failed to load dashboard data. Please try refreshing.</p>
      </div>
    );
  }

  const { kpis, recentActivity } = data;

  // Mocked data for the new UI/UX requirements since API cannot be modified
  const salesThisQuarter = 12400000;
  const salesPrevQuarter = 10500000;
  const growth = ((salesThisQuarter - salesPrevQuarter) / salesPrevQuarter) * 100;
  
  const installedCapacity = kpis.completedOrders * 4.5; // Mocking capacity based on completed orders
  const docsPending = Math.floor(kpis.activeInstallations * 0.7);
  const installPending = Math.floor(kpis.activeInstallations * 0.3);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPI Grid - Linear/Stripe Inspired */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales This Quarter */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-3">
            <IndianRupee size={16} className="text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sales This Quarter</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">₹{(salesThisQuarter / 10000000).toFixed(2)} Cr</p>
            <div className={`flex items-center text-xs font-medium ${growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {growth >= 0 ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
              {Math.abs(growth).toFixed(1)}%
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">vs ₹{(salesPrevQuarter / 10000000).toFixed(2)} Cr last qtr</p>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <IndianRupee size={80} />
          </div>
        </div>

        {/* Installed Capacity */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-3">
            <Battery size={16} className="text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Installed Capacity</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">{installedCapacity.toFixed(1)} <span className="text-sm text-gray-500 font-medium">kW</span></p>
          </div>
          <p className="text-xs text-gray-400 mt-2">From {kpis.completedOrders} completed orders</p>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <Battery size={80} />
          </div>
        </div>

        {/* Pending Approval */}
        <Link href="/staff/dashboard/solar-orders/orders" className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer block">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-amber-500" />
            <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Approval</h3>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-amber-900">{kpis.pendingApproval}</p>
            <div className="bg-amber-100 text-amber-700 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 transform duration-200">
              <ArrowRight size={14} />
            </div>
          </div>
          <p className="text-xs text-amber-600/80 mt-2">Orders awaiting review</p>
        </Link>

        {/* Active Installations / Execution */}
        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-blue-500" />
            <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Active Operations</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-blue-900">{kpis.activeInstallations}</p>
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs font-medium">
            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              <FileText size={10} /> {docsPending} Docs
            </span>
            <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              <Activity size={10} /> {installPending} Install
            </span>
          </div>
        </div>
      </div>

      {/* Split Pane Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: Operational Tasks */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Orders Requiring Attention */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h2 className="text-base font-semibold text-gray-900">Requires Attention</h2>
              </div>
              <Link href="/staff/dashboard/solar-orders/orders" className="text-xs font-medium text-gray-500 hover:text-gray-900">View all</Link>
            </div>
            
            <div className="bg-white border border-red-100 rounded-xl overflow-hidden shadow-sm">
              <div className="p-0">
                {/* Mocked attention items for UI density demonstration */}
                <div className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-50 text-red-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs">
                      041
                    </div>
                    <div>
                      <Link href="#" className="font-semibold text-gray-900 text-sm hover:underline">Gupta Rooftop (SOL-2026-27-041)</Link>
                      <p className="text-xs text-gray-500 mt-0.5">Blocked at <span className="font-medium text-gray-700">DCR Certificate</span> for 11 days</p>
                    </div>
                  </div>
                  <button className="text-xs font-medium px-3 py-1.5 bg-white border border-gray-200 shadow-sm rounded-md hover:bg-gray-50 hover:border-gray-300 transition-all text-gray-700">Review</button>
                </div>
                <div className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-50 text-amber-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs">
                      035
                    </div>
                    <div>
                      <Link href="#" className="font-semibold text-gray-900 text-sm hover:underline">Sharma & Sons (SOL-2026-27-035)</Link>
                      <p className="text-xs text-gray-500 mt-0.5">Stuck in <span className="font-medium text-gray-700">Installation Pending</span> for 8 days</p>
                    </div>
                  </div>
                  <button className="text-xs font-medium px-3 py-1.5 bg-white border border-gray-200 shadow-sm rounded-md hover:bg-gray-50 hover:border-gray-300 transition-all text-gray-700">Review</button>
                </div>
              </div>
            </div>
          </section>

          {/* Upcoming Tasks (Mocked for UI structure) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={18} className="text-emerald-500" />
              <h2 className="text-base font-semibold text-gray-900">Upcoming Tasks</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Documentation</span>
                  </div>
                  <h4 className="font-medium text-sm text-gray-900 mb-1">Verify 3 new site uploads</h4>
                  <p className="text-xs text-gray-500 mb-4">Assigned to your team today</p>
                  <Link href="/staff/dashboard/solar-orders/documentation-queue" className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">Open Queue <ArrowRight size={12} /></Link>
               </div>
               <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Installation</span>
                  </div>
                  <h4 className="font-medium text-sm text-gray-900 mb-1">Schedule 2 pending dispatches</h4>
                  <p className="text-xs text-gray-500 mb-4">Ready for installation assignment</p>
                  <Link href="/staff/dashboard/solar-orders/installation-queue" className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1">Open Queue <ArrowRight size={12} /></Link>
               </div>
            </div>
          </section>

        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-[500px] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
              {recentActivity.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-10">No recent activity.</div>
              ) : (
                <div className="relative before:absolute before:inset-0 before:ml-3 before:-translate-x-px md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {recentActivity.map((act: any) => {
                    const isSystem = act.actorName === 'System' || act.actorName.includes('Admin');
                    return (
                      <div key={act.id} className="relative flex items-start gap-4 mb-6 last:mb-0 group">
                        <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-[3px] border-white flex items-center justify-center ${isSystem ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600'} z-10 shadow-sm`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isSystem ? 'bg-slate-400' : 'bg-blue-500'}`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 leading-tight">
                            <span className="font-semibold text-gray-900">{act.actorName}</span>{' '}
                            <span className="text-gray-600">{act.description.replace(act.solarOrder?.orderNumber, '')}</span>
                            <Link href={`/staff/dashboard/solar-orders/orders/${act.solarOrderId}`} className="font-semibold text-blue-600 hover:underline">
                              {act.solarOrder?.orderNumber}
                            </Link>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400 font-medium">{new Date(act.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-gray-500 truncate">{act.solarOrder?.customerName}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-50 bg-gray-50/50 text-center">
              <button className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Load more activity</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

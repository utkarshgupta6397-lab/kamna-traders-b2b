'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink, Clock, ChevronRight, Hash, User, Zap, Check } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { getWorkflowStageName } from '@/lib/solar-workflow-config';

interface QueueItem {
  id: string; // The step ID
  solarOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    systemSize: number;
    systemType: string;
  };
  stepIndex: number;
  stepKey: string;
  status: string;
  blockedReason: string | null;
  updatedAt: Date;
  metadata: any;
}

export default function QueueTable({ 
  items, 
  queueType 
}: { 
  items: QueueItem[],
  queueType: 'DOCUMENTATION' | 'INSTALLATION'
}) {
  const tabPath = queueType === 'DOCUMENTATION' ? 'documentation' : 'installation';

  if (items.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl border border-gray-100 text-center py-16 shadow-sm flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <Check size={24} className="text-gray-400" />
        </div>
        <h3 className="text-gray-900 font-medium mb-1">Queue is empty</h3>
        <p className="text-gray-500 text-sm">No active orders are currently waiting in this queue.</p>
      </div>
    );
  }

  // Group items by order
  const groupedOrders = items.reduce((acc, item) => {
    const orderId = item.solarOrder.id;
    if (!acc[orderId]) {
      acc[orderId] = {
        order: item.solarOrder,
        steps: []
      };
    }
    acc[orderId].steps.push(item);
    return acc;
  }, {} as Record<string, { order: QueueItem['solarOrder'], steps: QueueItem[] }>);

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'BLOCKED') return <span className="bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">Blocked</span>;
    if (status === 'IN_PROGRESS') return <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase animate-pulse">In Progress</span>;
    return <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">Pending</span>;
  };

  const getDaysColor = (days: number) => {
    if (days > 7) return 'text-red-600 bg-red-50 border-red-100';
    if (days >= 4) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">Order Details</th>
              <th className="px-5 py-3.5">Customer & System</th>
              <th className="px-5 py-3.5">Active Steps</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {Object.values(groupedOrders).map(({ order, steps }) => {
              // Find the max days at step for the whole order group to color the alert if needed
              const maxDays = Math.max(...steps.map(s => differenceInDays(new Date(), new Date(s.updatedAt))));
              const isCriticallyDelayed = maxDays > 7;

              return (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                  
                  {/* Order Details */}
                  <td className="px-5 py-4 align-top">
                    <Link href={`/staff/dashboard/solar-orders/orders/${order.id}/${tabPath}`} className="block w-max">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          <Hash size={14} className="text-gray-400" />
                          {order.orderNumber}
                        </span>
                        {isCriticallyDelayed && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {steps.length} pending action{steps.length > 1 ? 's' : ''}
                      </span>
                    </Link>
                  </td>

                  {/* Customer Info */}
                  <td className="px-5 py-4 align-top">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <User size={14} className="text-gray-400" />
                        {order.customerName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Zap size={13} className="text-amber-500" />
                        {order.systemSize} kWp <span className="text-gray-300">|</span> {order.systemType.replace('_', '-')}
                      </div>
                    </div>
                  </td>

                  {/* Active Steps (Grouped) */}
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-2.5">
                      {steps.map((step) => {
                        const stepName = getWorkflowStageName(queueType, step.stepKey);
                        const daysAtStep = differenceInDays(new Date(), new Date(step.updatedAt));
                        const daysColorClass = getDaysColor(daysAtStep);

                        return (
                          <div key={step.id} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm font-medium text-gray-800">{step.stepIndex}. {stepName}</span>
                              <StatusBadge status={step.status} />
                              <div className={`flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded border ${daysColorClass}`}>
                                <Clock size={10} />
                                {daysAtStep}d
                              </div>
                            </div>
                            {step.blockedReason && (
                              <div className="flex items-start gap-1.5 mt-1 text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded-md border border-red-100 max-w-sm whitespace-normal leading-snug">
                                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                                <span>{step.blockedReason}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-5 py-4 align-middle text-right">
                    <Link 
                      href={`/staff/dashboard/solar-orders/orders/${order.id}/${tabPath}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                      title="Open Order"
                    >
                      <ChevronRight size={16} className="ml-0.5" />
                    </Link>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

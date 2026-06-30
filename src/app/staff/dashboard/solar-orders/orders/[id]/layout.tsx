import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Zap, IndianRupee, Phone, CalendarDays } from 'lucide-react';
import OrderDetailTabs from './OrderDetailTabs';
import OrderHeaderActions from './OrderHeaderActions';

export default async function OrderDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  if (!session?.solar_orders_view) {
    redirect('/staff/dashboard/solar-orders');
  }

  const { id } = await params;

  const order = await prisma.solarOrder.findUnique({
    where: { id },
    include: {
      salesman: { select: { name: true } },
      callingExecutive: { select: { name: true } },
    },
  });

  if (!order) {
    redirect('/staff/dashboard/solar-orders/orders');
  }

  // Authorization Check
  if (order.status === 'PENDING_APPROVAL' || order.status === 'REJECTED') {
    if (order.createdById !== session?.userId && !(isAdmin || !!session?.solar_orders_approve)) {
      redirect('/staff/dashboard/solar-orders/orders');
    }
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
      APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
      EXECUTION: 'bg-purple-50 text-purple-700 border-purple-200',
      COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
      CANCELLED: 'bg-gray-50 text-gray-700 border-gray-200',
    };
    const config = configs[status] || configs.DRAFT;
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.replace('bg-', 'bg-').replace('-50', '-500').replace('-100', '-500')}`}></span>
        {status.replace('_', ' ')}
      </div>
    );
  };

  const initials = order.customerName.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <Link href="/staff/dashboard/solar-orders/orders" className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 w-max transition-colors">
        <ChevronLeft size={14} /> Back to Orders
      </Link>

      {/* Modern High-Density Sticky Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-14 z-40 overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="hidden sm:flex w-12 h-12 rounded-full bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0 shadow-sm mt-1">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">{order.customerName}</h1>
                {getStatusBadge(order.status)}
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-1.5 font-medium text-gray-900 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                  <span className="text-gray-400">#</span> {order.orderNumber}
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400" />
                  {order.phoneNumber}
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  {order.systemSize} kW <span className="text-gray-400 text-xs">({order.systemType.replace('_', '-')})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <IndianRupee size={14} className="text-gray-400" />
                  {order.totalOrderAmount.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-gray-400" />
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 mt-2 md:mt-0">
            <OrderHeaderActions 
              orderId={id} 
              status={order.status} 
              canApprove={isAdmin || !!session?.solar_orders_approve} 
            />
          </div>
        </div>

        {/* Segmented Control Tab Navigation */}
        <div className="border-t border-gray-100 bg-gray-50/50 p-2 pb-0 sm:px-4">
          <OrderDetailTabs orderId={id} />
        </div>
      </div>

      {/* Content Area */}
      <div className="pb-12">
        {children}
      </div>
    </div>
  );
}

import React from 'react';
import {
  IndianRupee,
  ShoppingBag,
  CreditCard,
  Box,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import DashboardKpiCard from './DashboardKpiCard';

export default function DashboardKpiGrid() {
  const kpis = [
    {
      id: 'total-sales',
      title: 'Total Sales',
      subtitle: 'Billing period',
      icon: IndianRupee,
      iconBgClass: 'bg-blue-50 border border-blue-100',
      iconColorClass: 'text-blue-600',
    },
    {
      id: 'total-orders',
      title: 'Total Orders',
      subtitle: 'Fulfilled & active',
      icon: ShoppingBag,
      iconBgClass: 'bg-purple-50 border border-purple-100',
      iconColorClass: 'text-purple-600',
    },
    {
      id: 'pending-payments',
      title: 'Pending Payments',
      subtitle: 'Receivables',
      icon: CreditCard,
      iconBgClass: 'bg-amber-50 border border-amber-100',
      iconColorClass: 'text-amber-600',
    },
    {
      id: 'inventory-value',
      title: 'Inventory Value',
      subtitle: 'Warehouse stock',
      icon: Box,
      iconBgClass: 'bg-indigo-50 border border-indigo-100',
      iconColorClass: 'text-indigo-600',
    },
    {
      id: 'low-stock-items',
      title: 'Low Stock Items',
      subtitle: 'Below reorder',
      icon: AlertTriangle,
      iconBgClass: 'bg-rose-50 border border-rose-100',
      iconColorClass: 'text-rose-600',
    },
    {
      id: 'pending-operations',
      title: 'Pending Operations',
      subtitle: 'Transfers & approvals',
      icon: Activity,
      iconBgClass: 'bg-emerald-50 border border-emerald-100',
      iconColorClass: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 xl:gap-3 shrink-0">
      {kpis.map((kpi) => (
        <DashboardKpiCard
          key={kpi.id}
          title={kpi.title}
          subtitle={kpi.subtitle}
          icon={kpi.icon}
          iconBgClass={kpi.iconBgClass}
          iconColorClass={kpi.iconColorClass}
        />
      ))}
    </div>
  );
}

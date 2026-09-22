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

export interface DashboardKpiSummaryData {
  totalSalesToday: number;
  totalInvoiceToday: number;
}

export interface DashboardKpiGridProps {
  data?: DashboardKpiSummaryData | null;
  isLoading?: boolean;
  isError?: boolean;
}

export default function DashboardKpiGrid({
  data,
  isLoading = false,
  isError = false,
}: DashboardKpiGridProps) {
  const formattedSales =
    data !== null && data !== undefined
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(data.totalSalesToday)
      : null;

  const formattedInvoices =
    data !== null && data !== undefined
      ? data.totalInvoiceToday.toLocaleString('en-IN')
      : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 xl:gap-3 shrink-0">
      {/* 1. Real KPI: Total Sales Today (no subtext) */}
      <DashboardKpiCard
        title="TOTAL SALES TODAY"
        icon={IndianRupee}
        iconBgClass="bg-blue-50 border border-blue-100"
        iconColorClass="text-blue-600"
        value={formattedSales}
        isLoading={isLoading}
        isError={isError}
        isWip={false}
      />

      {/* 2. Real KPI: Total Invoice Today (no subtext) */}
      <DashboardKpiCard
        title="TOTAL INVOICE TODAY"
        icon={ShoppingBag}
        iconBgClass="bg-purple-50 border border-purple-100"
        iconColorClass="text-purple-600"
        value={formattedInvoices}
        isLoading={isLoading}
        isError={isError}
        isWip={false}
      />

      {/* 3. WIP: Pending Payments */}
      <DashboardKpiCard
        title="PENDING PAYMENTS"
        icon={CreditCard}
        iconBgClass="bg-amber-50 border border-amber-100"
        iconColorClass="text-amber-600"
        isWip={true}
      />

      {/* 4. WIP: Inventory Value */}
      <DashboardKpiCard
        title="INVENTORY VALUE"
        icon={Box}
        iconBgClass="bg-indigo-50 border border-indigo-100"
        iconColorClass="text-indigo-600"
        isWip={true}
      />

      {/* 5. WIP: Low Stock Items */}
      <DashboardKpiCard
        title="LOW STOCK ITEMS"
        icon={AlertTriangle}
        iconBgClass="bg-rose-50 border border-rose-100"
        iconColorClass="text-rose-600"
        isWip={true}
      />

      {/* 6. WIP: Pending Operations */}
      <DashboardKpiCard
        title="PENDING OPERATIONS"
        icon={Activity}
        iconBgClass="bg-emerald-50 border border-emerald-100"
        iconColorClass="text-emerald-600"
        isWip={true}
      />
    </div>
  );
}

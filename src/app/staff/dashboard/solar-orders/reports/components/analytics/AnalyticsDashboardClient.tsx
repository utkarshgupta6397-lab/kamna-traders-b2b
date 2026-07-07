'use client';

import { useMemo, useState } from 'react';
import type { NormalizedOrder } from '@/lib/report-analytics';
import {
  getDefaultFilterState,
  buildFilterOptions,
  applyFilters,
  buildReportData,
  exportOrdersToCSV,
  type FilterState,
  type AgentSummary,
} from '@/lib/report-analytics';

import AnalyticsFilterPanel from './AnalyticsFilterPanel';
import KPISection from './KPISection';
import RevenueSection from './RevenueSection';
import WorkflowSection from './WorkflowSection';
import PaymentsSection from './PaymentsSection';
import LeadSection from './LeadSection';
import AgentRankingSection from './AgentRankingSection';
import AgentDrawer from './AgentDrawer';

interface AnalyticsDashboardClientProps {
  baseDataset: NormalizedOrder[];
  title: string;
  subtitle: string;
  primaryDimension: 'salesman' | 'callingExecutive' | 'subVendor';
}

export default function AnalyticsDashboardClient({
  baseDataset,
  title,
  subtitle,
  primaryDimension,
}: AnalyticsDashboardClientProps) {
  const [filterState, setFilterState] = useState<FilterState>(getDefaultFilterState());
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);

  const filterOptions = useMemo(() => buildFilterOptions(baseDataset), [baseDataset]);

  const filteredOrders = useMemo(() => applyFilters(baseDataset, filterState), [baseDataset, filterState]);

  const reportData = useMemo(() => buildReportData(filteredOrders, primaryDimension), [filteredOrders, primaryDimension]);

  const handleExportCSV = () => {
    exportOrdersToCSV(filteredOrders, `Export_${title.replace(/\\s+/g, '_')}.csv`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc] relative">
      <AnalyticsFilterPanel
        filterState={filterState}
        filterOptions={filterOptions}
        onFilterChange={setFilterState}
        onExportCSV={handleExportCSV}
        loading={false}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>

        <KPISection kpis={reportData.kpis} loading={false} />

        <div className="space-y-6">
          <RevenueSection
            monthly={reportData.monthly}
            quarterly={reportData.quarterly}
            systemType={reportData.systemType}
            primaryRanking={reportData.primaryRanking}
            primaryDimension={primaryDimension}
          />
          <AgentRankingSection
            primaryRanking={reportData.primaryRanking}
            primaryDimension={primaryDimension}
            onAgentClick={setSelectedAgent}
          />
          <PaymentsSection
            monthly={reportData.monthly}
            primaryRanking={reportData.primaryRanking}
            ageBuckets={reportData.ageBuckets}
            paymentMode={reportData.paymentMode}
            primaryDimension={primaryDimension}
          />
          <LeadSection
            leadSource={reportData.leadSource}
            primaryRanking={reportData.primaryRanking}
            primaryDimension={primaryDimension}
          />
          <WorkflowSection statusDistribution={reportData.statusDistribution} />
        </div>
      </div>

      <AgentDrawer
        agent={selectedAgent}
        allFilteredOrders={filteredOrders}
        primaryDimension={primaryDimension}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}

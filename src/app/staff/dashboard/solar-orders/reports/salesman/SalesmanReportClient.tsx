'use client';

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from 'react';
import { BarChart2 } from 'lucide-react';
import {
  type NormalizedOrder,
  type FilterState,
  type FilterOptions,
  type SalesmanSummary,
  getDefaultFilterState,
  applyFilters,
  buildReportData,
  buildFilterOptions,
  exportOrdersToCSV,
} from '@/lib/report-salesman';
import { formatIndianCurrency } from '@/lib/formatters';

// Lazy-import sections (dynamic imports for code splitting)
import dynamic from 'next/dynamic';

const SalesmanFilterPanel = dynamic(() => import('./components/SalesmanFilterPanel'), { ssr: false });
const KPISection = dynamic(() => import('./components/KPISection'), { ssr: false });
const RevenueSection = dynamic(() => import('./components/RevenueSection'), { ssr: false });
const SalesmanSection = dynamic(() => import('./components/SalesmanSection'), { ssr: false });
const PaymentsSection = dynamic(() => import('./components/PaymentsSection'), { ssr: false });
const LeadSection = dynamic(() => import('./components/LeadSection'), { ssr: false });
const WorkflowSection = dynamic(() => import('./components/WorkflowSection'), { ssr: false });
const SalesmanDrawer = dynamic(() => import('./components/SalesmanDrawer'), { ssr: false });

// ------------------------------------
// Section wrapper for consistent spacing
// ------------------------------------
const Section = memo(function Section({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16">
      {children}
    </section>
  );
});

// ------------------------------------
// Empty state
// ------------------------------------
const EmptyState = memo(function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-500 shadow-sm">
      <BarChart2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        {filtered ? 'No orders match the selected filters' : 'No approved orders found'}
      </h3>
      <p className="text-sm text-gray-500">
        {filtered
          ? 'Try adjusting or clearing your filters to see results.'
          : 'Approved orders will appear here once available.'}
      </p>
    </div>
  );
});

// ------------------------------------
// Main client component
// ------------------------------------
export default function SalesmanReportClient() {
  // === Raw data (fetched once) ===
  const [rawOrders, setRawOrders] = useState<NormalizedOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // === Filter state (client-side only) ===
  const [filterState, setFilterState] = useState<FilterState>(getDefaultFilterState);

  // === Drill-down state ===
  const [selectedSalesman, setSelectedSalesman] = useState<SalesmanSummary | null>(null);

  // === Fetch once on mount ===
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    setFetchError(null);

    fetch('/api/solar-orders/reports/salesman')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setRawOrders(data.orders ?? []);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[SalesmanReport] Fetch error:', err);
          setFetchError('Failed to load report data. Please refresh.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => { cancelled = true; };
  }, []); // [] — fetch once, never again

  // === Derived: filter options (from rawOrders) ===
  const filterOptions: FilterOptions = useMemo(
    () => buildFilterOptions(rawOrders),
    [rawOrders],
  );

  // === Derived: filtered orders ===
  const filteredOrders: NormalizedOrder[] = useMemo(
    () => applyFilters(rawOrders, filterState),
    [rawOrders, filterState],
  );

  // === Derived: report data (single-pass aggregation) ===
  const reportData = useMemo(
    () => buildReportData(filteredOrders),
    [filteredOrders],
  );

  // === Callbacks ===
  const handleFilterChange = useCallback((newState: FilterState) => {
    setFilterState(newState);
  }, []);

  const handleSalesmanClick = useCallback((sm: SalesmanSummary) => {
    setSelectedSalesman(sm);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedSalesman(null);
  }, []);

  const handleExportCSV = useCallback(() => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportOrdersToCSV(filteredOrders, `salesman_report_${timestamp}.csv`);
  }, [filteredOrders]);

  // === Error state ===
  if (fetchError) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md">
          <p className="text-red-700 font-medium mb-2">Failed to load report</p>
          <p className="text-red-600 text-sm">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasOrders = filteredOrders.length > 0;
  const isFiltered = rawOrders.length !== filteredOrders.length;

  return (
    <div className="min-h-full pb-16">
      {/* ─── Sticky Filter Panel ─── */}
      <SalesmanFilterPanel
        filterState={filterState}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        onExportCSV={handleExportCSV}
        loading={loadingData}
      />

      <div className={`transition-opacity duration-300 ${loadingData ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {/* ─── Page Header ─── */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sales by Salesman</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Sales analytics across all salesmen
                {!loadingData && (
                  <span className="ml-2 text-gray-400">
                    · {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                    {isFiltered && ` of ${rawOrders.length}`}
                    {' '}· {formatIndianCurrency(reportData.kpis.totalSales, true)} revenue
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 space-y-6 pt-4">
          {/* ─── KPIs ─── */}
          <Section id="kpis">
            <KPISection kpis={reportData.kpis} loading={loadingData} />
          </Section>

          {/* ─── Empty state ─── */}
          {!loadingData && !hasOrders && (
            <EmptyState filtered={isFiltered} />
          )}

          {/* ─── Charts (only when there's data) ─── */}
          {(hasOrders || loadingData) && (
            <>
              {/* ─── Revenue Section ─── */}
              <Section id="revenue">
                <div className="mb-3">
                  <h2 className="text-base font-semibold text-gray-800">Revenue Trends</h2>
                </div>
                <RevenueSection
                  monthly={reportData.monthly}
                  quarterly={reportData.quarterly}
                  systemType={reportData.systemType}
                  salesmanRanking={reportData.salesmanRanking}
                />
              </Section>

              {/* ─── Salesman Section ─── */}
              <Section id="salesman">
                <SalesmanSection
                  salesmanRanking={reportData.salesmanRanking}
                  onSalesmanClick={handleSalesmanClick}
                />
              </Section>

              {/* ─── Payments Section ─── */}
              <Section id="payments">
                <PaymentsSection
                  monthly={reportData.monthly}
                  salesmanRanking={reportData.salesmanRanking}
                  ageBuckets={reportData.ageBuckets}
                  paymentMode={reportData.paymentMode}
                />
              </Section>

              {/* ─── Lead Analytics ─── */}
              <Section id="lead">
                <LeadSection
                  leadSource={reportData.leadSource}
                  callingExecRanking={reportData.callingExecRanking}
                />
              </Section>

              {/* ─── Workflow / Status ─── */}
              <Section id="workflow">
                <WorkflowSection statusDistribution={reportData.statusDistribution} />
              </Section>
            </>
          )}
        </div>
      </div>

      {/* ─── Salesman Drill-Down Drawer ─── */}
      <SalesmanDrawer
        salesman={selectedSalesman}
        allFilteredOrders={filteredOrders}
        onClose={handleDrawerClose}
      />
    </div>
  );
}

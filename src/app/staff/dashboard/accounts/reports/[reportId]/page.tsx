'use client';

import { use, useMemo } from 'react';
import { Filter, ChevronDown, Download, BarChart2, CheckCircle2 } from 'lucide-react';

const REPORT_INFO: Record<string, { title: string; description: string }> = {
  'sales-by-salesman': {
    title: 'Sales by Salesman',
    description: 'Detailed analytics and performance metrics for individual sales representatives.',
  },
  'collection-reports': {
    title: 'Collection Reports',
    description: 'Track and analyze payment collections, methods, and timelines.',
  },
  'outstanding-receivables': {
    title: 'Outstanding Receivables',
    description: 'Monitor pending payments from customers and age analysis of receivables.',
  },
  'outstanding-payables': {
    title: 'Outstanding Payables',
    description: 'Track upcoming and overdue payments to vendors and suppliers.',
  },
  'customer-ledger': {
    title: 'Customer Ledger',
    description: 'Comprehensive view of all financial transactions for individual customers.',
  },
  'vendor-ledger': {
    title: 'Vendor Ledger',
    description: 'Detailed history of purchases, payments, and balances with vendors.',
  },
  'bank-reports': {
    title: 'Bank Reports',
    description: 'Overview of bank transactions, reconciliations, and account balances.',
  },
  'gst-reports': {
    title: 'GST Reports',
    description: 'Generate tax liability, input tax credit, and filing ready GST reports.',
  },
  'profit-and-loss': {
    title: 'Profit & Loss',
    description: 'Analyze revenue, costs, and expenses to determine overall profitability.',
  },
  'cash-flow': {
    title: 'Cash Flow',
    description: 'Monitor cash inflows and outflows to manage business liquidity.',
  },
  'journal-reports': {
    title: 'Journal Reports',
    description: 'Detailed chronological record of all accounting journal entries.',
  },
  'ledger-reports': {
    title: 'Ledger Reports',
    description: 'Summary of all account balances and general ledger activities.',
  }
};

export default function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.reportId;
  
  const info = useMemo(() => {
    return REPORT_INFO[reportId] || {
      title: 'Report Overview',
      description: 'Select a report from the sidebar to view detailed analytics.'
    };
  }, [reportId]);

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc] relative">
      {/* ─── Main Content ─── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{info.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{info.description}</p>
        </div>

        {/* ─── Placeholder ─── */}
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-[#1A2766]/5 rounded-full flex items-center justify-center mb-4">
            <BarChart2 className="w-8 h-8 text-[#1A2766]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Coming Soon</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            This report is currently under development and will be available in a future release.
          </p>
        </div>

        {/* ─── Future Features Card ─── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Planned Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              "Interactive Charts",
              "Monthly Trends",
              "Quarterly Analytics",
              "Yearly Analytics",
              "Customer Breakdowns",
              "Outstanding Analysis",
              "Export to Excel",
              "Export to CSV",
              "Advanced Filters",
              "Date Range Selection",
              "Drill Down Reports"
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

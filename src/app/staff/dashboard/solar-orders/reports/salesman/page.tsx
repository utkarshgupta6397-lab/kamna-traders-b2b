'use client';

import { useEffect, useState } from 'react';
import type { NormalizedOrder } from '@/lib/report-analytics';
import AnalyticsDashboardClient from '../components/analytics/AnalyticsDashboardClient';
import { BarChart2 } from 'lucide-react';

export default function SalesmanReportPage() {
  const [orders, setOrders] = useState<NormalizedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/solar-orders/reports/analytics')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          // Salesman page operates on all approved orders EXCEPT sub-vendors
          const filtered = (data.orders ?? []).filter((o: NormalizedOrder) => o.leadSource !== 'SUB_VENDOR');
          setOrders(filtered);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error(err);
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center text-gray-500 animate-pulse">
          <BarChart2 className="w-12 h-12 mb-4 text-gray-300" />
          <p>Loading analytics engine...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <AnalyticsDashboardClient
      baseDataset={orders}
      title="Sales by Salesman"
      subtitle="Sales analytics across all external salesmen"
      primaryDimension="salesman"
    />
  );
}

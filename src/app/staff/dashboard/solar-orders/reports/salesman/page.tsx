import { Suspense } from 'react';
import SalesmanReportClient from './SalesmanReportClient';

export default async function SalesmanReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse flex flex-col items-center gap-2 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">Loading report...</span>
          </div>
        </div>
      }
    >
      <SalesmanReportClient />
    </Suspense>
  );
}

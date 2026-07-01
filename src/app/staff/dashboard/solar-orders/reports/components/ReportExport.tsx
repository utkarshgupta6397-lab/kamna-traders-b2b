'use client';

import { Download, Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ReportExport() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Determine API endpoint based on pathname
      const isSalesman = pathname.includes('/reports/salesman');
      const apiPath = isSalesman ? '/api/solar-orders/reports/salesman' : '/api/solar-orders/reports/calling-agent';
      
      const params = new URLSearchParams(searchParams.toString());
      params.set('format', 'csv');

      const response = await fetch(`${apiPath}?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${isSalesman ? 'salesman' : 'calling-agent'}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      Export
    </button>
  );
}

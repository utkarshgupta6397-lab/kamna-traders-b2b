'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface ExportSkusButtonProps {
  searchQuery: string;
}

export default function ExportSkusButton({ searchQuery }: ExportSkusButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    const loadingToast = toast.loading('Generating export...');

    try {
      const response = await fetch(`/api/admin/skus/export?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data for export');
      }

      const skus = await response.json();

      if (!skus || skus.length === 0) {
        toast.error('No data found to export', { id: loadingToast });
        return;
      }

      // Prepare data for XLSX
      const data = skus.map((sku: any) => ({
        'SKU ID': sku.id,
        'Product Name': sku.name,
        'Category': sku.category?.name || '—',
        'Brand': sku.brand?.name || '—',
        'Unit': sku.unit || '—',
        'Price (₹)': sku.price,
        'MOQ': sku.moq,
        'Step': sku.stepQty,
        'Case Size': sku.caseSize,
        'Zoho Internal ID': sku.zohoBookItemId ? String(sku.zohoBookItemId) : '—',
        'Zoho Books ID': sku.zohoBooksId2 || '—',
        'Created At': new Date(sku.createdAt).toLocaleString('en-IN'),
        'Updated At': new Date(sku.updatedAt).toLocaleString('en-IN'),
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'SKUs');

      // Generate filename: kamna-skus-12-May-2026.xlsx
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleString('en-IN', { month: 'short' });
      const year = now.getFullYear();
      const filename = `kamna-skus-${day}-${month}-${year}.xlsx`;

      // Trigger download
      XLSX.writeFile(workbook, filename);

      toast.success('Export completed successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.', { id: loadingToast });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      {isExporting ? 'Exporting...' : 'Export Data'}
    </button>
  );
}

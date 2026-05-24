'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, CheckCircle, XCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PreviewRow {
  _index: number;
  SKU_ID: string;
  Warehouse_Name: string;
  Qty: number | string;
  Zone?: string;
  status: 'VALID' | 'INVALID';
  message: string;
  existingQty: number;
  parsedQty: number;
  Result?: string;
}

export default function BulkInventoryImportClient() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ SKU_ID: 'SPA11', Warehouse_Name: 'Main Warehouse', Qty: 26, Zone: 'Ground Floor' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Bulk_Inventory_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setImportDone(false);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          toast.error('The uploaded file is empty.');
          setIsParsing(false);
          return;
        }

        await validateData(data);
      } catch (error) {
        console.error(error);
        toast.error('Failed to parse file. Ensure it is a valid CSV/XLSX.');
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(file);
    
    // Reset file input so same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateData = async (data: any[]) => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/admin/inventory/bulk-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Validation failed');
      
      setRows(json.results || []);
      setShowPreview(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsParsing(false);
      setIsValidating(false);
    }
  };

  const processImport = async () => {
    if (!rows.length) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/inventory/bulk-import/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Processing failed');

      setRows(json.results || []);
      setImportDone(true);
      toast.success('Import processed! Check results.');
      
      // Auto download results
      downloadResults(json.results);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResults = (resultRows = rows) => {
    const exportData = resultRows.map(r => ({
      SKU_ID: r.SKU_ID,
      Warehouse_Name: r.Warehouse_Name,
      Qty: r.Qty,
      Zone: r.Zone || '',
      Result: r.Result || r.message,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `Bulk_Import_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const reset = () => {
    setRows([]);
    setShowPreview(false);
    setImportDone(false);
  };

  const validCount = rows.filter(r => r.status === 'VALID').length;
  const invalidCount = rows.length - validCount;
  const canProcess = validCount > 0 && !importDone;

  const successCount = rows.filter(r => r.Result === 'SUCCESS').length;
  const failedCount = rows.filter(r => r.Result && r.Result !== 'SUCCESS').length;

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#1A2766]" /> Bulk Inventory Import
          </h2>
          <p className="text-sm text-gray-500">Upload a CSV or XLSX file to update inventory quantities.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="px-3 py-1.5 text-sm font-medium text-[#1A2766] border border-[#1A2766] rounded-lg hover:bg-indigo-50 transition flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Template
          </button>
          <label className="cursor-pointer px-4 py-1.5 text-sm font-medium text-white bg-[#1A2766] rounded-lg hover:bg-[#003347] transition flex items-center gap-1.5 shadow-sm">
            {isParsing || isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload File
            <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" ref={fileInputRef} onChange={handleFileUpload} disabled={isParsing || isValidating || isProcessing} />
          </label>
        </div>
      </div>

      {showPreview && (
        <div className="mt-6 border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4">
              <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 font-medium">Total Rows</p>
                <p className="text-xl font-bold text-blue-900">{rows.length}</p>
              </div>
              <div className="bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                <p className="text-xs text-green-600 font-medium">{importDone ? 'Successful' : 'Valid Rows'}</p>
                <p className="text-xl font-bold text-green-900">{importDone ? successCount : validCount}</p>
              </div>
              <div className="bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                <p className="text-xs text-red-600 font-medium">{importDone ? 'Failed' : 'Invalid Rows'}</p>
                <p className="text-xl font-bold text-red-900">{importDone ? failedCount : invalidCount}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={reset} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Reset
              </button>
              {importDone ? (
                <button onClick={() => downloadResults()} className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition flex items-center gap-1.5 shadow-sm">
                  <Download className="w-4 h-4" /> Download Results
                </button>
              ) : (
                <button 
                  onClick={processImport} 
                  disabled={!canProcess || isProcessing}
                  className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg transition flex items-center gap-1.5 shadow-sm ${!canProcess ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#1A2766] hover:bg-[#003347]'}`}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Process {validCount} Rows
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Row</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">SKU</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Warehouse</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Existing Qty</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">New Qty</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Zone</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((row, i) => {
                  const isSuccess = importDone ? row.Result === 'SUCCESS' : row.status === 'VALID';
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-500">{row._index + 1}</td>
                      <td className="px-4 py-2 font-mono font-medium">{row.SKU_ID || '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{row.Warehouse_Name || '-'}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{row.existingQty !== undefined ? row.existingQty : '-'}</td>
                      <td className={`px-4 py-2 text-right font-medium ${row.parsedQty !== row.existingQty ? 'text-blue-600' : 'text-gray-900'}`}>{row.Qty}</td>
                      <td className="px-4 py-2 text-gray-600">{row.Zone || '-'}</td>
                      <td className="px-4 py-2 max-w-xs truncate" title={importDone ? row.Result : row.message}>
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium">
                            <CheckCircle className="w-3 h-3" /> {importDone ? 'SUCCESS' : 'VALID'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-medium">
                            <XCircle className="w-3 h-3 shrink-0" /> <span className="truncate">{importDone ? row.Result : row.message}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

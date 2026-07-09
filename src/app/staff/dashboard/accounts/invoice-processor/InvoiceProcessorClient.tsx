'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle, AlertTriangle, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProcessingResult } from '@/lib/services/invoice-processor.service';

export default function InvoiceProcessorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.name.toLowerCase().endsWith('.xlsx') || 
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setFile(selectedFile);
      setResult(null); // Reset previous results
    } else {
      toast.error('Only .xlsx files are supported.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/accounts/invoice-processor/process', {
        method: 'POST',
        body: formData,
      });

      const data: ProcessingResult = await res.json();
      setResult(data);

      if (data.success && data.base64Output && data.fileName) {
        toast.success('File processed successfully!');
        // Trigger auto download
        triggerDownload(data.base64Output, data.fileName);
      } else if (!data.success && data.errors) {
        toast.error(`Validation failed with ${data.errors.length} errors.`);
      } else {
        toast.error('An unknown error occurred.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to process file.');
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (base64Str: string, fileName: string) => {
    const byteCharacters = atob(base64Str);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadErrorCSV = () => {
    if (!result?.errors) return;
    
    const header = 'Row,Error\n';
    const csv = result.errors.map(e => `${e.row},"${e.error.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation_errors.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      
      {/* State 1: Success Results */}
      {result?.success && result.stats && (
        <div className="bg-white border border-emerald-200 rounded-xl shadow-sm p-6 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 flex-shrink-0">
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Processing Complete</h3>
                <p className="text-gray-500 text-sm mt-1">
                  The invoice export has been successfully converted.
                </p>
              </div>
            </div>
            <button 
              onClick={resetAll}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Invoices Processed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{result.stats.invoicesProcessed}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Rows Processed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{result.stats.rowsProcessed}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Invoice Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{result.stats.invoiceMonth}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Processing Time</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{(result.stats.processingTimeMs / 1000).toFixed(2)}s</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between bg-emerald-50 px-4 py-3 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-emerald-600" size={18} />
              <span className="text-sm font-medium text-emerald-900">{result.fileName}</span>
            </div>
            <button
              onClick={() => {
                if (result.base64Output && result.fileName) {
                  triggerDownload(result.base64Output, result.fileName);
                }
              }}
              className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow-sm font-medium transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Download Excel
            </button>
          </div>
        </div>
      )}

      {/* State 2: Validation Errors */}
      {result?.success === false && result.errors && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          
          <div className="p-6 border-b border-red-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Validation Failed</h3>
                  <p className="text-red-600 font-medium text-sm mt-1">
                    {result.errors.length} {result.errors.length === 1 ? 'Error' : 'Errors'} Found
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadErrorCSV}
                  className="text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded shadow-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Download Report
                </button>
                <button onClick={() => setResult(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50/30 max-h-[400px] overflow-y-auto p-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 bg-gray-50 uppercase sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 w-32 font-bold">Row</th>
                  <th className="px-6 py-3 font-bold">Error Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.errors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-red-50/50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {err.row > 0 ? `Row ${err.row}` : 'Global'}
                    </td>
                    <td className="px-6 py-3 text-gray-700">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* State 3: Upload Area */}
      {!result?.success && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-semibold text-gray-800">Upload Raw Invoice Excel</h2>
          </div>
          
          <div className="p-6">
            {!file ? (
              <div 
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors ${isDragging ? 'border-[#1A2766] bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center text-[#1A2766] mb-4">
                  <UploadCloud size={28} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Drag & Drop</h3>
                <p className="text-gray-500 mt-1 mb-6">or select a file from your computer</p>
                
                <input 
                  type="file" 
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-2 px-6 rounded-lg shadow-sm transition-all"
                >
                  Browse File
                </button>
                
                <p className="text-xs text-gray-400 mt-6">
                  Supported Format: .xlsx
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-[#1A2766]">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 truncate max-w-md">{file.name}</h3>
                      <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFile(null)}
                    disabled={loading}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setFile(null)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shadow-sm disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <button
                    onClick={handleProcess}
                    disabled={loading}
                    className="px-6 py-2 text-sm font-medium text-white bg-[#1A2766] rounded hover:bg-[#1A2766]/90 shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Process File'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

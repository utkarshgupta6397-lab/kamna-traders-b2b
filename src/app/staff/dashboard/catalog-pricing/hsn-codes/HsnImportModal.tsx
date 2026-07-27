'use client';

import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface HsnImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function HsnImportModal({ isOpen, onClose, onSuccess }: HsnImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      parsePreview(selected);
    }
  };

  const parsePreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]) as any[];
        setPreviewData(rows.slice(0, 5));
      } catch (error) {
        console.error('Preview parsing error', error);
        toast.error('Failed to parse file preview.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file to import.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/staff/catalog/hsn-codes/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      toast.success(data.message || `Successfully imported HSN records`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-[#1A2766]" />
            Upload HSN Helper Data
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex items-start gap-2 border border-blue-100">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>
              Upload an official Government HSN Master file (CSV or Excel) to populate the helper table.
              Required columns: <strong>HSN_CD</strong> and <strong>HSN_Description</strong>.
              Hierarchy and levels will be inferred automatically. This will not create master records.
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#1A2766]/50 bg-gray-50'
            }`}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <FileSpreadsheet size={32} className="text-green-600" />
                <div className="text-sm font-medium text-gray-900">{file.name}</div>
                <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreviewData([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Remove File
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 cursor-pointer">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <UploadCloud size={24} className="text-[#1A2766]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#1A2766]">Click to upload</div>
                  <div className="text-xs text-gray-500 mt-1">Excel (.xlsx) or CSV</div>
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
            />
          </div>

          {previewData.length > 0 && (
            <div className="mt-4 border rounded-lg overflow-hidden border-gray-200">
              <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
                Data Preview (First 5 Rows)
              </div>
              <div className="max-h-32 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 font-medium whitespace-nowrap">HSN Code</th>
                      <th className="px-3 py-1.5 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-1.5 font-mono">{row['HSN_CD'] || row['HSN Code'] || '-'}</td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{row['HSN_Description'] || row['Description'] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-[#1A2766] rounded-lg hover:bg-[#152052] transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Commit Import
          </button>
        </div>
      </div>
    </div>
  );
}

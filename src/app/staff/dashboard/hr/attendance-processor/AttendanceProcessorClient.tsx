'use client';

import { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  Loader2,
  Users,
  Calendar,
  FileText,
  Clock,
  Printer,
  Search,
  CheckSquare,
  Square,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AttendanceProcessingResult,
  ParsedEmployeeItem,
  AttendanceSummaryStats,
  AttendanceParseResponse,
} from '@/lib/services/hr/attendance-types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes

type WorkflowStep = 'UPLOAD' | 'SELECTION' | 'RESULT';

export default function AttendanceProcessorClient() {
  const [step, setStep] = useState<WorkflowStep>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Parsed employee data & selection
  const [parsedEmployees, setParsedEmployees] = useState<ParsedEmployeeItem[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedStats, setParsedStats] = useState<AttendanceSummaryStats | null>(null);

  // PDF generation result & preview
  const [result, setResult] = useState<AttendanceProcessingResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (selectedFile: File) => {
    // 1. Enforce .xlsx extension strictly
    const isXlsx =
      selectedFile.name.toLowerCase().endsWith('.xlsx') ||
      selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isXlsx) {
      toast.error('Only .xlsx files are supported.');
      return;
    }

    // 2. Enforce 5 MB limit
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Please upload an Excel file up to 5 MB.');
      return;
    }

    setFile(selectedFile);
    setStep('UPLOAD');
    setParsedEmployees([]);
    setSelectedEmployeeIds(new Set());
    setParseErrors([]);
    setResult(null);
    setSearchQuery('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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

  const handleRemoveFile = () => {
    setFile(null);
    setStep('UPLOAD');
    setParsedEmployees([]);
    setSelectedEmployeeIds(new Set());
    setParseErrors([]);
    setResult(null);
    setSearchQuery('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Step 1 -> Step 2: Parse attendance data & show employee selection
  const handleParseData = async () => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Please upload an Excel file up to 5 MB.');
      return;
    }

    setParsing(true);
    setParseErrors([]);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/hr/attendance/parse', {
        method: 'POST',
        body: formData,
      });

      const data: AttendanceParseResponse = await res.json();

      if (data.success && data.employees && data.employees.length > 0) {
        setParsedEmployees(data.employees);
        setParsedStats(data.stats || null);
        // Default selection: All eligible employees selected
        const allIds = new Set(data.employees.map(e => e.id));
        setSelectedEmployeeIds(allIds);
        setStep('SELECTION');
        toast.success(`${data.employees.length} eligible employees found.`);
      } else {
        const errs = data.validationErrors || [data.error || 'Failed to parse attendance file.'];
        setParseErrors(errs);
        toast.error(errs[0]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Network or server error while parsing file.');
      setParseErrors(['Unable to reach the server. Please try again.']);
    } finally {
      setParsing(false);
    }
  };

  // Step 2 Selection helpers
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return parsedEmployees;
    const q = searchQuery.toLowerCase().trim();
    return parsedEmployees.filter(
      e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    );
  }, [parsedEmployees, searchQuery]);

  const allSelected = parsedEmployees.length > 0 && selectedEmployeeIds.size === parsedEmployees.length;

  const handleToggleSelectAll = () => {
    if (selectedEmployeeIds.size === parsedEmployees.length) {
      // Deselect all
      setSelectedEmployeeIds(new Set());
    } else {
      // Select all
      setSelectedEmployeeIds(new Set(parsedEmployees.map(e => e.id)));
    }
  };

  const handleToggleEmployee = (id: string) => {
    const next = new Set(selectedEmployeeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEmployeeIds(next);
  };

  // Step 2 -> Step 3: Generate PDF for selected employees
  const handleGeneratePdf = async () => {
    if (!file || selectedEmployeeIds.size === 0) return;

    setGeneratingPdf(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('selectedEmployeeIds', JSON.stringify(Array.from(selectedEmployeeIds)));

    try {
      const res = await fetch('/api/hr/attendance/process', {
        method: 'POST',
        body: formData,
      });

      const data: AttendanceProcessingResult = await res.json();
      setResult(data);

      if (data.success && data.pdfBase64) {
        toast.success('Attendance statement PDF generated!');
        // Create Blob URL for preview and download
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setPreviewUrl(blobUrl);
        setStep('RESULT');
      } else {
        toast.error(data.error || 'Failed to generate PDF.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Network or server error while generating PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl || !result?.fileName) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenPreview = () => {
    if (previewUrl) {
      setPreviewOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Upload & Parse Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
            isDragging
              ? 'border-[#1A2766] bg-blue-50/50'
              : 'border-gray-300 hover:border-[#1A2766]/60 bg-gray-50/50'
          }`}
        >
          <div className="w-14 h-14 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-7 h-7 text-[#1A2766]" />
          </div>

          <h3 className="text-base font-semibold text-gray-900 mb-1">Upload Attendance File</h3>
          <p className="text-xs text-gray-500 max-w-sm mb-4">
            Drag and drop your attendance Excel export here, or browse. Only{' '}
            <span className="font-semibold text-gray-700">.xlsx</span> files up to{' '}
            <span className="font-semibold text-gray-700">5 MB</span> are supported.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            className="hidden"
            id="attendance-file-input"
          />

          <label
            htmlFor="attendance-file-input"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium shadow-xs transition"
          >
            <UploadCloud size={16} />
            Browse File
          </label>
        </div>

        {/* Selected File Feedback */}
        {file && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border border-slate-200 text-[#1A2766]">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={parsing || generatingPdf}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition"
                title="Remove file"
              >
                <X size={16} />
              </button>

              {step === 'UPLOAD' && (
                <button
                  type="button"
                  onClick={handleParseData}
                  disabled={parsing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A2766] hover:bg-[#152054] text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {parsing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Parsing Attendance...
                    </>
                  ) : (
                    'Process Attendance Data'
                  )}
                </button>
              )}

              {step !== 'UPLOAD' && (
                <button
                  type="button"
                  onClick={handleParseData}
                  disabled={parsing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md font-medium transition"
                >
                  Re-parse File
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Validation Errors Display */}
      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-red-900">Unable to process attendance file</h4>
              <ul className="mt-2 text-xs text-red-700 space-y-1 list-disc list-inside">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-red-600">
                Please correct the Excel file and upload it again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Employee Selection Section */}
      {step === 'SELECTION' && parsedEmployees.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          {/* Header & Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-tight">
                Select Employees
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-800">{parsedEmployees.length} employees found</span>.
                Select the employees you want to include in the PDF attendance statement.
              </p>
            </div>

            {/* Selection Status Badge */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-50 text-[#1A2766] border border-blue-200 rounded-full text-xs font-bold">
                {selectedEmployeeIds.size} of {parsedEmployees.length} Selected
              </span>
            </div>
          </div>

          {/* Search & Bulk Selection Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees by name or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-md text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Select / Deselect All Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-md shadow-2xs transition"
              >
                {allSelected ? (
                  <>
                    <Square size={14} className="text-gray-500" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} className="text-[#1A2766]" />
                    Select All
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Scrollable Employee List */}
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {filteredEmployees.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                No employees matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredEmployees.map(emp => {
                const isSelected = selectedEmployeeIds.has(emp.id);

                return (
                  <label
                    key={emp.id}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors ${
                      isSelected ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleEmployee(emp.id)}
                        className="w-4 h-4 rounded text-[#1A2766] border-gray-300 focus:ring-[#1A2766]"
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-900 leading-snug">{emp.name}</p>
                        <p className="text-[10px] font-mono text-gray-400">{emp.id}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 font-medium">{emp.monthYear}</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Generate PDF Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {selectedEmployeeIds.size === 0 ? (
                <span className="text-amber-600 font-medium">Select at least one employee to generate PDF.</span>
              ) : (
                <span>
                  Ready to generate statement for <strong className="text-gray-800">{selectedEmployeeIds.size}</strong> employees.
                </span>
              )}
            </span>

            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={selectedEmployeeIds.size === 0 || generatingPdf}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1A2766] hover:bg-[#152054] text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generatingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating Final PDF...
                </>
              ) : (
                <>
                  <Printer size={16} />
                  Generate PDF ({selectedEmployeeIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Final Processing Result */}
      {step === 'RESULT' && result && result.success && result.stats && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold text-gray-900 text-base">Attendance Processed</span>
            </div>
            <div className="text-xs text-gray-500 font-mono">
              Ready for Print (A4 Landscape)
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Users size={14} />
                <span>Employees Selected</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{result.stats.totalEmployees}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <FileText size={14} />
                <span>Attendance Records</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{result.stats.totalRecords.toLocaleString()}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Calendar size={14} />
                <span>Pages / Months</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{result.stats.totalMonths}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
                <Clock size={14} />
                <span>Missing Punches</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{result.stats.missingPunches}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('SELECTION')}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium transition"
            >
              <ArrowLeft size={14} />
              Adjust Employee Selection
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenPreview}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg shadow-2xs transition"
              >
                <Eye size={16} />
                Preview PDF
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A2766] hover:bg-[#152054] text-white text-sm font-medium rounded-lg shadow-sm transition"
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer size={18} className="text-slate-400" />
                <span className="font-medium text-sm">Attendance Statement (A4 Landscape Preview)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium transition"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition"
                  title="Close Preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF Iframe */}
            <div className="flex-1 bg-slate-200">
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full border-0"
                title="Attendance PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

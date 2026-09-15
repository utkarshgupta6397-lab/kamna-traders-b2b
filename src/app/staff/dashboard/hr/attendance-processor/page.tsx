import { ExternalLink } from 'lucide-react';
import AttendanceProcessorClient from './AttendanceProcessorClient';

export default function AttendanceProcessorPage() {
  return (
    <div className="w-full max-w-5xl mx-auto py-2">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Processor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload biometric attendance Excel export (.xlsx) to generate print-ready A4 landscape attendance statements.
          </p>
        </div>
        <div className="flex-shrink-0">
          <a
            href="https://payroll.petpooja.com/attendance-master"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
          >
            <span>Attendance Master</span>
            <ExternalLink className="w-4 h-4 text-blue-600" />
          </a>
        </div>
      </div>

      <AttendanceProcessorClient />
    </div>
  );
}

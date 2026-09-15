export interface RawAttendanceRow {
  'Employee ID'?: string;
  'Employee Name'?: string;
  'Department'?: string;
  'Designation'?: string;
  'Date'?: string | number | Date;
  'Day'?: string;
  'Punch In'?: string;
  'Punch Out'?: string;
  'Total Working Hours'?: string;
  'Total Break'?: string;
  'Status'?: string;
  [key: string]: any;
}

export type DayStatus = 'FD' | 'HD' | 'Absent' | 'Missing In' | 'Missing Out' | 'Sunday' | string;

export interface NormalizedAttendanceRecord {
  dateStr: string;       // e.g. "01"
  fullDateStr: string;   // e.g. "01-08-2026"
  dayOfWeek: string;     // e.g. "Sat", "Sun"
  punchIn: string;       // e.g. "09:48 AM" or "-"
  punchOut: string;      // e.g. "07:44 PM" or "-"
  hours: string;         // e.g. "9h 55m" or "-"
  status: DayStatus;     // "FD", "Absent", "Missing Out", "Sunday", etc.
  isSunday: boolean;
  isProblematic: boolean; // true if Missing In, Missing Out, or Absent (non-Sunday)
}

export interface MonthlyAttendanceSheet {
  employeeId: string;
  employeeName: string;
  department?: string;
  designation?: string;
  year: number;
  month: number;          // 1-12
  monthName: string;      // e.g. "AUGUST"
  monthYearLabel: string; // e.g. "AUGUST 2026"
  totalDays: number;
  totalSundays: number;
  records: NormalizedAttendanceRecord[];
}

export interface AttendanceSummaryStats {
  totalEmployees: number;
  totalRecords: number;
  totalMonths: number;
  missingPunches: number;
}

export interface AttendanceProcessingResult {
  success: boolean;
  stats?: AttendanceSummaryStats;
  fileName?: string;
  pdfBase64?: string;
  error?: string;
  validationErrors?: string[];
}

export interface ParsedEmployeeItem {
  id: string;
  name: string;
  monthYear: string;
  recordCount: number;
}

export interface AttendanceParseResponse {
  success: boolean;
  stats?: AttendanceSummaryStats;
  employees?: ParsedEmployeeItem[];
  error?: string;
  validationErrors?: string[];
}

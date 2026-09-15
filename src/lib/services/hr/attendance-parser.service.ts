import * as XLSX from 'xlsx';
import {
  RawAttendanceRow,
  NormalizedAttendanceRecord,
  MonthlyAttendanceSheet,
  AttendanceSummaryStats,
  ParsedEmployeeItem,
} from './attendance-types';

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ParsedDateResult {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  dateObj: Date;
}

export function parseFlexibleDate(val: any): ParsedDateResult | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    return {
      year: val.getFullYear(),
      month: val.getMonth() + 1,
      day: val.getDate(),
      dateObj: val,
    };
  }

  // Excel serial number (e.g., 45139)
  if (typeof val === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = val * 86400000;
    const dateObj = new Date(excelEpoch.getTime() + millis);
    if (!isNaN(dateObj.getTime())) {
      return {
        year: dateObj.getUTCFullYear(),
        month: dateObj.getUTCMonth() + 1,
        day: dateObj.getUTCDate(),
        dateObj,
      };
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year = parseInt(ddmmyyyy[3], 10);
    const dateObj = new Date(year, month - 1, day);
    if (!isNaN(dateObj.getTime())) {
      return { year, month, day, dateObj };
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const yyyymmdd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10);
    const day = parseInt(yyyymmdd[3], 10);
    const dateObj = new Date(year, month - 1, day);
    if (!isNaN(dateObj.getTime())) {
      return { year, month, day, dateObj };
    }
  }

  // Fallback Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      dateObj: parsed,
    };
  }

  return null;
}

function cleanPunch(val: any): string {
  if (val === null || val === undefined) return '-';
  const s = String(val).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return '-';
  }
  return s;
}

export function isInactiveEmployee(name: string): boolean {
  if (!name) return false;
  return /inactive/i.test(name);
}

export interface ParseAttendanceResult {
  success: boolean;
  sheets: MonthlyAttendanceSheet[];
  stats: AttendanceSummaryStats;
  errors: string[];
}

export interface ParseAttendanceOptions {
  selectedEmployeeIds?: string[];
}

export function parseAttendanceWorkbook(
  buffer: Buffer | ArrayBuffer,
  options?: ParseAttendanceOptions
): ParseAttendanceResult {
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: Buffer.isBuffer(buffer) ? 'buffer' : 'array', cellDates: true });
  } catch (err: any) {
    return {
      success: false,
      sheets: [],
      stats: { totalEmployees: 0, totalRecords: 0, totalMonths: 0, missingPunches: 0 },
      errors: [`Failed to read Excel workbook: ${err.message || 'Corrupted file'}`],
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      success: false,
      sheets: [],
      stats: { totalEmployees: 0, totalRecords: 0, totalMonths: 0, missingPunches: 0 },
      errors: ['The uploaded workbook does not contain any sheets.'],
    };
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<RawAttendanceRow>(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return {
      success: false,
      sheets: [],
      stats: { totalEmployees: 0, totalRecords: 0, totalMonths: 0, missingPunches: 0 },
      errors: [`The first sheet "${sheetName}" is empty. No attendance records found.`],
    };
  }

  // Check required columns
  const firstRow = rawRows[0];
  const keys = Object.keys(firstRow);
  const findKey = (candidates: string[]) => keys.find(k => candidates.some(c => c.toLowerCase() === k.trim().toLowerCase()));

  const empIdKey = findKey(['Employee ID', 'EmployeeID', 'Emp ID', 'EmpId', 'ID']);
  const empNameKey = findKey(['Employee Name', 'EmployeeName', 'Name', 'Emp Name']);
  const dateKey = findKey(['Date', 'Attendance Date', 'Punch Date']);
  const punchInKey = findKey(['Punch In', 'PunchIn', 'In Punch', 'In', 'In Time']);
  const punchOutKey = findKey(['Punch Out', 'PunchOut', 'Out Punch', 'Out', 'Out Time']);
  const hoursKey = findKey(['Total Working Hours', 'Working Hours', 'Hours', 'Duration']);
  const statusKey = findKey(['Status', 'Attendance Status']);
  const deptKey = findKey(['Department', 'Dept']);
  const desigKey = findKey(['Designation', 'Desig']);

  if (!dateKey) {
    errors.push('Missing required column: "Date"');
  }
  if (!empIdKey && !empNameKey) {
    errors.push('Missing employee identifier column (requires "Employee ID" or "Employee Name")');
  }

  if (errors.length > 0) {
    return {
      success: false,
      sheets: [],
      stats: { totalEmployees: 0, totalRecords: 0, totalMonths: 0, missingPunches: 0 },
      errors,
    };
  }

  // Employee ID -> { employeeId, employeeName, department, designation, months: Map<"YYYY-MM", Map<dayNumber, rowData>> }
  type EmployeeMonthData = {
    employeeId: string;
    employeeName: string;
    department?: string;
    designation?: string;
    months: Map<string, {
      year: number;
      month: number;
      dayMap: Map<number, {
        punchIn: string;
        punchOut: string;
        hours: string;
        rawStatus: string;
      }>;
    }>;
  };

  const employeeMap = new Map<string, EmployeeMonthData>();
  let totalMissingPunches = 0;
  let validRecordsCount = 0;
  let invalidDateRowsCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rawId = empIdKey ? String(row[empIdKey] || '').trim() : '';
    const rawName = empNameKey ? String(row[empNameKey] || '').trim() : '';

    // If both empty, skip row
    if (!rawId && !rawName) continue;

    // Strict requirement: Inactive employees must be completely ignored before any processing or counting
    if (isInactiveEmployee(rawName) || isInactiveEmployee(rawId)) {
      continue;
    }

    const empKey = rawId || rawName;
    const dateParsed = parseFlexibleDate(row[dateKey!]);
    if (!dateParsed) {
      invalidDateRowsCount++;
      continue;
    }

    validRecordsCount++;
    const { year, month, day, dateObj } = dateParsed;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    if (!employeeMap.has(empKey)) {
      employeeMap.set(empKey, {
        employeeId: rawId || rawName,
        employeeName: rawName || rawId,
        department: deptKey ? String(row[deptKey] || '').trim() : undefined,
        designation: desigKey ? String(row[desigKey] || '').trim() : undefined,
        months: new Map(),
      });
    }

    const empData = employeeMap.get(empKey)!;
    if (!empData.months.has(monthKey)) {
      empData.months.set(monthKey, {
        year,
        month,
        dayMap: new Map(),
      });
    }

    const mData = empData.months.get(monthKey)!;
    const punchIn = punchInKey ? cleanPunch(row[punchInKey]) : '-';
    const punchOut = punchOutKey ? cleanPunch(row[punchOutKey]) : '-';
    const hours = hoursKey ? cleanPunch(row[hoursKey]) : '-';
    const rawStatus = statusKey ? String(row[statusKey] || '').trim() : '';

    const hasIn = punchIn !== '-';
    const hasOut = punchOut !== '-';
    const isSunday = dateObj.getDay() === 0;

    if (!isSunday) {
      if ((hasIn && !hasOut) || (!hasIn && hasOut)) {
        totalMissingPunches++;
      }
    }

    mData.dayMap.set(day, {
      punchIn,
      punchOut,
      hours,
      rawStatus,
    });
  }

  if (invalidDateRowsCount > 0 && validRecordsCount === 0) {
    return {
      success: false,
      sheets: [],
      stats: { totalEmployees: 0, totalRecords: 0, totalMonths: 0, missingPunches: 0 },
      errors: [`Unable to parse dates: ${invalidDateRowsCount} rows contain invalid or unreadable dates.`],
    };
  }

  // Convert to MonthlyAttendanceSheet array
  const sheets: MonthlyAttendanceSheet[] = [];

  // Sort employees: alphabetically (A -> Z, case-insensitive) by employee display name, then fallback to ID
  const sortedEmployees = Array.from(employeeMap.values()).sort((a, b) => {
    const nameA = a.employeeName.trim();
    const nameB = b.employeeName.trim();
    const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (const emp of sortedEmployees) {
    // Sort months chronologically
    const sortedMonthKeys = Array.from(emp.months.keys()).sort();

    for (const mKey of sortedMonthKeys) {
      const mData = emp.months.get(mKey)!;
      const { year, month, dayMap } = mData;

      const totalDaysInMonth = new Date(year, month, 0).getDate();
      let totalSundaysInMonth = 0;
      const records: NormalizedAttendanceRecord[] = [];

      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dateObj = new Date(year, month - 1, d);
        const dayOfWeekIndex = dateObj.getDay();
        const dayOfWeek = DAY_NAMES[dayOfWeekIndex];
        const isSunday = dayOfWeekIndex === 0;
        if (isSunday) totalSundaysInMonth++;

        const dayRecord = dayMap.get(d);
        const dateStr = String(d).padStart(2, '0');
        const fullDateStr = `${dateStr}-${String(month).padStart(2, '0')}-${year}`;

        let punchIn = '-';
        let punchOut = '-';
        let hours = '-';
        let status: string = 'Absent';
        let isProblematic = false;

        if (dayRecord) {
          punchIn = dayRecord.punchIn;
          punchOut = dayRecord.punchOut;
          hours = dayRecord.hours;
          const hasIn = punchIn !== '-';
          const hasOut = punchOut !== '-';

          if (isSunday) {
            if (!hasIn && !hasOut) {
              status = 'Sunday';
              isProblematic = false;
            } else if (hasIn && hasOut) {
              status = dayRecord.rawStatus || 'Sunday';
              isProblematic = false;
            } else if (hasIn && !hasOut) {
              status = 'Missing Out';
              isProblematic = true;
            } else {
              status = 'Missing In';
              isProblematic = true;
            }
          } else {
            // Non-Sunday
            if (hasIn && hasOut) {
              status = dayRecord.rawStatus || 'FD';
              isProblematic = false;
            } else if (hasIn && !hasOut) {
              status = 'Missing Out';
              isProblematic = true;
            } else if (!hasIn && hasOut) {
              status = 'Missing In';
              isProblematic = true;
            } else {
              status = 'Absent';
              isProblematic = true;
            }
          }
        } else {
          // No record in source file for this day
          if (isSunday) {
            status = 'Sunday';
            isProblematic = false;
          } else {
            status = 'Absent';
            isProblematic = true;
          }
        }

        records.push({
          dateStr,
          fullDateStr,
          dayOfWeek,
          punchIn,
          punchOut,
          hours,
          status,
          isSunday,
          isProblematic,
        });
      }

      const monthName = MONTH_NAMES[month - 1] || 'UNKNOWN';
      const monthYearLabel = `${monthName} ${year}`;

      sheets.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        department: emp.department,
        designation: emp.designation,
        year,
        month,
        monthName,
        monthYearLabel,
        totalDays: totalDaysInMonth,
        totalSundays: totalSundaysInMonth,
        records,
      });
    }
  }

  let finalSheets = sheets;
  if (options?.selectedEmployeeIds && options.selectedEmployeeIds.length > 0) {
    const selectedSet = new Set(options.selectedEmployeeIds);
    finalSheets = sheets.filter(s => selectedSet.has(s.employeeId) || selectedSet.has(s.employeeName));
  }

  const uniqueEmpsInFinal = new Set(finalSheets.map(s => s.employeeId));
  let finalRecordsCount = 0;
  let finalMissingPunches = 0;
  for (const s of finalSheets) {
    for (const r of s.records) {
      if (r.punchIn !== '-' || r.punchOut !== '-') {
        finalRecordsCount++;
      }
      if (!r.isSunday && (r.status === 'Missing In' || r.status === 'Missing Out')) {
        finalMissingPunches++;
      }
    }
  }

  const stats: AttendanceSummaryStats = options?.selectedEmployeeIds && options.selectedEmployeeIds.length > 0
    ? {
        totalEmployees: uniqueEmpsInFinal.size,
        totalRecords: finalRecordsCount,
        totalMonths: finalSheets.length,
        missingPunches: finalMissingPunches,
      }
    : {
        totalEmployees: employeeMap.size,
        totalRecords: validRecordsCount,
        totalMonths: sheets.length,
        missingPunches: totalMissingPunches,
      };

  return {
    success: true,
    sheets: finalSheets,
    stats,
    errors,
  };
}

export function getEligibleEmployeesList(sheets: MonthlyAttendanceSheet[]): ParsedEmployeeItem[] {
  const map = new Map<string, ParsedEmployeeItem>();
  for (const sheet of sheets) {
    if (!map.has(sheet.employeeId)) {
      map.set(sheet.employeeId, {
        id: sheet.employeeId,
        name: sheet.employeeName,
        monthYear: sheet.monthYearLabel,
        recordCount: sheet.records.length,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const nameA = a.name.trim();
    const nameB = b.name.trim();
    const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
  });
}

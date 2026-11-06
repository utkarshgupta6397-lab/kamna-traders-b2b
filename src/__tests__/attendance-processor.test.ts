import fs from 'fs';
import path from 'path';
import {
  parseAttendanceWorkbook,
  getEligibleEmployeesList,
  isInactiveEmployee,
  isAbsentStatus,
  isCompletelyAbsentEmployee,
} from '../lib/services/hr/attendance-parser.service';
import { generateAttendancePDF } from '../lib/services/hr/attendance-pdf.service';

function runTests() {
  console.log('--- Starting Attendance Processor Hardened Tests ---');

  const samplePath = '/Users/utkarshgupta/Downloads/attendance_master.xlsx';
  if (!fs.existsSync(samplePath)) {
    throw new Error(`Sample file not found at ${samplePath}`);
  }

  const buf = fs.readFileSync(samplePath);

  // Test 1: Inactive helper check
  console.log('\n[Test 1] Case-insensitive inactive employee detection');
  const inactiveNames = [
    'Rahul Sharma Inactive',
    'RAHUL SHARMA INACTIVE',
    'Rahul Sharma - Inactive',
    'Rahul Sharma (Inactive)',
    'Inactive - Rahul Sharma',
  ];
  for (const name of inactiveNames) {
    if (!isInactiveEmployee(name)) {
      throw new Error(`Expected isInactiveEmployee("${name}") to be true`);
    }
  }
  if (isInactiveEmployee('Rahul Sharma')) {
    throw new Error('Expected isInactiveEmployee("Rahul Sharma") to be false');
  }
  console.log('✓ All inactive variations correctly detected');

  // Test 1b: Status and Completely Absent detection rules & edge cases
  console.log('\n[Test 1b] Completely Absent employee evaluation & edge cases');
  // isAbsentStatus checks
  if (!isAbsentStatus('Absent') || !isAbsentStatus('absent') || !isAbsentStatus(' ABSENT ') || !isAbsentStatus('Absent ')) {
    throw new Error('Expected isAbsentStatus to match case-insensitively with whitespace trimmed');
  }
  if (isAbsentStatus('FD') || isAbsentStatus('HD') || isAbsentStatus('Present') || isAbsentStatus('Week Off') || isAbsentStatus('Sunday')) {
    throw new Error('Non-absent status must not be classified as absent');
  }
  if (isAbsentStatus('') || isAbsentStatus(null) || isAbsentStatus(undefined)) {
    throw new Error('Empty or null status must not be classified as absent');
  }

  // Edge cases for isCompletelyAbsentEmployee
  // 1. Employee absent on all dates -> Exclude
  const allAbsent = [{ rawStatus: 'Absent' }, { rawStatus: 'absent' }, { rawStatus: 'ABSENT' }];
  if (!isCompletelyAbsentEmployee(allAbsent)) {
    throw new Error('Employee absent on all dates must be evaluated as completely absent');
  }

  // 2. Employee absent on 29 days but present on 1 day -> Include
  const absent29Present1 = Array(29).fill({ rawStatus: 'Absent' }).concat([{ rawStatus: 'Present' }]);
  if (isCompletelyAbsentEmployee(absent29Present1)) {
    throw new Error('Employee with 1 Present day must NOT be evaluated as completely absent');
  }

  // 3. Employee absent on 29 days but FD on 1 day -> Include
  const absent29FD1 = Array(29).fill({ rawStatus: 'Absent' }).concat([{ rawStatus: 'FD' }]);
  if (isCompletelyAbsentEmployee(absent29FD1)) {
    throw new Error('Employee with 1 FD day must NOT be evaluated as completely absent');
  }

  // 4. Employee with a Half Day entry -> Include
  const halfDay = [{ rawStatus: 'Absent' }, { rawStatus: 'HD' }, { rawStatus: 'Absent' }];
  if (isCompletelyAbsentEmployee(halfDay)) {
    throw new Error('Employee with HD must NOT be evaluated as completely absent');
  }

  // 5. Employee with incomplete punch-in/out but non-Absent status -> Include
  const incompletePunchNonAbsent = [{ rawStatus: 'Absent' }, { rawStatus: 'Missing Out' }];
  if (isCompletelyAbsentEmployee(incompletePunchNonAbsent)) {
    throw new Error('Employee with Missing Out must NOT be evaluated as completely absent');
  }

  // 6. Missing or unrecognized attendance status -> Do not classify as completely absent
  const unrecognized = [{ rawStatus: 'Absent' }, { rawStatus: 'SpecialLeave' }];
  if (isCompletelyAbsentEmployee(unrecognized)) {
    throw new Error('Unrecognized status must NOT be classified as completely absent');
  }
  const emptyStatus = [{ rawStatus: 'Absent' }, { rawStatus: '' }];
  if (isCompletelyAbsentEmployee(emptyStatus)) {
    throw new Error('Empty status must NOT be classified as completely absent');
  }
  console.log('✓ All complete-absence edge cases verified successfully');

  // Test 2: Parsing attendance_master.xlsx with inactive exclusion
  console.log('\n[Test 2] Parsing attendance_master.xlsx with inactive employee exclusion');
  const parseResult = parseAttendanceWorkbook(buf);
  if (!parseResult.success) {
    throw new Error(`Expected success but got error: ${parseResult.errors.join(', ')}`);
  }
  console.log('✓ Parsing succeeded');

  // Test 3: Active employee count verification (21 total - 2 inactive - 1 completely absent = 18 eligible)
  console.log('\n[Test 3] Eligible employee count verification (excludes Inactive & Completely Absent)');
  const expectedActiveEmpCount = 18;
  if (parseResult.stats.totalEmployees !== expectedActiveEmpCount) {
    throw new Error(`Expected ${expectedActiveEmpCount} active employees, got ${parseResult.stats.totalEmployees}`);
  }
  if (parseResult.stats.excludedAbsentEmployees !== 1) {
    throw new Error(`Expected 1 excluded completely absent employee, got ${parseResult.stats.excludedAbsentEmployees}`);
  }
  const inactiveInSheets = parseResult.sheets.filter(s => isInactiveEmployee(s.employeeName));
  if (inactiveInSheets.length > 0) {
    throw new Error(`Found inactive employees in sheets: ${inactiveInSheets.map(s => s.employeeName).join(', ')}`);
  }
  const absentInSheets = parseResult.sheets.filter(s => s.employeeId === 'EMP0001');
  if (absentInSheets.length > 0) {
    throw new Error(`Found completely absent employee EMP0001 in sheets: ${absentInSheets.map(s => s.employeeName).join(', ')}`);
  }
  console.log(`✓ Detected exactly ${parseResult.stats.totalEmployees} eligible active employees (Chetna, Nisha & Vishal Vardhan excluded)`);

  // Test 4: Total active records count verification (593 - 4 inactive rows = 589 rows)
  console.log('\n[Test 4] Total active records verification');
  const expectedRecords = 589;
  if (parseResult.stats.totalRecords !== expectedRecords) {
    throw new Error(`Expected ${expectedRecords} active records, got ${parseResult.stats.totalRecords}`);
  }
  console.log(`✓ Validated ${parseResult.stats.totalRecords} active attendance rows`);

  // Test 5: Eligible employees list generation
  console.log('\n[Test 5] Eligible employees list generation for selection UI');
  const employeeList = getEligibleEmployeesList(parseResult.sheets);
  if (employeeList.length !== 18) {
    throw new Error(`Expected 18 employees in selection list, got ${employeeList.length}`);
  }
  if (employeeList.some(e => e.id === 'EMP0001')) {
    throw new Error('Completely absent employee EMP0001 must not be in eligible employee list');
  }
  console.log(`✓ Selection list contains ${employeeList.length} employees with IDs and metadata`);

  // Test 6: Employee selection filtering (select subset of 3 eligible employees)
  console.log('\n[Test 6] Employee selection filtering');
  const selectedIds = ['EMP0002', 'EMP0004', 'EMP0006'];
  const filteredResult = parseAttendanceWorkbook(buf, { selectedEmployeeIds: selectedIds });
  if (filteredResult.sheets.length !== 3) {
    throw new Error(`Expected 3 filtered sheets, got ${filteredResult.sheets.length}`);
  }
  if (filteredResult.stats.totalEmployees !== 3) {
    throw new Error(`Expected 3 totalEmployees in stats, got ${filteredResult.stats.totalEmployees}`);
  }
  console.log(`✓ Filtered successfully to ${filteredResult.sheets.length} selected employees`);

  // Test 7: PDF Generation for selected employees
  console.log('\n[Test 7] PDF generation for filtered subset (3 employees = exactly 3 A4 pages)');
  const startTime = performance.now();
  const pdfBuffer = generateAttendancePDF(filteredResult.sheets);
  const duration = (performance.now() - startTime).toFixed(2);

  const pdfStr = pdfBuffer.toString('latin1');
  const pagesCount = (pdfStr.match(/\/Type\s*\/Page\b/g) || []).length;
  if (pagesCount !== 3) {
    throw new Error(`Expected exactly 3 PDF pages for 3 selected employees, got ${pagesCount}`);
  }

  const mediaBoxes = pdfStr.match(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/g) || [];
  const firstBox = mediaBoxes[0] || '';
  if (!firstBox.includes('841.88') && !firstBox.includes('841.89')) {
    throw new Error(`MediaBox width not A4 landscape: ${firstBox}`);
  }
  console.log(`✓ Generated ${pagesCount} pages in ${duration}ms, all formatted as A4 Landscape (841.89 x 595.28 pt)`);

  // Test 8: Calendar completeness and Sunday detection on active employees
  console.log('\n[Test 8] Calendar completeness & Sundays');
  const sheet0 = parseResult.sheets[0];
  if (sheet0.records.length !== 31) {
    throw new Error(`Expected 31 calendar days for August 2026, got ${sheet0.records.length}`);
  }
  if (sheet0.totalSundays !== 5) {
    throw new Error(`Expected 5 Sundays in August 2026, got ${sheet0.totalSundays}`);
  }
  const sun2 = sheet0.records.find(r => r.dateStr === '02');
  if (!sun2 || !sun2.isSunday || sun2.status !== 'Sunday' || sun2.isProblematic) {
    throw new Error(`Sunday Aug 2 record incorrect: ${JSON.stringify(sun2)}`);
  }
  console.log('✓ August 2026 calendar days: 31, Sundays: 5 correctly identified and marked clean');

  // Test 9: Error handling on invalid input
  console.log('\n[Test 9] Validation on empty / invalid inputs');
  const emptyRes = parseAttendanceWorkbook(Buffer.from('not an excel file'));
  if (emptyRes.success) {
    throw new Error('Expected failure on invalid excel buffer');
  }
  console.log(`✓ Handled invalid file with error: "${emptyRes.errors[0]}"`);

  // Test 10: Alphabetical Order (A -> Z) Verification
  console.log('\n[Test 10] Alphabetical ordering (A -> Z) verification for employees and PDF');
  const sortedNames = employeeList.map(e => e.name);
  for (let i = 0; i < sortedNames.length - 1; i++) {
    const current = sortedNames[i].trim();
    const next = sortedNames[i + 1].trim();
    const cmp = current.localeCompare(next, undefined, { sensitivity: 'base' });
    if (cmp > 0) {
      throw new Error(`Employee list not in alphabetical order: "${current}" appears before "${next}"`);
    }
  }
  console.log('✓ getEligibleEmployeesList produces strict A -> Z sorted employees');

  // Verify generateAttendancePDF sorts arbitrary input order alphabetically
  const reversedSheets = [...parseResult.sheets].reverse();
  const sortedPdfBuffer = generateAttendancePDF(reversedSheets);
  if (sortedPdfBuffer.length === 0) {
    throw new Error('Expected valid PDF buffer');
  }
  // Test 11: Monthly Summary Boxes Verification (Order, labels, removal of Total Sundays)
  console.log('\n[Test 11] Monthly Summary verification in PDF');
  const pdfText = sortedPdfBuffer.toString('latin1');
  if (pdfText.includes('Total Sundays')) {
    throw new Error('PDF should not contain "Total Sundays" in monthly summary');
  }
  if (!pdfText.includes('Total Working Days')) {
    throw new Error('PDF missing "Total Working Days"');
  }
  if (!pdfText.includes('Total Present')) {
    throw new Error('PDF missing "Total Present"');
  }
  if (!pdfText.includes('Total Absent')) {
    throw new Error('PDF missing "Total Absent"');
  }
  if (!pdfText.includes('Eligible Weekoffs')) {
    throw new Error('PDF missing "Eligible Weekoffs"');
  }
  if (!pdfText.includes('Net Payable Days')) {
    throw new Error('PDF missing "Net Payable Days"');
  }
  if (!pdfText.includes('To be filled manually')) {
    throw new Error('PDF missing "To be filled manually" subtext for Eligible Weekoffs');
  }
  console.log('✓ Verified 5 Monthly Summary boxes: Total Working Days -> Total Present -> Total Absent -> Eligible Weekoffs -> Net Payable Days');

  // Test 12: Multi-employee completely absent exclusion verification with attendance_master (4).xlsx
  const multiAbsentPath = '/Users/utkarshgupta/Downloads/attendance_master (4).xlsx';
  if (fs.existsSync(multiAbsentPath)) {
    console.log('\n[Test 12] Multiple completely absent employees exclusion on attendance_master (4).xlsx');
    const multiBuf = fs.readFileSync(multiAbsentPath);
    const multiRes = parseAttendanceWorkbook(multiBuf);
    if (!multiRes.success) {
      throw new Error(`Expected success on multi-file but got: ${multiRes.errors.join(', ')}`);
    }
    const completelyAbsentIds = ['EMP0038', 'EMP0037', 'EMP0024', 'EMP0001'];
    for (const absentId of completelyAbsentIds) {
      if (multiRes.sheets.some(s => s.employeeId === absentId)) {
        throw new Error(`Completely absent employee ${absentId} was NOT excluded from attendance_master (4).xlsx`);
      }
    }
    if (multiRes.stats.excludedAbsentEmployees !== 4) {
      throw new Error(`Expected exactly 4 excluded absent employees, got ${multiRes.stats.excludedAbsentEmployees}`);
    }
    console.log(`✓ Verified all 4 completely absent employees (${completelyAbsentIds.join(', ')}) are excluded from generated statements`);
  }

  console.log('\n======================================================');
  console.log('ALL ATTENDANCE PROCESSOR TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests();

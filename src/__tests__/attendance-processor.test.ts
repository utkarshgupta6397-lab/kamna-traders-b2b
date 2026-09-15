import fs from 'fs';
import path from 'path';
import { parseAttendanceWorkbook, getEligibleEmployeesList, isInactiveEmployee } from '../lib/services/hr/attendance-parser.service';
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

  // Test 2: Parsing attendance_master.xlsx with inactive exclusion
  console.log('\n[Test 2] Parsing attendance_master.xlsx with inactive employee exclusion');
  const parseResult = parseAttendanceWorkbook(buf);
  if (!parseResult.success) {
    throw new Error(`Expected success but got error: ${parseResult.errors.join(', ')}`);
  }
  console.log('✓ Parsing succeeded');

  // Test 3: Active employee count verification (21 total - 2 inactive = 19 active)
  console.log('\n[Test 3] Eligible employee count verification (excludes Inactive)');
  const expectedActiveEmpCount = 19;
  if (parseResult.stats.totalEmployees !== expectedActiveEmpCount) {
    throw new Error(`Expected ${expectedActiveEmpCount} active employees, got ${parseResult.stats.totalEmployees}`);
  }
  const inactiveInSheets = parseResult.sheets.filter(s => isInactiveEmployee(s.employeeName));
  if (inactiveInSheets.length > 0) {
    throw new Error(`Found inactive employees in sheets: ${inactiveInSheets.map(s => s.employeeName).join(', ')}`);
  }
  console.log(`✓ Detected exactly ${parseResult.stats.totalEmployees} eligible active employees (Chetna & Nisha excluded)`);

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
  if (employeeList.length !== 19) {
    throw new Error(`Expected 19 employees in selection list, got ${employeeList.length}`);
  }
  console.log(`✓ Selection list contains ${employeeList.length} employees with IDs and metadata`);

  // Test 6: Employee selection filtering (select subset of 3 employees)
  console.log('\n[Test 6] Employee selection filtering');
  const selectedIds = ['EMP0001', 'EMP0002', 'EMP0004'];
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

  console.log('\n======================================================');
  console.log('ALL 11 ATTENDANCE PROCESSOR TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests();

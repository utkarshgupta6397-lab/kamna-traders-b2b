import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyAttendanceSheet } from './attendance-types';

export function generateAttendancePDF(sheets: MonthlyAttendanceSheet[]): Buffer {
  // A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Guarantee alphabetical order (A -> Z, case-insensitive) by employee display name,
  // then chronologically by year and month
  const sortedSheets = [...sheets].sort((a, b) => {
    const nameA = (a.employeeName || '').trim();
    const nameB = (b.employeeName || '').trim();
    const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  sortedSheets.forEach((sheet, sheetIndex) => {
    if (sheetIndex > 0) {
      doc.addPage('a4', 'landscape');
    }

    renderEmployeeSheet(doc, sheet);
  });

  return Buffer.from(doc.output('arraybuffer'));
}

function renderEmployeeSheet(doc: jsPDF, sheet: MonthlyAttendanceSheet) {
  const pageWidth = 297;
  const pageHeight = 210;

  // 1. Header (Y: 10mm to 24mm)
  // Left: Employee Name (Large, bold)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 39, 102); // Primary Brand Navy #1A2766
  const empName = (sheet.employeeName || 'UNKNOWN EMPLOYEE').trim().toUpperCase();
  doc.text(empName, 10, 16);

  // Label: ATTENDANCE STATEMENT
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('ATTENDANCE STATEMENT', 10, 21);

  // Right: Month Year
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39); // Gray-900
  const monthYear = (sheet.monthYearLabel || '').toUpperCase();
  doc.text(monthYear, pageWidth - 10, 17, { align: 'right' });

  // Divider line below header
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.35);
  doc.line(10, 24, pageWidth - 10, 24);

  // 2. Attendance Tables (Side-by-Side)
  // Split month days into two equal halves (e.g. 1-16 and 17-31 for a 31-day month)
  const splitIndex = Math.ceil(sheet.records.length / 2);
  const leftRecords = sheet.records.slice(0, splitIndex);
  const rightRecords = sheet.records.slice(splitIndex);

  const tableWidth = 135;
  const tableGap = 7;
  const leftX = 10;
  const rightX = leftX + tableWidth + tableGap; // 152mm
  const startY = 27;

  // Render left table
  renderAttendanceTable(doc, leftRecords, leftX, startY, tableWidth);

  // Render right table
  renderAttendanceTable(doc, rightRecords, rightX, startY, tableWidth);

  // 3. Manual Summary Section & Employee Signature at bottom
  const bottomY = 132;
  const bottomHeight = 68;

  // Monthly Summary Box (Left)
  const summaryWidth = 190;
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(leftX, bottomY, summaryWidth, bottomHeight, 2, 2, 'FD');

  // Title: MONTHLY SUMMARY
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text('MONTHLY SUMMARY', leftX + 5, bottomY + 7);

  // Supporting text: (To be filled manually)
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('(To be filled manually)', leftX + 43, bottomY + 7);

  // 5 manual summary fields
  const fields = [
    { label: 'Total Working Days', sub: 'Excluding Sundays' },
    { label: 'Total Present', sub: 'Physical / On-Duty' },
    { label: 'Total Sundays', sub: `Calendar (${sheet.totalSundays})` },
    { label: 'Total Absent', sub: 'Approved / Unapproved' },
    { label: 'Net Payable Days', sub: 'Final Count' },
  ];

  const fieldInnerY = bottomY + 11;
  const fieldHeight = 52;
  const fieldMargin = 4;
  const availableFieldWidth = summaryWidth - (fieldMargin * 2);
  const fieldBoxWidth = (availableFieldWidth - (fields.length - 1) * 3) / fields.length; // ~34.8mm

  fields.forEach((f, idx) => {
    const boxX = leftX + fieldMargin + idx * (fieldBoxWidth + 3);

    // Outer card for each field
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(boxX, fieldInnerY, fieldBoxWidth, fieldHeight, 1.5, 1.5, 'FD');

    // Field Label Header
    doc.setFillColor(241, 245, 249);
    doc.rect(boxX, fieldInnerY, fieldBoxWidth, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(boxX, fieldInnerY + 12, boxX + fieldBoxWidth, fieldInnerY + 12);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text(f.label, boxX + fieldBoxWidth / 2, fieldInnerY + 5.5, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text(f.sub, boxX + fieldBoxWidth / 2, fieldInnerY + 9.5, { align: 'center' });

    // Writing area with handwriting helper line
    const lineY = fieldInnerY + fieldHeight - 10;
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(boxX + 4, lineY, boxX + fieldBoxWidth - 4, lineY);
    doc.setLineDashPattern([], 0); // reset dash
  });

  // Employee Signature Box (Right)
  const sigX = leftX + summaryWidth + 7; // 207mm
  const sigWidth = pageWidth - 10 - sigX; // 80mm
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(sigX, bottomY, sigWidth, bottomHeight, 2, 2, 'FD');

  // Title: EMPLOYEE SIGNATURE
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('EMPLOYEE SIGNATURE', sigX + 5, bottomY + 7);

  // Inner blank canvas for physical pen signature
  const sigCanvasY = bottomY + 11;
  const sigCanvasHeight = 52;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(sigX + 4, sigCanvasY, sigWidth - 8, sigCanvasHeight, 1.5, 1.5, 'FD');

  // Signature line
  const sigLineY = sigCanvasY + sigCanvasHeight - 12;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(sigX + 10, sigLineY, sigX + sigWidth - 10, sigLineY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Signature & Date', sigX + sigWidth / 2, sigLineY + 6, { align: 'center' });
}

function renderAttendanceTable(
  doc: jsPDF,
  records: MonthlyAttendanceSheet['records'],
  startX: number,
  startY: number,
  tableWidth: number
) {
  const head = [['Date', 'Day', 'In', 'Out', 'Hours', 'Status', 'Final']];
  const body = records.map(r => [
    r.dateStr,
    r.dayOfWeek,
    r.punchIn,
    r.punchOut,
    r.hours,
    r.status,
    '', // Final column will be drawn custom in didDrawCell
  ]);

  autoTable(doc, {
    startY,
    margin: { left: startX, right: 297 - startX - tableWidth },
    tableWidth,
    head,
    body,
    theme: 'plain',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800 (#1E293B)
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 1.5, bottom: 1.5, left: 0.5, right: 0.5 },
      lineColor: [51, 65, 85],
      lineWidth: 0.15,
    },
    bodyStyles: {
      fontSize: 6.5,
      valign: 'middle',
      halign: 'center',
      cellPadding: { top: 1.3, bottom: 1.3, left: 0.5, right: 0.5 },
      lineColor: [226, 232, 240], // Slate-200
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 17, halign: 'center' },
      3: { cellWidth: 17, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 19, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 49, halign: 'left' },
    },
    didParseCell: function(data) {
      if (data.section === 'body') {
        const rowRecord = records[data.row.index];
        if (!rowRecord) return;

        if (rowRecord.isProblematic) {
          // Dark background, white text for Missing In, Missing Out, Absent
          data.cell.styles.fillColor = [38, 38, 38]; // Deep dark charcoal #262626
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.lineColor = [64, 64, 64];
        } else if (rowRecord.isSunday) {
          // Clean, neutral distinct light background for Sunday
          data.cell.styles.fillColor = [241, 245, 249]; // Slate-100
          data.cell.styles.textColor = [71, 85, 105]; // Slate-600
          data.cell.styles.lineColor = [226, 232, 240];
        } else {
          // Regular day
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.textColor = [15, 23, 42]; // Slate-900
          data.cell.styles.lineColor = [226, 232, 240];
        }
      }
    },
    didDrawCell: function(data) {
      // Draw 4 checkboxes horizontally in 'Final' column
      if (data.section === 'body' && data.column.index === 6) {
        const rowRecord = records[data.row.index];
        const isDark = rowRecord?.isProblematic;

        const cell = data.cell;
        const x = cell.x;
        const y = cell.y;
        const h = cell.height;

        const boxSize = 2.1;
        const centerY = y + (h - boxSize) / 2;

        const labels = ['Full Day', 'Half Day', 'Absent', 'Week Off'];

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(5.2);

        if (isDark) {
          doc.setDrawColor(255, 255, 255);
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setDrawColor(100, 116, 139); // Slate-500
          doc.setTextColor(51, 65, 85);    // Slate-700
        }

        let curX = x + 1.2;
        labels.forEach(label => {
          // Draw checkbox square
          doc.setLineWidth(0.2);
          doc.rect(curX, centerY, boxSize, boxSize);

          // Draw label text
          doc.text(label, curX + boxSize + 0.8, centerY + boxSize - 0.4);

          const textWidth = doc.getTextWidth(label);
          curX += boxSize + 0.8 + textWidth + 1.5;
        });
      }
    },
  });
}

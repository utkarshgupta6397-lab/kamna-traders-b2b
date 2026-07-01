const fs = require('fs');

const file = 'src/lib/zoho/pdf-statement-renderer.ts';
let code = fs.readFileSync(file, 'utf8');

// Update margins to 18
code = code.replace(/const margin = 20;/, 'const margin = 14;'); // Use 14mm/px for 95% width

// We need to rewrite the Single Statement Header block to make it 40% smaller
const headerStart = code.indexOf("  if (!isGroup) {");
const headerEnd = code.indexOf("    currentY = kpiY + 14 + 20;");
if (headerStart !== -1 && headerEnd !== -1) {
  const newHeader = `  if (!isGroup) {
    const logoH = 10;
    const logoW = logoH * (599 / 579);
    const logoY = 12; // Reduced top margin
    const dividerY = logoY + logoH + 6; // Tighter spacer
    
    if (theme === 'color') {
      doc.setFillColor(...cNavy);
      doc.rect(0, 0, pageW, dividerY, 'F');
    }

    if (logo) {
      doc.addImage(logo, 'PNG', margin, logoY, logoW, logoH);
    }
    
    const titleX = margin + logoW + 6;
    doc.setFontSize(16);
    doc.setFont(pdfFont, 'bold');
    doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
    doc.text('Customer Statement', titleX, logoY + 6);
    
    doc.setFontSize(9);
    doc.setFont(pdfFont, 'normal');
    doc.setTextColor(...(theme === 'economy' ? [100, 116, 139] : [190, 205, 225] as [number, number, number]));
    doc.text('Kamna Traders B2B · Receivables Ledger', titleX, logoY + 10);

    const rightX = pageW - margin;
    doc.setFontSize(14);
    doc.setFont(pdfFont, 'bold');
    doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
    let cName = s.customer.contactName || 'Customer';
    const maxRightWidth = (pageW - margin * 2) * 0.40;
    if (doc.getStringUnitWidth(cName) * doc.internal.getFontSize() / doc.internal.scaleFactor > maxRightWidth) {
      while (cName.length > 0 && doc.getStringUnitWidth(cName + '...') * doc.internal.getFontSize() / doc.internal.scaleFactor > maxRightWidth) {
        cName = cName.slice(0, -1);
      }
      cName += '...';
    }
    doc.text(cName, rightX, logoY + 4, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont(pdfFont, 'normal');
    doc.setTextColor(...(theme === 'economy' ? [100, 116, 139] : [226, 232, 240] as [number, number, number]));
    let curRightY = logoY + 8;
    if (s.customer.gstNo) {
      doc.text(\`GST: \${s.customer.gstNo}\`, rightX, curRightY, { align: 'right' });
      curRightY += 4;
    }
    if (s.customer.mobile) {
      doc.text(\`Phone: \${s.customer.mobile}\`, rightX, curRightY, { align: 'right' });
      curRightY += 4;
    }
    const rawAddr = (s.customer as any).rawAddress;
    if (rawAddr && rawAddr.city) {
      doc.text(\`\${rawAddr.city}, \${rawAddr.state || ''}\`.trim().replace(/,$/, ''), rightX, curRightY, { align: 'right' });
    }

    if (theme === 'economy') {
      doc.setDrawColor(...cNavy);
      doc.setLineWidth(0.3);
      doc.line(margin, dividerY, pageW - margin, dividerY);
    }

    const kpis = [
      { label: openingPres.isCredit ? 'Advance / Credit' : 'Opening Balance', val: pdfOpeningAmt, color: cDark, bg: [248, 250, 252] as [number, number, number] },
      { label: 'Total Debit',  val: pdfFmt(totalDebit), color: cNavy, bg: [254, 242, 242] as [number, number, number]  },
      { label: 'Total Credit', val: pdfFmt(totalCredit), color: cGreen, bg: [236, 253, 245] as [number, number, number] },
      { label: 'Closing Balance', val: pdfFmtBalance(s.closingBalance), color: s.closingBalance > 0 ? cRed : s.closingBalance < 0 ? cGreen : cDark, bg: s.closingBalance > 0 ? [254, 242, 242] as [number, number, number] : s.closingBalance < 0 ? [236, 253, 245] as [number, number, number] : [248, 250, 252] as [number, number, number] },
    ];
    
    const boxW = (colW - 8 * 3) / 4;
    const kpiY = dividerY + 6; // Tighter spacing
    kpis.forEach((box, i) => {
      const bx = margin + i * (boxW + 8);
      const bh = 14; 
      
      if (theme === 'economy') {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(bx, kpiY, boxW, bh, 2, 2, 'FD');
      } else {
        doc.setFillColor(box.bg[0], box.bg[1], box.bg[2]);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.roundedRect(bx, kpiY, boxW, bh, 2, 2, 'FD');
      }

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...cSlate);
      doc.text(box.label.toUpperCase(), bx + 4, kpiY + 5);

      doc.setFontSize(10);
      doc.setTextColor(...box.color);
      doc.text(box.val, bx + 4, kpiY + 11);
    });

    currentY = kpiY + 14 + 10;`;
  code = code.substring(0, headerStart) + newHeader + code.substring(headerEnd + "    currentY = kpiY + 14 + 20;".length);
}

// Update the autoTable configuration
const tableStart = code.indexOf("  autoTable(doc, {");
const tableEnd = code.indexOf("  const closingBal = s.closingBalance;");
if (tableStart !== -1 && tableEnd !== -1) {
  const newTable = `  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: [openRow, ...txRows, totalsRow],
    theme: 'plain',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: cNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }
    },
    bodyStyles: { fontSize: 9.5, textColor: [15, 23, 42], font: pdfFont },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: isGroup ? {
      0: { cellWidth: '11%', overflow: 'visible' },
      1: { cellWidth: '15%', overflow: 'linebreak' },
      2: { cellWidth: '10%', overflow: 'visible', halign: 'center' },
      3: { cellWidth: '22%', overflow: 'ellipsize' },
      4: { halign: 'right', cellWidth: '14%', fontStyle: 'bold', textColor: [30, 58, 138] },
      5: { halign: 'right', cellWidth: '14%', fontStyle: 'bold', textColor: [6, 95, 70] },
      6: { halign: 'right', cellWidth: '14%', fontStyle: 'bold' },
    } : {
      0: { cellWidth: '11%', overflow: 'visible' },
      1: { cellWidth: '13%', overflow: 'visible', halign: 'center' },
      2: { cellWidth: '34%', overflow: 'ellipsize' },
      3: { halign: 'right', cellWidth: '14%', fontStyle: 'bold', textColor: [30, 58, 138] },
      4: { halign: 'right', cellWidth: '14%', fontStyle: 'bold', textColor: [6, 95, 70] },
      5: { halign: 'right', cellWidth: '14%', fontStyle: 'bold' },
    },
    styles: { 
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 }, 
      font: pdfFont,
      lineWidth: 0.1, 
      lineColor: [229, 231, 235]
    },
    margin: { top: 14, left: 14, right: 14, bottom: 20 },
    willDrawCell: (data: any) => {
      const isLast = data.row.index === txRows.length + 1;
      const isOpening = data.row.index === 0;

      if (data.section === 'body') {
        if (isOpening) {
          data.cell.styles.fillColor = [243, 244, 246];
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index !== (isGroup ? 6 : 5)) {
            data.cell.styles.textColor = [15, 23, 42];
          }
        } else if (isLast) {
          data.cell.styles.fillColor = [248, 250, 252];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.lineWidth = { top: 0.5, bottom: 0.1, left: 0.1, right: 0.1 };
          data.cell.styles.lineColor = [203, 213, 225];
          data.cell.styles.textColor = [15, 23, 42];
          if (data.column.index === (isGroup ? 6 : 5)) {
             data.cell.styles.fontSize = 11;
          }
        } else {
          // Dynamic colors for running balance
          const balColIdx = isGroup ? 6 : 5;
          if (data.column.index === balColIdx) {
            const b = visibleTxs[data.row.index - 1]?.balanceAfter || 0;
            data.cell.styles.textColor = b > 0 ? [220, 38, 38] : b < 0 ? [5, 150, 105] : [107, 114, 128];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 10;
          }
        }
      }
    },
    didDrawPage: (data: any) => {
      // ONLY print footer on last page
      // In jspdf-autotable, determining the last page dynamically before it finishes is tricky.
      // But we can just draw it if this is the final row, or hook into the final document rendering later.
      // Actually, didDrawPage runs for every page. The user requested: "Footer only on final page".
      // Let's defer footer drawing to AFTER autoTable completes.
    },
    didDrawCell: (data: any) => {
      const typeColIdx = isGroup ? 2 : 1;
      const isLast = data.row.index === txRows.length + 1;
      const isOpening = data.row.index === 0;

      // Text colors for type column (no pills)
      if (data.section === 'body' && data.column.index === typeColIdx && !isLast && !isOpening) {
        const txType = txRows[data.row.index - 1][typeColIdx];
        let fg = [15, 23, 42];
        if (txType === 'Sales Invoice') fg = [37, 99, 235];
        else if (txType === 'Customer Payment') fg = [22, 163, 74];
        else if (txType === 'Purchase Bill') fg = [234, 88, 12];
        else if (txType === 'Vendor Payment') fg = [147, 51, 234];
        
        doc.setFillColor(data.row.index % 2 === 0 ? 250 : 255, data.row.index % 2 === 0 ? 250 : 255, data.row.index % 2 === 0 ? 250 : 255);
        doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
        doc.setTextColor(fg[0], fg[1], fg[2]);
        doc.setFont(pdfFont, 'bold');
        
        // uppercase
        const textToDraw = txType.toUpperCase();
        const textWidth = doc.getStringUnitWidth(textToDraw) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        const startX = data.cell.x + (data.cell.width - textWidth) / 2;
        doc.text(textToDraw, startX, data.cell.y + data.cell.height / 2 + doc.internal.getFontSize() * 0.3527 / 3);
      }
    }
  });
`;
  code = code.substring(0, tableStart) + newTable + code.substring(tableEnd);
}

// Add footer manually on the last page only
const finalTableYStart = code.indexOf("  const finalTableY = doc.lastAutoTable?.finalY ?? 96;");
if (finalTableYStart !== -1) {
  const footerCode = `  const finalTableY = doc.lastAutoTable?.finalY ?? 96;

  const footerHeight = theme === 'economy' ? 42 : 56;
  const spaceRequired = footerHeight + 10;
  
  if (finalTableY + spaceRequired > pageH && !options.isBatchRecovery) {
    doc.addPage();
  }

  // Draw final page footer
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(8);
  doc.setFont(pdfFont, 'normal');
  doc.setTextColor(107, 114, 128); // #6B7280
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(\`Generated By: Kamna ERP System  |  Generated At: \${today}\`, 14, footerY);
  doc.text('Kamna Traders B2B · Confidential', doc.internal.pageSize.getWidth() - 14, footerY, { align: 'right' });
`;
  // We need to replace up to the original addPage block
  const oldAddPageEnd = code.indexOf("  }", finalTableYStart + 20) + 3;
  code = code.substring(0, finalTableYStart) + footerCode + code.substring(oldAddPageEnd);
}

fs.writeFileSync(file, code);

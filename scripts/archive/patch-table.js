const fs = require('fs');

const file = 'src/lib/zoho/pdf-statement-renderer.ts';
let code = fs.readFileSync(file, 'utf8');

// The block we want to replace starts roughly at "const tableHead = ["
// and ends after "didDrawCell: (data: any) => {"

const startTag = '  const tableHead = [';
const endTag = '  const closingBal = s.closingBalance;';

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries.");
  process.exit(1);
}

const replacement = `  const tableHead = [
    isGroup
      ? ['Date', 'Firm', 'Type', 'Document & Details', 'Debit', 'Credit', 'Balance']
      : ['Date', 'Type', 'Details', 'Debit', 'Credit', 'Balance']
  ];

  const openRow = isGroup ? [
    '—', '—', '—',
    \`Opening Balance\${openingPres.isCredit ? ' (Advance/Credit)' : ''}\`,
    '—', '—', pdfOpeningAmt
  ] : [
    '—', '—',
    \`Opening Balance\${openingPres.isCredit ? ' (Advance/Credit)' : ''}\`,
    '—', '—', pdfOpeningAmt
  ];

  const txRows = visibleTxs.map((tx: any) => {
    const typeLabel = tx.type === 'invoice' ? 'Sales Invoice' : tx.type === 'payment' ? 'Customer Payment' : tx.type === 'vendor_payment' ? 'Vendor Payment' : 'Purchase Bill';
    const displayDesc = cleanDescription(tx.description, tx.type);
    const combinedDesc = tx.referenceNumber ? (tx.referenceNumber !== displayDesc ? \`\${tx.referenceNumber}\\n\${displayDesc}\` : tx.referenceNumber) : displayDesc;
    
    if (isGroup) {
      return [
        fmtDate(tx.date),
        tx.firmName || '—',
        typeLabel,
        combinedDesc,
        tx.netEffect > 0  ? pdfFmt(tx.amount) : '—',
        tx.netEffect <= 0 ? pdfFmt(tx.amount) : '—',
        pdfFmtBalance(tx.balanceAfter),
      ];
    }

    return [
      fmtDate(tx.date),
      typeLabel,
      combinedDesc,
      tx.netEffect > 0  ? pdfFmt(tx.amount) : '—',
      tx.netEffect <= 0 ? pdfFmt(tx.amount) : '—',
      pdfFmtBalance(tx.balanceAfter),
    ];
  });

  const totalsRow = isGroup ? [
    '', '', '', 'TOTALS',
    pdfFmt(totalDebit),
    pdfFmt(totalCredit),
    pdfFmtBalance(s.closingBalance),
  ] : [
    '', '', 'TOTALS',
    pdfFmt(totalDebit),
    pdfFmt(totalCredit),
    pdfFmtBalance(s.closingBalance),
  ];

  autoTable(doc, {
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
      fontSize: 10,
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 }
    },
    bodyStyles: { fontSize: 10.5, textColor: [15, 23, 42], font: pdfFont },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: isGroup ? {
      0: { cellWidth: 22, overflow: 'visible' },
      1: { cellWidth: 26, overflow: 'linebreak' },
      2: { cellWidth: 32, overflow: 'visible', halign: 'center' },
      3: { cellWidth: 46, overflow: 'ellipsize' },
      4: { halign: 'right', cellWidth: 26, fontStyle: 'normal', textColor: [30, 58, 138] },
      5: { halign: 'right', cellWidth: 26, fontStyle: 'normal', textColor: [6, 95, 70] },
      6: { halign: 'right', cellWidth: 26, fontStyle: 'normal' },
    } : {
      0: { cellWidth: 24, overflow: 'visible' },
      1: { cellWidth: 36, overflow: 'visible', halign: 'center' },
      2: { cellWidth: 60, overflow: 'ellipsize' },
      3: { halign: 'right', cellWidth: 28, fontStyle: 'normal', textColor: [30, 58, 138] },
      4: { halign: 'right', cellWidth: 28, fontStyle: 'normal', textColor: [6, 95, 70] },
      5: { halign: 'right', cellWidth: 30, fontStyle: 'normal' },
    },
    styles: { 
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, 
      font: pdfFont,
      lineWidth: 0.1, 
      lineColor: [229, 231, 235]
    },
    margin: { top: 24, left: margin, right: margin, bottom: 24 },
    willDrawCell: (data: any) => {
      const isLast = data.row.index === txRows.length + 1;
      const isOpening = data.row.index === 0;

      if (data.section === 'body') {
        if (isOpening) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index !== (isGroup ? 6 : 5)) {
            data.cell.styles.textColor = [15, 23, 42];
          }
        } else if (isLast) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.lineWidth = { top: 0.5, bottom: 0.1, left: 0.1, right: 0.1 };
          data.cell.styles.lineColor = [203, 213, 225];
          data.cell.styles.textColor = [15, 23, 42];
        } else {
          // Dynamic colors for running balance
          const balColIdx = isGroup ? 6 : 5;
          if (data.column.index === balColIdx) {
            const b = visibleTxs[data.row.index - 1]?.balanceAfter || 0;
            data.cell.styles.textColor = b > 0 ? [220, 38, 38] : b < 0 ? [5, 150, 105] : [100, 116, 139];
          }
        }
      }
    },
    didDrawPage: (data: any) => {
      // Footer rendering logic
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(9);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(100, 116, 139);
      
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const footerLeft = \`Generated By: Kamna ERP System  |  Generated At: \${today}\`;
      const footerRight = 'Kamna Traders B2B · Confidential';
      
      doc.text(footerLeft, margin, pageHeight - 12);
      doc.text(footerRight, pageWidth - margin, pageHeight - 12, { align: 'right' });
    },
    didDrawCell: (data: any) => {
      const typeColIdx = isGroup ? 2 : 1;
      const isLast = data.row.index === txRows.length + 1;
      const isOpening = data.row.index === 0;

      if (data.section === 'body' && data.column.index === typeColIdx && !isLast && !isOpening) {
        const txType = txRows[data.row.index - 1][typeColIdx];
        
        let bg = [255, 255, 255];
        let fg = [15, 23, 42];
        
        if (txType === 'Sales Invoice') {
          bg = [239, 246, 255]; // blue-50
          fg = [37, 99, 235]; // blue-600
        } else if (txType === 'Customer Payment') {
          bg = [236, 253, 245]; // emerald-50
          fg = [5, 150, 105]; // emerald-600
        } else if (txType === 'Purchase Bill') {
          bg = [255, 247, 237]; // orange-50
          fg = [234, 88, 12]; // orange-600
        } else if (txType === 'Vendor Payment') {
          bg = [250, 245, 255]; // purple-50
          fg = [147, 51, 234]; // purple-600
        }

        // Draw pill
        const padX = 3;
        const padY = 1.5;
        const textWidth = doc.getStringUnitWidth(txType) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        
        const pillWidth = textWidth + padX * 2;
        const pillHeight = doc.internal.getFontSize() * 0.3527 + padY * 2; // approx height
        
        // Center pill in cell
        const startX = data.cell.x + (data.cell.width - pillWidth) / 2;
        const startY = data.cell.y + (data.cell.height - pillHeight) / 2;
        
        // Blank out existing text
        doc.setFillColor(data.row.index % 2 === 0 ? 255 : 250, data.row.index % 2 === 0 ? 255 : 250, data.row.index % 2 === 0 ? 255 : 250);
        doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
        
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.roundedRect(startX, startY, pillWidth, pillHeight, 2, 2, 'F');
        
        doc.setTextColor(fg[0], fg[1], fg[2]);
        doc.text(txType, startX + padX, data.cell.y + data.cell.height / 2 + doc.internal.getFontSize() * 0.3527 / 3);
      }
    }
  });
`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync(file, code);
console.log("Table successfully patched!");

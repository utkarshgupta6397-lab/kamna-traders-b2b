import { formatStockDate } from '@/lib/date-utils';
import { STOCK_TABLE_CONFIG } from '../CurrentStockShared';

export interface PdfTableConfig {
  title?: string;
  head: string[][];
  body: any[][];
}

export interface PdfScreenshotConfig {
  title: string;
  filters: string[];
  tables: PdfTableConfig[];
  filename: string;
}

export async function generateStockScreenshotPDF(config: PdfScreenshotConfig) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  // Determine max columns to pick paper size
  let maxCols = 0;
  for (const table of config.tables) {
    if (table.head[0]?.length > maxCols) {
      maxCols = table.head[0].length;
    }
  }

  // First column flex width + warehouse columns + GT
  const reqWidth = STOCK_TABLE_CONFIG.PDF_FIRST_COL_MIN_WIDTH + 
                   (maxCols - 2) * STOCK_TABLE_CONFIG.PDF_WAREHOUSE_WIDTH + 
                   STOCK_TABLE_CONFIG.PDF_GRAND_TOTAL_WIDTH + 28; // 28 is margins

  let format = 'a4';
  if (reqWidth > 1189) format = 'a0';
  else if (reqWidth > 841) format = 'a1';
  else if (reqWidth > 594) format = 'a2';
  else if (reqWidth > 420) format = 'a3';

  const doc = new jsPDF({ orientation: 'landscape', format });

  doc.setFontSize(16);
  doc.setTextColor(20, 30, 80);
  doc.text(config.title, 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

  const filterStr = config.filters.length ? config.filters.join(' | ') : 'All data (no filters)';
  doc.text(`Filters: ${filterStr}`, 14, 28);

  let currentY = 38;
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const table of config.tables) {
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 15;
    }

    if (table.title) {
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text(table.title, 14, currentY);
      currentY += 6;
    }

    const colCount = table.head[0]?.length || 1;
    const columnStyles: Record<number, any> = {
      0: { cellWidth: 'auto', halign: 'left' } // Flexible first column
    };
    
    for (let i = 1; i < colCount - 1; i++) {
      columnStyles[i] = { cellWidth: STOCK_TABLE_CONFIG.PDF_WAREHOUSE_WIDTH, halign: 'center' };
    }
    if (colCount > 1) {
      columnStyles[colCount - 1] = { cellWidth: STOCK_TABLE_CONFIG.PDF_GRAND_TOTAL_WIDTH, halign: 'center' };
    }

    autoTable(doc, {
      startY: currentY,
      head: table.head,
      body: table.body,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: [226, 232, 240], lineWidth: 0.1, overflow: 'linebreak' },
      headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center' },
      columnStyles,
      didParseCell: function(data) {
        if (data.section === 'head') return;
        const rawCell = data.cell.raw as any;
        if (rawCell && typeof rawCell === 'object' && rawCell.styles) {
          Object.assign(data.cell.styles, rawCell.styles);
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  doc.save(config.filename);
}

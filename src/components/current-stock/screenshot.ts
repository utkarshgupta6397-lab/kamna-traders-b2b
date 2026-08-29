import { formatStockDate } from '@/lib/date-utils';

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

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(20, 30, 80);
  doc.text(config.title, 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

  const filterStr = config.filters.length ? config.filters.join(' | ') : 'All data (no filters)';
  doc.text(`Filters: ${filterStr}`, 14, 28);

  let currentY = 38;

  for (const table of config.tables) {
    if (currentY > 170) {
      doc.addPage();
      currentY = 15;
    }

    if (table.title) {
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text(table.title, 14, currentY);
      currentY += 6;
    }

    autoTable(doc, {
      startY: currentY,
      head: table.head,
      body: table.body,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center' },
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


import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCPDValue } from './consumption';

export async function exportStockToPDF(data: {
  warehouses: { id: string; name: string }[];
  items: any[];
  filters: {
    categories: string[];
    brands: string[];
    search: string;
  };
}) {
  const { warehouses, items, filters } = data;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  const timestamp = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const filenameDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/ /g, '-');

  // Title and Header Info
  doc.setFontSize(16);
  doc.setTextColor(26, 39, 102); // #1A2766
  doc.text('Current Stock Report', 14, 15);
  
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Generated: ${timestamp}`, 14, 20);

  // Filter Info
  let filterText = 'Filters: ';
  if (filters.search) filterText += `Search: "${filters.search}" | `;
  if (filters.categories.length) filterText += `Categories: ${filters.categories.length} selected | `;
  if (filters.brands.length) filterText += `Brands: ${filters.brands.length} selected`;
  if (filterText === 'Filters: ') filterText += 'None';
  doc.text(filterText, 14, 24);

  // Prepare Table Data
  const tableHeaders = [
    '#',
    'Product [SKU]',
    ...warehouses.map(w => w.name),
    'In Transit',
    'Total',
    'Net CPD',
    'Net DOI'
  ];

  const tableRows = items.map((item, index) => {
    const row = [
      index + 1,
      `${item.name} [${item.id}]`,
      ...warehouses.map(w => {
        const inv = item.inventory[w.id];
        return inv ? `${inv.qty} ${item.unit || ''}` : '0';
      }),
      `${item.inventory['IN_TRANSIT']?.qty ?? 0} ${item.unit || ''}`,
      `${item.rowTotal} ${item.unit || ''}`,
      `${formatCPDValue(item.netCPD)} ${item.unit || ''}/day`,
      item.doiInfo.text
    ];
    return row;
  });

  // Calculate Grand Totals if needed (or just use the ones provided in items)
  // For simplicity, we just render the items. 
  // If we want the grand total row, it should be the last row.

  autoTable(doc, {
    startY: 28,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [26, 39, 102], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 50 }, // Product Name
    },
    didParseCell: (data) => {
      // Handle DOI colors if possible (text color only)
      if (data.section === 'body' && data.column.index === tableHeaders.length - 1) {
        const text = data.cell.text[0];
        if (text.includes('d')) {
          const val = parseInt(text);
          if (val <= 15) data.cell.styles.textColor = [220, 38, 38]; // Red
          else if (val <= 30) data.cell.styles.textColor = [217, 119, 6]; // Amber
          else data.cell.styles.textColor = [22, 163, 74]; // Green
        }
      }
    },
    margin: { top: 28 },
    showHead: 'everyPage'
  });

  doc.save(`current-stock-${filenameDate}.pdf`);
}

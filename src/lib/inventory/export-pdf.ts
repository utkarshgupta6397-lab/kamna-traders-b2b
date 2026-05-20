import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCPDValue } from './consumption';

export async function exportStockToPDF(data: {
  warehouses: { id: string; name: string }[];
  categoryGroups: Record<string, { items: any[]; totals: Record<string, any> }>;
  categoryMap: Record<string, string>;
  grandTotals: Record<string, any>;
  filters: {
    categories: string[];
    brands: string[];
    search: string;
  };
}) {
  const { warehouses, categoryGroups, categoryMap, grandTotals, filters } = data;
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

  // Page Header (Matches requirements: Minimal clean header only)
  doc.setFont('Helvetica', 'Bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 39, 102); // #1A2766
  doc.text('Current Stock Report', 14, 15);
  
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 140);
  doc.setFont('Helvetica', 'Normal');
  
  let subtitleText = `Generated: ${timestamp}`;
  let filterText = '';
  if (filters.search) filterText += `Search: "${filters.search}" | `;
  if (filters.categories.length) filterText += `Categories: ${filters.categories.length} selected | `;
  if (filters.brands.length) filterText += `Brands: ${filters.brands.length} selected`;
  if (filterText) subtitleText += `  |  Filters: ${filterText.slice(0, -3)}`;
  
  doc.text(subtitleText, 14, 20);

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

  const tableRows: any[] = [];

  // Iterate over category groups to construct rows (EXACT replica of frontend table rows, no separate category subtotal rows)
  Object.entries(categoryGroups).forEach(([catId, group]) => {
    const categoryName = categoryMap[catId] || 'Uncategorized';
    const sharedUnit = group.totals.sharedUnit || '';
    const unitSuffix = sharedUnit ? ` ${sharedUnit}` : '';

    // 1. Category Header Row
    const headerRow: any = [
      { content: `${categoryName.toUpperCase()}`, colSpan: 2 },
      ...warehouses.map(w => {
        const val = group.totals[w.id] ?? 0;
        return val >= 999999999 ? '∞' : `${val}${unitSuffix}`;
      }),
      `${group.totals['IN_TRANSIT'] >= 999999999 ? '∞' : group.totals['IN_TRANSIT']}${unitSuffix}`,
      `${group.totals.total >= 999999999 ? '∞' : group.totals.total}${unitSuffix}`,
      `${formatCPDValue(group.totals.cpd)}${unitSuffix ? ' ' + unitSuffix : ''}/day`,
      group.totals.doiInfo?.text || '∞'
    ];
    headerRow.isHeaderRow = true;
    tableRows.push(headerRow);

    // Get max qty of finite items in this category for relative stock depth
    const maxQty = Math.max(...group.items.filter(i => i.rowTotal < 999999999).map(i => i.rowTotal), 0);

    // 2. Item Rows
    group.items.forEach((item, index) => {
      const itemUnit = item.unit || '';
      const itemUnitSuffix = itemUnit ? ` ${itemUnit}` : '';
      const percentile = item.rowTotal >= 999999999 ? 100 : maxQty > 0 ? (item.rowTotal / maxQty) * 100 : 0;

      const itemRow: any = [
        index + 1,
        `${item.name} [${item.id}]`,
        ...warehouses.map(w => {
          const inv = item.inventory[w.id];
          if (!inv) return `0${itemUnitSuffix}`;
          return inv.qty >= 999999999 ? '∞' : `${inv.qty}${itemUnitSuffix}`;
        }),
        `${(item.inventory['IN_TRANSIT']?.qty ?? 0) >= 999999999 ? '∞' : (item.inventory['IN_TRANSIT']?.qty ?? 0)}${itemUnitSuffix}`,
        {
          content: `${item.rowTotal >= 999999999 ? '∞' : item.rowTotal.toLocaleString()}${itemUnitSuffix}`,
          isTotalCell: true,
          qty: item.rowTotal,
          percentile: percentile
        },
        `${formatCPDValue(item.netCPD)}${itemUnitSuffix}/day`,
        item.doiInfo?.text || '∞'
      ];
      tableRows.push(itemRow);
    });
  });

  // 3. Grand Total Row
  const grandUnit = grandTotals.sharedUnit || '';
  const grandUnitSuffix = grandUnit ? ` ${grandUnit}` : '';
  const grandRow: any = [
    { content: 'GRAND TOTAL', colSpan: 2 },
    ...warehouses.map(w => {
      const val = grandTotals[w.id] ?? 0;
      return val >= 999999999 ? '∞' : `${val}${grandUnitSuffix}`;
    }),
    `${grandTotals['IN_TRANSIT'] >= 999999999 ? '∞' : grandTotals['IN_TRANSIT']}${grandUnitSuffix}`,
    `${grandTotals.total >= 999999999 ? '∞' : grandTotals.total}${grandUnitSuffix}`,
    `${formatCPDValue(grandTotals.totalCPD)}${grandUnitSuffix ? ' ' + grandUnitSuffix : ''}/day`,
    grandTotals.totalDOIInfo?.text || '∞'
  ];
  grandRow.isGrandTotalRow = true;
  tableRows.push(grandRow);

  const totalColIndex = 2 + warehouses.length + 1;
  const colStyles: any = {
    0: { halign: 'left', cellWidth: 8 },
    1: { halign: 'left', cellWidth: 60 }, // Product Name
  };
  colStyles[totalColIndex] = { halign: 'left', cellWidth: 32 }; // Total column with progress bar left padding

  autoTable(doc, {
    startY: 25,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    styles: { 
      fontSize: 6.5, 
      cellPadding: { top: 2.5, bottom: 4.5, left: 2, right: 2 }, 
      overflow: 'linebreak',
      halign: 'center',
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      textColor: [31, 41, 55] // text-gray-900 default
    },
    headStyles: { fillColor: [26, 39, 102], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: colStyles,
    didParseCell: (data) => {
      const rawRow: any = data.row.raw;
      const whStart = 2;
      const whEnd = whStart + warehouses.length - 1;
      const inTransitIndex = whStart + warehouses.length;
      const totalIndex = inTransitIndex + 1;
      const doiIndex = totalIndex + 2;

      if (rawRow && rawRow.isHeaderRow) {
        data.cell.styles.halign = 'left';
        data.cell.styles.fillColor = [238, 242, 255]; // bg-indigo-50/70
        data.cell.styles.textColor = [26, 39, 102];   // #1A2766
        data.cell.styles.fontStyle = 'bold';
        
        if (data.column.index === inTransitIndex) {
          data.cell.styles.fillColor = [224, 231, 255]; // bg-indigo-100/50 text-indigo-900
          data.cell.styles.textColor = [30, 41, 59];
        } else if (data.column.index === totalIndex) {
          data.cell.styles.fillColor = [224, 231, 255]; // bg-indigo-100
        } else if (data.column.index === doiIndex) {
          const text = data.cell.text[0];
          if (text) {
            if (text.includes('CRITICAL')) {
              data.cell.styles.fillColor = [254, 226, 226]; // bg-red-50/50
              data.cell.styles.textColor = [220, 38, 38];
            } else if (text.includes('WARNING')) {
              data.cell.styles.fillColor = [254, 243, 199]; // bg-amber-50/50
              data.cell.styles.textColor = [217, 119, 6];
            } else {
              data.cell.styles.fillColor = [209, 250, 229]; // bg-green-50/50
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        }
      } else if (rawRow && rawRow.isGrandTotalRow) {
        data.cell.styles.fillColor = [26, 39, 102];   // bg-[#1A2766]
        data.cell.styles.textColor = [255, 255, 255]; // White
        data.cell.styles.fontStyle = 'bold';
        
        if (data.column.index === inTransitIndex) {
          data.cell.styles.fillColor = [49, 46, 129]; // bg-indigo-900/50
          data.cell.styles.textColor = [224, 231, 255];
        } else if (data.column.index === totalIndex) {
          data.cell.styles.fillColor = [71, 82, 134]; // bg-white/20
          data.cell.styles.textColor = [255, 255, 255];
        }
      } else {
        // Normal row styling
        if (data.section === 'body') {
          // Negative warehouse stock cell coloring
          const text = data.cell.text[0];
          if (data.column.index >= whStart && data.column.index <= whEnd) {
            if (text && text.startsWith('-')) {
              data.cell.styles.fillColor = [254, 242, 242]; // bg-red-50/20
              data.cell.styles.textColor = [220, 38, 38];   // Red text
              data.cell.styles.fontStyle = 'bold';
            } else if (text === '0' || !text) {
              data.cell.styles.textColor = [209, 213, 219]; // text-gray-300
            }
          }

          // In Transit Column styling
          if (data.column.index === inTransitIndex) {
            if (text && text.startsWith('-')) {
              data.cell.styles.fillColor = [254, 242, 242]; // bg-red-50/20
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else if (text === '0' || !text) {
              data.cell.styles.textColor = [209, 213, 219]; // text-gray-300
              data.cell.styles.fillColor = [245, 247, 255]; // bg-indigo-50/30
            } else {
              data.cell.styles.fillColor = [245, 247, 255]; // bg-indigo-50/30
              data.cell.styles.textColor = [30, 41, 59];    // text-indigo-900
              data.cell.styles.fontStyle = 'bold';
            }
          }

          // Total Column styling
          if (data.column.index === totalIndex) {
            data.cell.styles.fillColor = [243, 244, 248]; // bg-[#1A2766]/5 -> [243, 244, 248]
            data.cell.styles.textColor = [26, 39, 102];   // text-[#1A2766]
            data.cell.styles.fontStyle = 'bold';
          }

          // Net DOI column styling
          if (data.column.index === doiIndex) {
            if (text) {
              if (text.includes('CRITICAL')) {
                data.cell.styles.fillColor = [254, 244, 244]; // bg-red-50/30
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
              } else if (text.includes('WARNING')) {
                data.cell.styles.fillColor = [254, 247, 237]; // bg-amber-50/30
                data.cell.styles.textColor = [217, 119, 6];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.fillColor = [240, 253, 244]; // bg-green-50/30
                data.cell.styles.textColor = [22, 163, 74];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        }
      }
    },
    didDrawCell: (data) => {
      const cellRaw: any = data.cell.raw;
      if (cellRaw && cellRaw.isTotalCell && cellRaw.qty !== undefined && cellRaw.qty > 0 && cellRaw.qty < 999999999) {
        const { doc } = data;
        const percentile = cellRaw.percentile;
        
        let color = [22, 163, 74];
        if (percentile <= 20) color = [239, 68, 68];
        else if (percentile <= 40) color = [249, 115, 22];
        else if (percentile <= 60) color = [234, 179, 8];
        else if (percentile <= 80) color = [132, 204, 22];

        const barWidth = 10;
        const barHeight = 1.5;
        
        // Positioned 18mm from the left edge of the cell (centered side-by-side)
        const barX = data.cell.x + 18;
        const barY = data.cell.y + (data.cell.height - barHeight) / 2;

        // Background track (soft light grey pill matching frontend rounded-full track)
        doc.setFillColor(229, 231, 235);
        doc.roundedRect(barX, barY, barWidth, barHeight, 0.75, 0.75, 'F');
        
        // Filled bar
        const filledWidth = (barWidth * percentile) / 100;
        if (filledWidth > 0) {
          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(barX, barY, filledWidth, barHeight, 0.75, 0.75, 'F');
        }
      }
    },
    margin: { top: 28 },
    showHead: 'everyPage'
  });

  doc.save(`current-stock-${filenameDate}.pdf`);
}

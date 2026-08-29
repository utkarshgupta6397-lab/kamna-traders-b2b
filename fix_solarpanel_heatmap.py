import re

with open('src/components/SolarPanelStockClient.tsx', 'r') as f:
    content = f.read()

# Replace buildTableBody and the tables.push logic
replacement = """      const buildPdfRows = (cols: PivotColumnDef[], pRows: PivotRowDef[]) => {
        const { getStyle } = buildHeatmap(pRows);
        return pRows.map(r => {
          const rowArr: any[] = [];
          let cellBg = [255, 255, 255];
          let textColor = [50, 50, 50];
          let fontStyle = 'normal';
          
          if (r.isGroupHeader) {
             cellBg = [241, 245, 249]; textColor = [30, 41, 59]; fontStyle = 'bold';
          } else if (r.isGrandTotal) {
             cellBg = [26, 39, 102]; textColor = [255, 255, 255]; fontStyle = 'bold';
          }

          rowArr.push({ 
            content: r.isGroupHeader || r.isGrandTotal ? r.label : `   ${r.label}`, 
            styles: { fillColor: cellBg, textColor, fontStyle, halign: 'left' } 
          });
          
          cols.forEach(c => {
            const cell = r.cells[c.id];
            const val = typeof cell === 'number' ? cell : (cell?.value || 0);
            let content = '—';
            if (val > 0) content = val.toLocaleString();
            if (r.isGroupHeader && val === 0) content = '';

            const rawStyle = getStyle(r, c.id, val, !!c.isGrandTotal);
            const outBg = (rawStyle as any).pdfFillColor || cellBg;
            const outText = (rawStyle as any).pdfTextColor || textColor;
            
            rowArr.push({
              content,
              styles: { fillColor: outBg, textColor: outText, fontStyle: c.isGrandTotal ? 'bold' : fontStyle, halign: 'center' }
            });
          });
          
          return rowArr;
        });
      };

      if (hasDcrData) {
         tables.push({
           title: 'DCR Solar Panel Stock',
           head: [['Series / SKU', ...dcrCols.map(c => c.label)]],
           body: buildPdfRows(dcrCols, buildMatrixRows('DCR', dcrWarehouses, true))
         });
      }
      
      if (hasNonDcrData) {
         tables.push({
           title: 'Non-DCR Solar Panel Stock',
           head: [['Series / SKU', ...nonDcrCols.map(c => c.label)]],
           body: buildPdfRows(nonDcrCols, buildMatrixRows('Non-DCR', nonDcrWarehouses, true))
         });
      }"""

# Use regex to replace everything from `const buildTableBody =` up to the second `});\n      }`
content = re.sub(
    r'const buildTableBody = \(cols: PivotColumnDef\[\], pRows: PivotRowDef\[\]\) => \{.*?\n      \}',
    replacement,
    content,
    flags=re.DOTALL
)

with open('src/components/SolarPanelStockClient.tsx', 'w') as f:
    f.write(content)


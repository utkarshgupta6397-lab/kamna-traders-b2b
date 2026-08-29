'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Box, ChevronDown, Check, Camera, Loader2, Download, X } from 'lucide-react';
import CurrentStockSidebar from './CurrentStockSidebar';
import { formatStockDate } from '@/lib/date-utils';
import toast from 'react-hot-toast';

// Types
interface Warehouse { id: string; name: string; isSystemWarehouse?: boolean; }
interface Brand { id: string; name: string; }
interface SkuInventory { [warehouseId: string]: { qty: number; isOos: boolean; } }
interface SkuItem {
  id: string; name: string; brandId?: string | null; brand?: string | null;
  categoryId?: string | null; categoryName?: string | null; unit?: string | null;
  inventory: SkuInventory;
  sku?: string;
  inverterType?: string | null;
  inverterCapacity?: string | null;
  phaseType?: string | null;
}
interface Props {
  warehouses: Warehouse[]; categories: Record<string, unknown>[]; brands: Brand[];
  items: SkuItem[]; canSync?: boolean;
}

// Helpers
function normalizeCapacity(cap: string | null | undefined): { value: string, num: number, unit: string } {
  if (!cap || cap.trim() === '') return { value: 'Unknown', num: Infinity, unit: '' };
  
  // Collapse internal whitespace and standardize casing for unmatched cases
  const val = cap.trim().replace(/\s+/g, ' ');
  
  const match = val.match(/^([\d.]+)\s*(kwp?|kVA|va|w|mw|kwh?)$/i);
  if (match) {
    const num = parseFloat(match[1]);
    let unit = match[2].toLowerCase();
    let normalizedNum = num;
    
    // Normalize to kW for sorting purposes
    if (unit === 'w' || unit === 'va') normalizedNum = num / 1000;
    else if (unit === 'mw') normalizedNum = num * 1000;
    
    // Capitalization normalization
    let displayUnit = unit;
    if (unit === 'kw') displayUnit = 'kW';
    else if (unit === 'kwp') displayUnit = 'kWp';
    else if (unit === 'kva') displayUnit = 'kVA';
    else if (unit === 'va') displayUnit = 'VA';
    else if (unit === 'w') displayUnit = 'W';
    else if (unit === 'mw') displayUnit = 'MW';
    else if (unit === 'kwh') displayUnit = 'kWh';

    return { value: `${num} ${displayUnit}`, num: normalizedNum, unit: displayUnit };
  }
  
  // For un-matched capacities, use title case or standardize to avoid grouping splits due to casing
  return { value: val.toUpperCase(), num: Infinity, unit: '' };
}

const heatmapColors = [
  { r: 236, g: 253, b: 245 }, { r: 167, g: 243, b: 208 }, { r: 253, g: 230, b: 138 },
  { r: 251, g: 146, b: 60 }, { r: 239, g: 68, b: 68 }
];

function getHeatmapStyle(val: number, maxVal: number, isGTCol: boolean, isGTRow: boolean): React.CSSProperties {
  if (val <= 0) return {};
  if (isGTRow) {
    const ratio = Math.min(1, val / (maxVal || 1));
    const add = Math.round(ratio * 14);
    return { backgroundColor: `rgb(${26+add},${39+add},${102+add})`, color: '#fff' };
  }
  const ratio = Math.min(1, Math.max(0, val / (maxVal || 1)));
  const steps = heatmapColors.length - 1;
  const scaled = ratio * steps;
  const idx = Math.floor(scaled);
  let r, g, b;
  if (idx >= steps) {
    r = heatmapColors[steps].r; g = heatmapColors[steps].g; b = heatmapColors[steps].b;
  } else {
    const t = scaled - idx;
    const c1 = heatmapColors[idx];
    const c2 = heatmapColors[idx + 1];
    r = Math.round(c1.r + (c2.r - c1.r) * t);
    g = Math.round(c1.g + (c2.g - c1.g) * t);
    b = Math.round(c1.b + (c2.b - c1.b) * t);
  }
  if (isGTCol) { r = Math.round(r * 0.95); g = Math.round(g * 0.95); b = Math.round(b * 0.95); }
  const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  return { backgroundColor: `rgb(${r},${g},${b})`, color: isDark ? '#fff' : '#0f172a', fontWeight: ratio > 0.4 ? 600 : 500 };
}

const MultiSelectFilter = ({ label, options, selected, onToggle, wideMenu = false }: {
  label: string; options: { id: string; name: string }[]; selected: string[];
  onToggle: (id: string) => void; wideMenu?: boolean;
}) => (
  <div className="relative group shrink-0">
    <button className="flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 text-gray-700 rounded-md h-8 px-3 bg-white hover:bg-gray-50 focus:outline-none transition-colors whitespace-nowrap">
      <span>{selected.length > 0 ? `${selected.length} ${label}` : `All ${label}`}</span>
      <ChevronDown size={14} className="text-gray-400" />
    </button>
    <div className="absolute left-0 mt-1 z-[100] bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
      style={{ minWidth: wideMenu ? '300px' : '192px', maxWidth: '360px' }}>
      <div className="p-1 max-h-64 overflow-auto">
        {options.map(opt => (
          <button key={opt.id} onClick={() => onToggle(opt.id)} className="w-full flex items-start gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left">
            <div className={`w-4 h-4 border rounded shrink-0 flex items-center justify-center mt-0.5 ${selected.includes(opt.id) ? 'bg-[#1A2766] border-[#1A2766]' : 'bg-white border-gray-300'}`}>
              {selected.includes(opt.id) && <Check size={10} className="text-white" />}
            </div>
            <span className="leading-snug break-words">{opt.name}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const Badge = ({ children, color = 'blue' }: { children: React.ReactNode, color?: 'blue' | 'purple' | 'amber' | 'gray' | 'red' }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    red: 'bg-red-50 text-red-700 border-red-200'
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm whitespace-nowrap ${colors[color]}`}>
      {children}
    </span>
  );
};

export default function InverterStockClient({ warehouses, items }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [selectedCapacities, setSelectedCapacities] = useState<string[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);
  
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const operationalWarehouses = useMemo(() => warehouses.filter(w => !w.isSystemWarehouse), [warehouses]);

  const processedItems = useMemo(() => items.map(item => {
    const cap = normalizeCapacity(item.inverterCapacity);
    return {
      ...item,
      normalizedCapacity: cap.value,
      capacityNum: cap.num,
      invType: item.inverterType?.trim() || 'Unknown',
      phase: item.phaseType?.trim() || 'Unknown',
      brandVal: item.brand || 'Unbranded'
    };
  }), [items]);

  const availableBrands = useMemo(() => Array.from(new Set(processedItems.map(i => i.brandVal))).map(name => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name)), [processedItems]);
  const availableTypes = useMemo(() => Array.from(new Set(processedItems.map(i => i.invType))).map(name => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name)), [processedItems]);
  const availablePhases = useMemo(() => Array.from(new Set(processedItems.map(i => i.phase))).map(name => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name)), [processedItems]);
  
  const availableCapacities = useMemo(() => {
    const unique = new Map<string, number>();
    processedItems.forEach(i => { if (!unique.has(i.normalizedCapacity)) unique.set(i.normalizedCapacity, i.capacityNum); });
    return Array.from(unique.entries()).sort((a, b) => a[1] - b[1]).map(([name]) => ({ id: name, name }));
  }, [processedItems]);

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return processedItems.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q)) return false;
      if (selectedBrands.length > 0 && !selectedBrands.includes(item.brandVal)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(item.invType)) return false;
      if (selectedPhases.length > 0 && !selectedPhases.includes(item.phase)) return false;
      if (selectedCapacities.length > 0 && !selectedCapacities.includes(item.normalizedCapacity)) return false;
      return true;
    });
  }, [processedItems, debouncedSearch, selectedBrands, selectedTypes, selectedPhases, selectedCapacities]);

  const visibleWarehouses = useMemo(() => selectedWarehouses.length > 0 ? operationalWarehouses.filter(w => selectedWarehouses.includes(w.id)) : operationalWarehouses, [operationalWarehouses, selectedWarehouses]);
  const meaningfulWarehouses = useMemo(() => visibleWarehouses.filter(wh => filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)), [filteredItems, visibleWarehouses]);
  
  // Requirement: maximum 5 visible warehouse columns
  const displayedWarehouses = useMemo(() => meaningfulWarehouses.slice(0, 5), [meaningfulWarehouses]);

  const handleExportRawData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      
      const rows = filteredItems.map(item => {
        const row: Record<string, string | number> = {
          'SKU': item.sku || item.id,
          'Product Name': item.name,
          'Category': item.categoryName || 'Unknown',
          'Brand': item.brandVal,
          'Inverter Capacity': item.normalizedCapacity,
          'Inverter Type': item.invType,
          'Phase Type': item.phase
        };
        
        let totalQty = 0;
        meaningfulWarehouses.forEach(wh => {
          const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
          row[`${wh.name}`] = qty;
          totalQty += qty;
        });
        row['Grand Total'] = totalQty;
        
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Raw Data");
      
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `inverter-stock-raw-data-${dateStr}.xlsx`);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleTakeScreenshot = async () => {
    setExportingReportId('screenshot');
    const tid = toast.loading('Generating PDF report...');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      
      doc.setFontSize(16);
      doc.setTextColor(20, 30, 80);
      doc.text('KAMNA ERP — Inverter Stock', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

      const filterParts = [];
      if (selectedWarehouses.length) filterParts.push(`Warehouses: ${selectedWarehouses.length}`);
      if (selectedBrands.length) filterParts.push(`Brands: ${selectedBrands.join(', ')}`);
      if (selectedCapacities.length) filterParts.push(`Capacities: ${selectedCapacities.length}`);
      if (selectedTypes.length) filterParts.push(`Types: ${selectedTypes.join(', ')}`);
      const filterStr = filterParts.length ? filterParts.join(' | ') : 'All data (no filters)';
      doc.text(`Filters: ${filterStr}`, 14, 28);

      const head = [['Brand / Capacity / Config', ...displayedWarehouses.map(w => w.name), 'Grand Total']];
      
      const body = matrixRows.map(row => {
        const rowData: Record<string, unknown>[] = [];
        
        let labelStr = row.label;
        if (row.isGroupHeader) {
           rowData.push({ content: labelStr, styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', halign: 'left' } });
        } else if (row.isGrandTotal) {
           rowData.push({ content: 'Grand Total', styles: { fillColor: [26, 39, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' } });
        } else {
           const sub = [row.invType, row.phase].filter(x => x && x !== 'Unknown').join(' | ');
           labelStr = `   ${row.label}${sub ? `\n   (${sub})` : ''}`;
           rowData.push({ content: labelStr, styles: { fillColor: [255, 255, 255], textColor: [50, 50, 50], halign: 'left' } });
        }

        const cols = [...displayedWarehouses.map(w => w.id), 'GT'];
        cols.forEach(colId => {
          if (row.isGroupHeader) {
            rowData.push({ content: '', styles: { fillColor: [241, 245, 249] } });
            return;
          }
          const val = row.cells[colId] || 0;
          let content = '—';
          if (val > 0) content = val.toString();
          
          let styles = {};
          if (row.isGrandTotal) {
            styles = { fillColor: [26, 39, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' };
          } else {
            const isGTCol = colId === 'GT';
            const max = isGTCol ? maxGt : maxBody;
            const bgStyle = getHeatmapStyle(val, max, isGTCol, false);
            let bg = [255,255,255];
            let tx = [50,50,50];
            if (bgStyle.backgroundColor && typeof bgStyle.backgroundColor === 'string') {
               const match = bgStyle.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
               if (match) bg = [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
            }
            if (bgStyle.color === '#fff') tx = [255,255,255];
            styles = { fillColor: bg, textColor: tx, halign: 'center', fontStyle: bgStyle.fontWeight === 600 ? 'bold' : 'normal' };
          }
          rowData.push({ content, styles });
        });
        return rowData;
      });

      autoTable(doc, {
        startY: 35, head, body, theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [248, 249, 251], textColor: [80, 80, 80], fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { cellWidth: 70, halign: 'left' } },
        showHead: 'everyPage', margin: { top: 15, right: 14, bottom: 15, left: 14 }
      });
      doc.save('Inverter_Stock.pdf');
      toast.success('Report generated', { id: tid });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate report', { id: tid });
    } finally {
      setExportingReportId(null);
    }
  };

  // Build matrix
  // Rows: Unique combination of Brand + Capacity + Type + Phase
  interface MatrixRow {
    id: string;
    label: string; // Brand or Capacity
    isGroupHeader?: boolean;
    isGrandTotal?: boolean;
    cells: Record<string, number>;
    capacityNum?: number;
    invType?: string;
    phase?: string;
  }

  const { matrixRows, maxBody, maxGt } = useMemo(() => {
    const root = new Map<string, Map<string, { cells: Record<string, number> }>>();
    const colTotals: Record<string, number> = {};
    let gtTotal = 0;

    filteredItems.forEach(item => {
      const brand = item.brandVal;
      const key = `${item.normalizedCapacity}|${item.invType}|${item.phase}`;
      
      if (!root.has(brand)) root.set(brand, new Map());
      const brandMap = root.get(brand)!;
      
      if (!brandMap.has(key)) {
        brandMap.set(key, { cells: {} });
      }
      
      const comb = brandMap.get(key)!;

      meaningfulWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          comb.cells[wh.id] = (comb.cells[wh.id] || 0) + qty;
          comb.cells['GT'] = (comb.cells['GT'] || 0) + qty;
          
          colTotals[wh.id] = (colTotals[wh.id] || 0) + qty;
          colTotals['GT'] = (colTotals['GT'] || 0) + qty;
          gtTotal += qty;
        }
      });
    });

    const rows: MatrixRow[] = [];
    let maxB = 0;
    let maxG = 0;

    Array.from(root.keys()).sort().forEach(brand => {
      const brandMap = root.get(brand)!;
      let brandTotal = 0;
      
      // Calculate brand total to see if we should render the group
      Array.from(brandMap.values()).forEach(comb => brandTotal += (comb.cells['GT'] || 0));
      if (brandTotal === 0) return;

      rows.push({ id: `brand_${brand}`, label: brand, isGroupHeader: true, cells: {} });
      
      const combos = Array.from(brandMap.entries()).map(([k, v]) => {
        const parts = k.split('|');
        const capNum = parts[0] === 'Unknown' ? Infinity : parseFloat(parts[0]) || 0; // Simple parse for sorting within group
        return { key: k, cap: parts[0], invType: parts[1], phase: parts[2], cells: v.cells, num: capNum };
      });
      
      // Sort combos by capacity, then others
      combos.sort((a, b) => {
        if (a.num !== b.num) return a.num - b.num;
        if (a.invType !== b.invType) return a.invType.localeCompare(b.invType);
        return a.phase.localeCompare(b.phase);
      });

      combos.forEach(c => {
        if ((c.cells['GT'] || 0) > 0) {
          Object.entries(c.cells).forEach(([colId, val]) => {
            if (colId === 'GT') maxG = Math.max(maxG, val);
            else maxB = Math.max(maxB, val);
          });
          
          rows.push({
            id: `comb_${brand}_${c.key}`,
            label: c.cap,
            capacityNum: c.num,
            invType: c.invType,
            phase: c.phase,
            cells: c.cells
          });
        }
      });
    });

    rows.push({ id: 'gt_row', label: 'Grand Total', isGrandTotal: true, cells: colTotals });
    
    return { matrixRows: rows, maxBody: maxB, maxGt: maxG };
  }, [filteredItems, meaningfulWarehouses]);

  return (
    <div className="flex h-full gap-5">
      <CurrentStockSidebar activeView="inverter" />
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A2766]/10 flex items-center justify-center">
              <Box size={17} className="text-[#1A2766]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Inverter Stock</h1>
              <p className="text-[11px] text-gray-500 font-medium">Real-time inventory view</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {exportingReportId === 'screenshot' ? (
              <button disabled className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 rounded-md border border-gray-200 opacity-50">
                <Loader2 size={13} className="animate-spin text-gray-500" /> Capturing...
              </button>
            ) : (
              <button onClick={handleTakeScreenshot} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-200 transition-colors">
                <Camera size={13} className="text-gray-500" /> Screenshot
              </button>
            )}
            <button onClick={handleExportRawData} disabled={isExporting} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-md border border-transparent transition-colors">
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Raw Data
            </button>
          </div>
        </div>

        <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-2 flex-wrap shrink-0">
          <div className="relative mr-2 w-64 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search product or SKU..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766]" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14}/></button>}
          </div>
          <MultiSelectFilter label="Warehouses" options={operationalWarehouses} selected={selectedWarehouses} onToggle={id => toggle(setSelectedWarehouses, id)} />
          <MultiSelectFilter label="Brands" options={availableBrands} selected={selectedBrands} onToggle={id => toggle(setSelectedBrands, id)} />
          <MultiSelectFilter label="Types" options={availableTypes} selected={selectedTypes} onToggle={id => toggle(setSelectedTypes, id)} />
          <MultiSelectFilter label="Phases" options={availablePhases} selected={selectedPhases} onToggle={id => toggle(setSelectedPhases, id)} />
          <MultiSelectFilter label="Capacities" options={availableCapacities} selected={selectedCapacities} onToggle={id => toggle(setSelectedCapacities, id)} wideMenu />
        </div>

        <div className="flex-1 overflow-auto bg-[#F8F9FB] p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col mb-6 overflow-hidden max-w-[100%]">
            <div className="relative bg-white pivot-scroll-container overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)]">
              <table className="text-sm text-left border-collapse" style={{ minWidth: "100%" }}>
                <thead>
                  <tr className="bg-[#f8f9fb]">
                    <th className="px-4 py-3 font-bold text-[12px] text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 border-r border-gray-200 bg-[#f8f9fb] h-[42px]" style={{ position: 'sticky', left: 0, top: 0, zIndex: 50 }}>
                      Brand / Capacity / Config
                    </th>
                    {displayedWarehouses.map(wh => (
                      <th key={wh.id} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 text-gray-700 border-gray-300 border-l border-gray-200" style={{ position: "sticky", top: 0, zIndex: 40, backgroundColor: "#EEF2FF", minWidth: 120, height: '42px' }}>
                        {wh.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 text-white border-white/20 border-l-4 border-l-white/30" style={{ position: "sticky", right: 0, top: 0, zIndex: 50, backgroundColor: "#1A2766", minWidth: 100, height: '42px' }}>
                      Grand Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row, rIdx) => {
                    if (row.isGroupHeader) {
                      return (
                        <tr key={row.id} className="border-b border-slate-200">
                          <td colSpan={displayedWarehouses.length + 2} className="pl-4 font-bold text-[13px] tracking-wider h-[40px] z-[40] text-slate-800 uppercase border-r border-slate-200 bg-slate-100" style={{ position: 'sticky', left: 0 }}>
                            {row.label}
                          </td>
                        </tr>
                      );
                    }

                    const isAlt = !row.isGrandTotal && (rIdx % 2 !== 0);
                    const isGT = row.isGrandTotal;

                    return (
                      <tr key={row.id} className={`border-b border-gray-100 transition-all ${isGT ? 'font-bold text-[12px] text-white' : 'hover:bg-blue-50/50'} ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`} style={isGT ? { position: "sticky", bottom: 0, zIndex: 50 } : {}}>
                        <td className={`px-4 py-2 font-medium border-r border-gray-200 transition-colors ${isGT ? 'text-[12px] font-black uppercase tracking-wider border-t-2 border-white/10' : `text-[13px] text-gray-700 pl-8 ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`}`}
                          style={isGT ? { position: 'sticky', left: 0, backgroundColor: '#1A2766', color: '#fff', zIndex: 50 } : { position: 'sticky', left: 0, zIndex: 40 }}>
                          
                          {isGT ? (
                            <span className="truncate">{row.label}</span>
                          ) : (
                            <div className="flex flex-row items-center gap-1.5 whitespace-nowrap">
                              <span className="font-semibold text-gray-900 mr-1">{row.label}</span>
                              {row.invType && <Badge color={row.invType === 'Unknown' ? 'gray' : 'blue'}>{row.invType}</Badge>}
                              {row.phase && <Badge color={row.phase === 'Unknown' ? 'gray' : 'purple'}>{row.phase}</Badge>}
                            </div>
                          )}
                        </td>
                        
                        {displayedWarehouses.map(col => {
                          const val = row.cells[col.id] || 0;
                          const cs = getHeatmapStyle(val, maxBody, false, !!isGT);
                          
                          return (
                            <td key={col.id} className={`px-3 py-2 text-center transition-all ${isGT ? 'border-t-2 border-white/10 py-3 border-l border-white/10' : 'border-l border-gray-100'}`} style={cs}>
                              {val === 0 ? <span className={isGT ? "opacity-40" : "text-gray-300 select-none"}>—</span> : <span className="whitespace-nowrap font-semibold">{val}</span>}
                            </td>
                          );
                        })}
                        
                        {/* Grand Total Column */}
                        <td className={`px-3 py-2 text-center transition-all ${isGT ? 'border-t-2 border-white/10 py-3 border-l-4 border-l-white/30' : 'border-l border-gray-100'}`} style={isGT ? { position: 'sticky', right: 0, backgroundColor: '#1A2766', color: '#fff' } : { position: 'sticky', right: 0, ...getHeatmapStyle(row.cells['GT'] || 0, maxGt, true, false) }}>
                          {(row.cells['GT'] || 0) === 0 ? <span className={isGT ? "opacity-40" : "text-gray-300 select-none"}>—</span> : <span className="whitespace-nowrap font-bold">{(row.cells['GT'] || 0)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

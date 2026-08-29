'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, Check, Loader2, Download, X, Wrench, Camera, AlertTriangle } from 'lucide-react';
import CurrentStockSidebar from './CurrentStockSidebar';
import { StockPageShell, StockHeader, StockFilterBar, StockEmptyState, STOCK_TABLE_CONFIG, getSharedHeatmapStyle } from './CurrentStockShared';
import { formatStockDate } from '@/lib/date-utils';

// Types
interface Warehouse { id: string; name: string; isSystemWarehouse?: boolean; }
interface SkuInventory { [warehouseId: string]: { qty: number; isOos: boolean; } }
interface SkuItem {
  id: string; name: string; categoryName?: string | null;
  inventory: SkuInventory; sku?: string; unit?: string | null;
}
interface Props {
  warehouses: Warehouse[]; categories: Record<string, unknown>[]; brands: {id: string, name: string}[];
  items: SkuItem[]; canSync?: boolean;
}

function getHeatmapStyle(val: number, maxVal: number, isGTCol: boolean, isGTRow: boolean): React.CSSProperties {
  if (isGTRow || isGTCol) {
    return getSharedHeatmapStyle(val, maxVal, true, false);
  }
  return getSharedHeatmapStyle(val, maxVal, false, false);
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

export default function SolarAccessoriesStockClient({ warehouses, items }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };

  const operationalWarehouses = useMemo(() => warehouses.filter(w => !w.isSystemWarehouse), [warehouses]);
  
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return items.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, debouncedSearch]);

  const visibleWarehouses = useMemo(() => selectedWarehouses.length > 0 ? operationalWarehouses.filter(w => selectedWarehouses.includes(w.id)) : operationalWarehouses, [operationalWarehouses, selectedWarehouses]);
  const meaningfulWarehouses = useMemo(() => visibleWarehouses.filter(wh => filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)), [filteredItems, visibleWarehouses]);

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
      XLSX.writeFile(workbook, `solar-accessories-stock-${dateStr}.xlsx`);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  const { matrixRows, maxBody, maxGt } = useMemo(() => {
    const root = new Map<string, { products: SkuItem[], cells: Record<string, number>, units: Set<string> }>();
    const colTotals: Record<string, number> = {};
    const allUnits = new Set<string>();

    filteredItems.forEach(item => {
      const cat = item.categoryName?.trim() || 'Uncategorized';
      if (!root.has(cat)) root.set(cat, { products: [], cells: {}, units: new Set() });
      const catData = root.get(cat)!;
      catData.products.push(item);
      const itemUnit = item.unit || 'pcs';
      catData.units.add(itemUnit);
      allUnits.add(itemUnit);
      
      meaningfulWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          catData.cells[wh.id] = (catData.cells[wh.id] || 0) + qty;
          catData.cells['GT'] = (catData.cells['GT'] || 0) + qty;
          colTotals[wh.id] = (colTotals[wh.id] || 0) + qty;
          colTotals['GT'] = (colTotals['GT'] || 0) + qty;
        }
      });
    });

    const rows: {
      id: string;
      label: string;
      isGroupHeader?: boolean;
      isExpanded?: boolean;
      isProduct?: boolean;
      isGrandTotal?: boolean;
      sku?: string;
      unit?: string;
      cells: Record<string, number>;
      isVisible?: boolean;
    }[] = [];
    let maxB = 0;
    let maxG = 0;

    Array.from(root.keys()).sort().forEach(catName => {
      const catData = root.get(catName)!;
      if ((catData.cells['GT'] || 0) === 0) return;

      const isExpanded = expandedCategories.has(catName);

      rows.push({
        id: `cat_${catName}`,
        label: catName,
        isGroupHeader: true,
        isExpanded,
        cells: catData.cells,
        unit: catData.units.size === 1 ? Array.from(catData.units)[0] : undefined
      });
      
      if (isExpanded) {
         catData.products.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
           const pCells: Record<string, number> = {};
           let pGt = 0;
           meaningfulWarehouses.forEach(wh => {
              const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
              if (qty > 0) {
                 pCells[wh.id] = qty;
                 pGt += qty;
                 maxB = Math.max(maxB, qty);
              }
           });
           if (pGt > 0) {
              pCells['GT'] = pGt;
              maxG = Math.max(maxG, pGt);
              rows.push({
                id: `prod_${item.id}`,
                label: item.name,
                isProduct: true,
                sku: item.sku || item.id,
                unit: item.unit || 'pcs',
                cells: pCells
              });
           }
         });
      }
    });

    rows.push({ 
      id: 'gt_row', 
      label: 'Grand Total', 
      isGrandTotal: true, 
      cells: colTotals,
      unit: allUnits.size === 1 ? Array.from(allUnits)[0] : undefined,
      isVisible: true
    });
    
    return { matrixRows: rows, maxBody: maxB, maxGt: maxG };
  }, [filteredItems, meaningfulWarehouses, expandedCategories]);

  const [isScreenshotting, setIsScreenshotting] = useState(false);

  const handleTakeScreenshot = async () => {
    setIsScreenshotting(true);
    try {
      const { generateStockScreenshotPDF } = await import('./current-stock/screenshot');
      const filters = [];
      if (selectedWarehouses.length) filters.push(`Warehouses: ${selectedWarehouses.length}`);

      const formatQty = (v: number, unit?: string) => unit ? `${v} ${unit}` : `${v}`;
      const head = [['Category / Product Name', ...meaningfulWarehouses.map(w => w.name), 'Grand Total']];
      
      const body = matrixRows.map(row => {
        const rowData: any[] = [];
        let labelStr = row.label;
        let cellBg = [255, 255, 255];
        let textColor = [50, 50, 50];
        let fontStyle = 'normal';

        if (row.isGroupHeader) {
           cellBg = [241, 245, 249]; textColor = [30, 41, 59]; fontStyle = 'bold';
        } else if (row.isGrandTotal) {
           cellBg = [26, 39, 102]; textColor = [255, 255, 255]; fontStyle = 'bold';
           labelStr = 'Grand Total';
        } else {
           labelStr = `   ${row.label} - ${row.sku}`;
        }
        
        rowData.push({ content: labelStr, styles: { fillColor: cellBg, textColor, fontStyle, halign: 'left' } });

        const cols = [...meaningfulWarehouses.map(w => w.id), 'GT'];
        cols.forEach(colId => {
          const val = row.cells[colId] || 0;
          let content = '—';
          if (val > 0) content = formatQty(val, row.unit);
          
          let styles = {};
          if (row.isGroupHeader) {
            styles = { fillColor: cellBg, textColor, fontStyle: 'bold', halign: 'center' };
          } else if (row.isGrandTotal) {
            styles = { fillColor: cellBg, textColor, fontStyle: 'bold', halign: 'center' };
          } else {
            const rawStyle = getHeatmapStyle(val, colId === 'GT' ? maxGt : maxBody, colId === 'GT', false);
            const outBg = rawStyle.backgroundColor || cellBg;
            const outText = rawStyle.color || textColor;
            styles = { fillColor: outBg, textColor: outText, halign: 'center' };
          }
          rowData.push({ content, styles });
        });
        
        return rowData;
      });

      await generateStockScreenshotPDF({
        title: 'KAMNA ERP — Solar Accessories Stock',
        filters,
        tables: [{ head, body }],
        filename: `KAMNA_AccessoriesStock_${new Date().getTime()}.pdf`
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsScreenshotting(false);
    }
  };

  return (
    <StockPageShell sidebar={<CurrentStockSidebar activeView="accessories" />}>
      <StockHeader
        icon={Wrench}
        title="Solar Accessories Stock"
        subtitle="Current inventory by category"
        itemCount={filteredItems.length}
        date={formatStockDate(new Date())}
        onExportRaw={handleExportRawData}
        onScreenshot={handleTakeScreenshot}
        isExporting={isExporting}
        isScreenshotting={isScreenshotting}
      />
      
      <StockFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search product or SKU..."
      >
        <MultiSelectFilter label="Warehouses" options={operationalWarehouses} selected={selectedWarehouses} onToggle={id => toggle(setSelectedWarehouses, id)} />
      </StockFilterBar>

      <div className="flex-1 overflow-auto bg-[#F8F9FB] p-5">
        {matrixRows.length === 0 ? (
          <StockEmptyState 
            icon={Wrench} 
            title="No Solar Accessories stock found" 
            message="Try adjusting your filters or search terms." 
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-[8px] shadow-sm flex flex-col overflow-hidden max-w-[100%]">
            <div className="relative bg-white pivot-scroll-container overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)]">
              <table className="text-[13px] text-left border-collapse" style={{ width: "100%", minWidth: "max-content" }}>
                <thead>
                  <tr className="bg-[#f8f9fb]">
                    <th className="px-4 py-3 font-bold text-[12px] text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 border-r border-gray-200 bg-[#f8f9fb] h-[42px]" style={{ position: 'sticky', left: 0, top: 0, zIndex: 50, minWidth: '240px', maxWidth: '350px', whiteSpace: 'normal', wordBreak: 'break-word', width: 'auto' }}>
                      Category / Product Name
                    </th>
                    {meaningfulWarehouses.map(wh => (
                      <th key={wh.id} className="px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 text-gray-700 border-gray-300 border-l border-gray-200" style={{ position: "sticky", top: 0, zIndex: 40, backgroundColor: "#EEF2FF", minWidth: STOCK_TABLE_CONFIG.WAREHOUSE_COL_WIDTH, width: STOCK_TABLE_CONFIG.WAREHOUSE_COL_WIDTH, height: '42px' }}>
                        {wh.name}
                      </th>
                    ))}
                    <th className="px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 text-white border-white/20 border-l-4 border-l-white/30" style={{ position: "sticky", right: 0, top: 0, zIndex: 50, backgroundColor: "#1A2766", minWidth: STOCK_TABLE_CONFIG.GRAND_TOTAL_COL_WIDTH, width: STOCK_TABLE_CONFIG.GRAND_TOTAL_COL_WIDTH, height: '42px' }}>
                      Grand Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row, rIdx) => {
                    const isGT = row.isGrandTotal;
                    const formatQty = (v: number, unit?: string) => unit ? `${v} ${unit}` : `${v}`;
                    
                    if (row.isGroupHeader) {
                      return (
                        <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleCategory(row.label)}>
                          <td className="pl-4 font-bold text-[13px] tracking-wider h-[40px] z-[40] text-slate-800 uppercase border-r border-slate-200 bg-slate-100/80" style={{ position: 'sticky', left: 0 }}>
                            <div className="flex items-center gap-2">
                              {row.isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                              {row.label}
                            </div>
                          </td>
                          {meaningfulWarehouses.map(col => {
                            const val = row.cells[col.id] || 0;
                            return (
                              <td key={col.id} className="px-2 py-2 text-center border-l border-gray-200 bg-slate-50/50">
                                {val === 0 ? <span className="text-gray-300 select-none">—</span> : <span className="whitespace-nowrap font-bold text-gray-800">{formatQty(val, row.unit)}</span>}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-center border-l-2 border-slate-300 bg-slate-200/50" style={{ position: 'sticky', right: 0, zIndex: 40 }}>
                            {(row.cells['GT'] || 0) === 0 ? <span className="text-gray-300 select-none">—</span> : <span className="whitespace-nowrap font-black text-[#1A2766]">{formatQty(row.cells['GT'] || 0, row.unit)}</span>}
                          </td>
                        </tr>
                      );
                    }

                    const isAlt = !row.isGrandTotal && (rIdx % 2 !== 0);

                    return (
                      <tr key={row.id} className={`border-b border-gray-100 transition-all ${isGT ? 'font-bold text-[12px] text-white' : 'hover:bg-blue-50/50'} ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`} style={isGT ? { position: "sticky", bottom: 0, zIndex: 50 } : {}}>
                        <td className={`px-4 py-2 font-medium border-r border-gray-200 transition-colors ${isGT ? 'text-[12px] font-black uppercase tracking-wider border-t-2 border-white/10' : `text-[13px] text-gray-700 pl-10 ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`}`}
                          style={isGT ? { position: 'sticky', left: 0, backgroundColor: '#1A2766', color: '#fff', zIndex: 50 } : { position: 'sticky', left: 0, zIndex: 40 }}>
                          
                          {isGT ? (
                            <span className="truncate">{row.label}</span>
                          ) : (
                            <div className="flex items-baseline gap-2 overflow-hidden">
                              <span className="font-semibold text-gray-900 truncate">{row.label}</span>
                              <span className="text-[10px] text-gray-400 font-mono shrink-0">— {row.sku}</span>
                            </div>
                          )}
                        </td>
                        {meaningfulWarehouses.map(col => {
                          const val = row.cells[col.id] || 0;
                          const cs = getHeatmapStyle(val, maxBody, false, !!isGT);
                          
                          return (
                            <td key={col.id} className={`px-2 py-2 text-center transition-all ${isGT ? 'border-t-2 border-white/10 py-3 border-l border-white/10' : 'border-l border-gray-100'}`} style={cs}>
                              {val === 0 ? <span className={isGT ? "opacity-40" : "text-gray-300 select-none"}>—</span> : <span className="whitespace-nowrap font-semibold">{formatQty(val, row.unit)}</span>}
                            </td>
                          );
                        })}
                         
                        {/* Grand Total Column */}
                        <td className={`px-2 py-2 text-center transition-all ${isGT ? 'border-t-2 border-white/10 py-3 border-l-4 border-l-white/30' : 'border-l border-gray-100'}`} style={isGT ? { position: 'sticky', right: 0, backgroundColor: '#1A2766', color: '#fff' } : { position: 'sticky', right: 0, ...getHeatmapStyle(row.cells['GT'] || 0, maxGt, true, false) }}>
                          {(row.cells['GT'] || 0) === 0 ? <span className={isGT ? "opacity-40" : "text-gray-300 select-none"}>—</span> : <span className="whitespace-nowrap font-bold">{formatQty(row.cells['GT'] || 0, row.unit)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </StockPageShell>
  );
}

import React, { ReactNode } from 'react';
import { Download, Camera, Loader2, X, Search, Box } from 'lucide-react';

export const STOCK_TABLE_CONFIG = {
  // Shared presentation widths
  WAREHOUSE_COL_WIDTH: 88,
  GRAND_TOTAL_COL_WIDTH: 96,
  // Shared PDF config
  PDF_WAREHOUSE_WIDTH: 18,
  PDF_GRAND_TOTAL_WIDTH: 22,
  PDF_FIRST_COL_MIN_WIDTH: 60,
};

// ─── Shared Heatmap Utility ──────────────────────────────────────────────────
export interface HeatmapStyleResult extends React.CSSProperties {
  pdfFillColor?: [number, number, number];
  pdfTextColor?: [number, number, number];
}

export function getSharedHeatmapStyle(

  val: number,
  maxVal: number,
  isGrandTotal: boolean = false,
  isZeroOrEmpty: boolean = false
): HeatmapStyleResult {
  if (isGrandTotal) {
    return { backgroundColor: '#1A2766', color: '#ffffff', fontWeight: 700, pdfFillColor: [26, 39, 102], pdfTextColor: [255, 255, 255] };
  }
  if (isZeroOrEmpty || val <= 0 || maxVal <= 0) {
    return { backgroundColor: '#FFFFFF', color: '#9CA3AF', pdfFillColor: [255, 255, 255], pdfTextColor: [156, 163, 175] };
  }
  
  const ratio = Math.min(1, Math.max(0, val / maxVal));
  
  if (ratio <= 0) {
    return { backgroundColor: '#FFFFFF', color: '#9CA3AF', pdfFillColor: [255, 255, 255], pdfTextColor: [156, 163, 175] };
  }
  if (ratio <= 0.20) {
    return { backgroundColor: '#F0FDF4', color: '#166534', fontWeight: 500, pdfFillColor: [240, 253, 244], pdfTextColor: [22, 101, 52] }; // Very Light Green
  }
  if (ratio <= 0.40) {
    return { backgroundColor: '#BBF7D0', color: '#166534', fontWeight: 500, pdfFillColor: [187, 247, 208], pdfTextColor: [22, 101, 52] }; // Light Green
  }
  if (ratio <= 0.60) {
    return { backgroundColor: '#22C55E', color: '#FFFFFF', fontWeight: 600, pdfFillColor: [34, 197, 94], pdfTextColor: [255, 255, 255] }; // Green
  }
  if (ratio <= 0.75) {
    return { backgroundColor: '#FDE68A', color: '#92400E', fontWeight: 600, pdfFillColor: [253, 230, 138], pdfTextColor: [146, 64, 14] }; // Yellow
  }
  if (ratio <= 0.90) {
    return { backgroundColor: '#FDBA74', color: '#9A3412', fontWeight: 600, pdfFillColor: [253, 186, 116], pdfTextColor: [154, 52, 18] }; // Orange
  }
  
  return { backgroundColor: '#EF4444', color: '#FFFFFF', fontWeight: 700, pdfFillColor: [239, 68, 68], pdfTextColor: [255, 255, 255] }; // Red
}

export function StockPageShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-64px)] gap-5 bg-[#F8F9FB] p-5 pt-0">
      <div className="h-full pt-5">{sidebar}</div>
      <div className="flex-1 flex flex-col h-full mt-5 min-w-0 bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function StockHeader({ 
  icon: Icon, 
  title, 
  subtitle, 
  itemCount, 
  date, 
  onExportRaw, 
  onScreenshot,
  isExporting = false,
  isScreenshotting = false
}: { 
  icon: React.ElementType; 
  title: string; 
  subtitle: string; 
  itemCount?: number;
  date?: string; 
  onExportRaw?: () => void;
  onScreenshot?: () => void;
  isExporting?: boolean;
  isScreenshotting?: boolean;
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0 rounded-t-[12px]">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-[10px] bg-[#1A2766]/5 flex items-center justify-center border border-[#1A2766]/10 shadow-sm">
          <Icon size={20} className="text-[#1A2766]" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-[17px] font-bold tracking-tight text-slate-900 leading-none mb-1.5 flex items-center gap-2">
            {title}
            {itemCount !== undefined && (
              <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600 text-[11px] font-bold tracking-wide border border-slate-200">
                {itemCount} SKUs
              </span>
            )}
          </h1>
          <div className="text-[12px] text-slate-500 font-medium leading-none">{subtitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {date && (
          <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
            {date}
          </div>
        )}
        <div className="h-6 w-px bg-slate-200 mx-1"></div>
        <div className="flex items-center gap-2">
          {onScreenshot && (
            <button onClick={onScreenshot} disabled={isScreenshotting} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-slate-700 text-[12px] font-bold rounded-md shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 h-8">
              {isScreenshotting ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <Camera size={14} className="text-slate-500" />}
              {isScreenshotting ? 'Capturing...' : 'Screenshot'}
            </button>
          )}
          {onExportRaw && (
            <button onClick={onExportRaw} disabled={isExporting} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#10b981] text-white text-[12px] font-bold rounded-md shadow-[0_1px_2px_rgba(16,185,129,0.2)] border border-transparent hover:bg-[#059669] transition-colors disabled:opacity-50 h-8">
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Raw Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StockFilterBar({ 
  searchQuery, 
  onSearchChange, 
  searchPlaceholder = "Search...",
  children 
}: { 
  searchQuery: string; 
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-3 flex-wrap shrink-0 relative z-[100] shadow-sm">
      <div className="relative min-w-[240px] max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder={searchPlaceholder} 
          value={searchQuery} 
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 text-[13px] font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1A2766] focus:border-[#1A2766] focus:bg-white transition-all h-8 placeholder:font-normal placeholder:text-slate-400" 
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="h-5 w-px bg-slate-200 mx-1"></div>
      {children}
    </div>
  );
}

export function StockEmptyState({ title, message, icon: Icon = Box }: { title: string; message: string; icon?: React.ElementType }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-50/50">
      <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
        <Icon size={28} className="text-slate-300" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h3 className="text-[16px] font-bold text-slate-700">{title}</h3>
        <p className="text-[13px] text-slate-500 font-medium mt-1">{message}</p>
      </div>
    </div>
  );
}

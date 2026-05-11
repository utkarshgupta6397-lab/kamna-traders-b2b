'use client';

import { StyledLine } from '@/lib/print/slip-renderer';

interface Props {
  lines: StyledLine[];
}

/**
 * A character-perfect preview of a thermal slip.
 * Calibrated for 80mm paper with safe buffer (approx 46 chars wide).
 */
export default function ThermalSlip({ lines }: Props) {
  return (
    <div 
      className="bg-white p-8 shadow-2xl border border-gray-200 inline-block font-mono text-[12px] leading-[1.15] text-black select-none ring-1 ring-black/5" 
      style={{ 
        width: '46ch', 
        boxSizing: 'content-box',
        minHeight: '120mm' 
      }}
    >
      <div className="flex flex-col">
        {lines.map((line, idx) => {
          const alignmentClass = 
            line.align === 'center' ? 'text-center' : 
            line.align === 'right' ? 'text-right' : 'text-left';
          
          const sizeClass = 
            line.size === 'double-width' ? 'text-lg tracking-tight scale-x-125 origin-center' :
            line.size === 'quad' ? 'text-2xl font-black' : 'text-[12px]';

          return (
            <div 
              key={idx} 
              className={`${alignmentClass} ${sizeClass} ${line.bold ? 'font-bold' : 'font-medium'} whitespace-pre min-h-[1.15em] overflow-hidden`}
            >
              {line.text || '\u00A0'}
            </div>
          );
        })}
      </div>
      
      {/* Visual indicator of a cut */}
      <div className="mt-8 border-t-2 border-dashed border-gray-200 relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-[10px] text-gray-300 uppercase tracking-widest">
          Hardware Cut
        </div>
      </div>
    </div>
  );
}

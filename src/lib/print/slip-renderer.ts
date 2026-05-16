import { EscPosRenderer } from './esc-pos-renderer';

export type PrintItem = {
  skuId: string;
  name: string;
  qty: number;
  unit: string;
  zone: string;
};

export type PrintPayload = {
  id: string;
  dispatchSlipNumber: string;
  customerName: string;
  notes: string | null;
  createdAt: string;
  warehouseName: string;
  printZonalSlips?: boolean;
  staffName: string;
  items: PrintItem[];
  zoneGroups: Record<string, PrintItem[]>;
  qrPayload: string;
  // Zoho Status & Sync Details
  zohoSyncStatus?: string | null;
  zohoSyncStep?: string | null;
  zohoSyncError?: string | null;
  zohoSalesorderId?: string | null;
  zohoSalesorderNumber?: string | null;
  zohoPayload?: any;
  zohoResponse?: any;
  zohoResponseTimeMs?: number | null;
  zohoExecutionTrace?: any;
  booksUrl?: string | null;
};

export type StyledLine = {
  text: string;
  bold?: boolean;
  size?: 'normal' | 'double-width' | 'quad';
  align?: 'left' | 'center' | 'right';
  type?: 'text' | 'qr';
};

/**
 * Shared logic to wrap text into multiple lines while preserving alignment.
 * TREATS UOM AND SKU BRACKETS AS ATOMIC TOKENS.
 */
function wrapText(text: string, width: number): string[] {
  if (!text) return [];
  
  // 1. Identify and protect atomic tokens (e.g. "200 mtr", "[SPA15]")
  // We temporarily replace spaces within these tokens with a non-space character
  let processed = text;
  
  // Protect "Number + Unit" (e.g. 200 mtr, 5 nos, 1.5 kg)
  processed = processed.replace(/(\d+(?:\.\d+)?)\s+([a-zA-Z]{1,5})(?![a-zA-Z])/g, '$1\u00A0$2');
  
  // Protect SKU brackets (e.g. [SPA15])
  processed = processed.replace(/\[([^\]\s]+)\]/g, (match) => match.replace(/\s+/g, '\u00A0'));

  const lines: string[] = [];
  let currentLine = '';
  // Split by actual spaces, keeping our protected tokens intact
  const words = processed.split(' ');

  for (const word of words) {
    // Length check must account for the fact that \u00A0 counts as 1 char
    const cleanWord = word.replace(/\u00A0/g, ' ');
    const potentialLine = currentLine ? `${currentLine} ${cleanWord}` : cleanWord;

    if (potentialLine.length <= width) {
      currentLine = potentialLine;
    } else {
      if (currentLine) lines.push(currentLine);
      
      // If a single word is longer than width, we must force wrap it
      if (cleanWord.length > width) {
        let temp = cleanWord;
        while (temp.length > width) {
          lines.push(temp.substring(0, width));
          temp = temp.substring(width);
        }
        currentLine = temp;
      } else {
        currentLine = cleanWord;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Generates the unified Dispatch Slip (Master or Duplicate).
 */
export function generateDispatchSlip(payload: PrintPayload, isDuplicate: boolean): StyledLine[] {
  const lines: StyledLine[] = [];
  const width = 46; // 4-inch / 80mm standard width
  
  const dateStr = new Date(payload.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const dispatchSeq = payload.dispatchSlipNumber || payload.id;

  // 1. TOP TITLE (Customer Name)
  // Ensure we truncate gracefully if it's too long for quad size (which is very wide)
  const custName = payload.customerName.toUpperCase();
  // Using double-width or quad for very large font as requested
  lines.push({ text: custName.substring(0, 22), size: 'double-width', bold: true, align: 'center' });
  if (custName.length > 22) {
    lines.push({ text: custName.substring(22, 44), size: 'double-width', bold: true, align: 'center' });
  }
  lines.push({ text: '' });

  // 2. COPY DECLARATION
  const slipType = isDuplicate ? 'DUPLICATE' : 'MASTER';
  lines.push({ text: `---------- ${slipType} DISPATCH SLIP ----------`, align: 'center' });
  lines.push({ text: '' });

  // 3. DETAILS SECTION
  lines.push({ text: `DATE   : ${dateStr}` });
  lines.push({ text: `WH     : ${payload.warehouseName}` });
  lines.push({ text: `STAFF  : ${payload.staffName}` });
  
  if (payload.zohoSalesorderNumber) {
    lines.push({ text: `SO     : ${payload.zohoSalesorderNumber}` });
  } else if (payload.zohoSyncStatus === 'FAILED') {
    lines.push({ text: `SO     : SYNC FAILED` });
  } else {
    lines.push({ text: `SO     : PENDING SYNC` });
  }

  if (payload.notes) {
    lines.push({ text: `NOTES  : ${payload.notes}` });
  }
  
  lines.push({ text: '' });

  // 4. VEHICLE NUMBER AREA
  lines.push({ text: `VEHICLE NO. : ________________________` });
  lines.push({ text: '' });

  // 5. PRODUCT TABLE FORMAT
  // Header
  // # SKU_ID                     QTY & UOM
  const COL_INDEX = 4;
  const COL_SKU = 15;
  const COL_QTY = width - COL_INDEX - COL_SKU; // 27
  
  lines.push({ text: '#   SKU_ID'.padEnd(COL_INDEX + COL_SKU) + 'QTY & UOM'.padStart(COL_QTY), bold: true });
  lines.push({ text: '-'.repeat(width) });

  let totalItems = 0;
  
  Object.entries(payload.zoneGroups).forEach(([zone, items], zoneIdx) => {
    // ZONE SEPARATOR
    if (zoneIdx > 0) lines.push({ text: '' });
    lines.push({ text: `---- zone: ${zone.toLowerCase()} ----`, align: 'center' });

    lines.push({ text: '' });

    items.forEach((item, itemIdx) => {
      totalItems++;
      const indexStr = `${totalItems}`.padEnd(COL_INDEX);
      const skuStr = `[${item.skuId}]`.padEnd(COL_SKU);
      const qtyStr = `${item.qty} ${item.unit}`.padStart(COL_QTY);
      
      // LINE 1: # SKU_ID QTY & UOM
      lines.push({ text: `${indexStr}${skuStr}${qtyStr}`, bold: true });
      
      // LINE 2: Full Product Name
      const nameLines = wrapText(item.name.toUpperCase(), width);
      nameLines.forEach(nl => lines.push({ text: nl }));
      
      // Dotted Separator between products
      lines.push({ text: '.'.repeat(width) });
    });
  });

  // 6. BLANK SPACE REQUIREMENT (for 2 extra products)
  lines.push({ text: '' });
  lines.push({ text: '.'.repeat(width) });
  lines.push({ text: '' });
  lines.push({ text: '.'.repeat(width) });
  lines.push({ text: '' });
  lines.push({ text: '.'.repeat(width) });

  // 7. FOOTER
  lines.push({ text: '' });
  lines.push({ text: 'SLIP NO.', align: 'center', bold: true });
  lines.push({ text: dispatchSeq, size: 'double-width', align: 'center', bold: true });
  lines.push({ text: '' });

  // 8. DUPLICATE COPY FOOTER
  if (isDuplicate) {
    lines.push({ text: 'THIS IS A DUPLICATE COPY OF', align: 'center' });
    lines.push({ text: `SLIP NO. ${dispatchSeq}`, align: 'center', bold: true });
    lines.push({ text: '' });
  }

  return lines;
}

/**
 * High-level renderer for Kamna Traders dispatch slips.
 * Converts a PrintPayload into a single ESC/POS command stream.
 */
export function renderDispatchSlips(payload: PrintPayload): Uint8Array {
  const renderer = new EscPosRenderer();

  const renderVirtualSlip = (lines: StyledLine[]) => {
    lines.forEach(line => {
      if (line.type === 'qr') {
        renderer.qr(line.text);
      } else {
        renderer.align(line.align || 'left');
        renderer.bold(!!line.bold);
        renderer.size(line.size || 'normal');
        renderer.line(line.text);
      }
    });
  };

  // 1. MASTER DISPATCH SLIP
  renderVirtualSlip(generateDispatchSlip(payload, false));
  renderer.cut();

  return renderer.build();
}

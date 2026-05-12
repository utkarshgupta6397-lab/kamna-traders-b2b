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
 * Generates the "Virtual Slip" (list of styled lines) for a Master Slip.
 */
export function generateMasterSlip(payload: PrintPayload): StyledLine[] {
  const lines: StyledLine[] = [];
  const width = 46; // Safe buffer to prevent right-edge overflow
  const dateStr = new Date(payload.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Extract dispatch sequence (e.g., KS-DP-...-004 -> 004)
  const dispatchSeq = payload.dispatchSlipNumber?.split('-').pop() || '000';

  // Header
  lines.push({ text: 'KAMNA TRADERS', size: 'double-width', bold: true, align: 'center' });
  lines.push({ text: 'Master Dispatch Slip', align: 'center' });
  lines.push({ text: '='.repeat(width) });

  // Info Section
  lines.push({ text: `SLIP # : ${payload.dispatchSlipNumber || payload.id}`, bold: true });
  lines.push({ text: `DATE   : ${dateStr}` });
  lines.push({ text: `CUST   : ${payload.customerName.toUpperCase()}` });
  lines.push({ text: `WH     : ${payload.warehouseName}` });
  lines.push({ text: `STAFF  : ${payload.staffName}` });
  
  // ZOHO SO LINKAGE (ONLY ON MASTER) - REMOVED "Zoho SO:" LABEL
  if (payload.zohoSalesorderNumber) {
    lines.push({ text: payload.zohoSalesorderNumber, bold: true });
  } else if (payload.zohoSyncStatus === 'FAILED') {
    lines.push({ text: 'SYNC FAILED', bold: true });
  } else {
    lines.push({ text: 'PENDING SYNC', bold: true });
  }

  if (payload.notes) {
    lines.push({ text: `NOTES  : ${payload.notes}` });
  }
  lines.push({ text: '-'.repeat(width) });

  // Items Table: # | ITEM [SKU] | QTY
  // CALIBRATION: Standard 80mm paper is ~48 chars. 
  // We use 48 as our base and ensure columns fit perfectly.
  const COL_INDEX = 4;
  const COL_QTY = 12;
  const COL_NAME = width - COL_INDEX - COL_QTY - 1; // 48 - 4 - 12 - 1 = 31

  lines.push({ text: '#   ITEM [SKU]'.padEnd(COL_INDEX + COL_NAME) + ' '.repeat(1) + 'QTY/UOM'.padStart(COL_QTY), bold: true });
  lines.push({ text: '-'.repeat(width) });

  const ITEM_INDENT = '    '; // 4 spaces for consistent hanging indent

  let totalItems = 0;
  Object.entries(payload.zoneGroups).forEach(([zone, items]) => {
    lines.push({ text: `[ ZONE: ${zone.toUpperCase()} ]`, bold: true });
    lines.push({ text: '' }); // Spacing after zone header
    
    items.forEach((item) => {
      totalItems++;
      const indexStr = `${totalItems}`.padEnd(4); // e.g. "1   "
      const qtyStr = `${item.qty} ${item.unit}`.padStart(12);
      
      // Inline SKU: "Item Name [SKU]"
      const fullName = `${item.name} [${item.skuId}]`;
      
      // Name width: width - 4 (index) - 12 (qty) - 1 (spacer)
      const nameLines = wrapText(fullName, COL_NAME);

      nameLines.forEach((nameLine, lineIdx) => {
        if (lineIdx === 0) {
          // First line includes index and qty
          lines.push({ text: `${indexStr}${nameLine.padEnd(COL_NAME)} ${qtyStr}` });
        } else {
          // Subsequent lines use the fixed indentation to align with name start
          lines.push({ text: `${ITEM_INDENT}${nameLine}` });
        }
      });
    });
    lines.push({ text: '' });
  });

  lines.push({ text: '-'.repeat(width) });

  // REDIRECT QR (ONLY ON MASTER)
  if (payload.qrPayload) {
    lines.push({ text: 'Scan for Sales Order / Tracking', align: 'center' });
    lines.push({ text: payload.qrPayload, type: 'qr', align: 'center' });
    lines.push({ text: '' });
  }

  lines.push({ text: `-- End of Master Slip : ${dispatchSeq} --`, align: 'center', bold: true });

  return lines;
}

/**
 * Generates the "Virtual Slip" for a Zone Slip.
 */
export function generateZoneSlip(zone: string, items: PrintItem[], payload: PrintPayload): StyledLine[] {
  const lines: StyledLine[] = [];
  const width = 46;
  const dateStr = new Date(payload.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const dispatchSeq = payload.dispatchSlipNumber?.split('-').pop() || '000';
  const ITEM_INDENT = '    ';

  lines.push({ text: `ZONE SLIP: ${zone.toUpperCase()}`, size: 'double-width', bold: true, align: 'center' });
  lines.push({ text: `REF: ${payload.dispatchSlipNumber || payload.id}`, align: 'center', bold: true });
  lines.push({ text: '='.repeat(width) });

  lines.push({ text: `DATE : ${dateStr}` });
  lines.push({ text: `WH   : ${payload.warehouseName}` });
  lines.push({ text: `CUST : ${payload.customerName.toUpperCase()}` });
  lines.push({ text: '-'.repeat(width) });

  // Zone slip: NO SKU column, just ITEM and QTY
  const COL_INDEX = 4;
  const COL_QTY = 12;
  const COL_NAME = width - COL_INDEX - COL_QTY - 1;

  lines.push({ text: '#   ITEM'.padEnd(COL_INDEX + COL_NAME) + ' '.repeat(1) + 'QTY/UOM'.padStart(COL_QTY), bold: true });
  lines.push({ text: '-'.repeat(width) });

  items.forEach((item, idx) => {
    const indexStr = `${idx + 1}`.padEnd(COL_INDEX);
    const qtyStr = `${item.qty} ${item.unit}`.padStart(COL_QTY);
    
    const nameLines = wrapText(item.name, COL_NAME);

    nameLines.forEach((nameLine, lineIdx) => {
      if (lineIdx === 0) {
        lines.push({ text: `${indexStr}${nameLine.padEnd(COL_NAME)} ${qtyStr}`, bold: true });
      } else {
        lines.push({ text: `${ITEM_INDENT}${nameLine}`, bold: true });
      }
    });
  });

  lines.push({ text: '' }); // Spacing before footer
  lines.push({ text: '-'.repeat(width) });
  lines.push({ text: `-- End of Zone Slip : ${dispatchSeq} --`, align: 'center', bold: true });

  return lines;
}

/**
 * High-level renderer for Kamna Traders dispatch slips.
 * Converts a PrintPayload into a single ESC/POS command stream using the shared formatters.
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

  // 1. Master Slip
  renderVirtualSlip(generateMasterSlip(payload));
  renderer.cut();

  // 2. Zone Slips
  Object.entries(payload.zoneGroups).forEach(([zone, items]) => {
    renderVirtualSlip(generateZoneSlip(zone, items, payload));
    renderer.cut();
  });

  return renderer.build();
}

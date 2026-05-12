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
 */
function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  const words = text.split(' ');

  for (const word of words) {
    if ((currentLine + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      while (currentLine.length > width) {
        lines.push(currentLine.substring(0, width));
        currentLine = currentLine.substring(width);
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
  lines.push({ text: '#   ITEM [SKU]'.padEnd(width - 12) + 'QTY/UOM'.padStart(12), bold: true });
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
      
      // Name width: width - 4 (index) - 12 (qty) = 30 chars
      const nameWidth = width - 16;
      const nameLines = wrapText(fullName, nameWidth);

      nameLines.forEach((nameLine, lineIdx) => {
        if (lineIdx === 0) {
          // First line includes index and qty
          lines.push({ text: `${indexStr}${nameLine.padEnd(nameWidth)} ${qtyStr}` });
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
  lines.push({ text: '#   ITEM'.padEnd(width - 12) + 'QTY/UOM'.padStart(12), bold: true });
  lines.push({ text: '-'.repeat(width) });

  items.forEach((item, idx) => {
    const indexStr = `${idx + 1}`.padEnd(4);
    const qtyStr = `${item.qty} ${item.unit}`.padStart(12);
    
    const nameWidth = width - 16;
    const nameLines = wrapText(item.name, nameWidth);

    nameLines.forEach((nameLine, lineIdx) => {
      if (lineIdx === 0) {
        lines.push({ text: `${indexStr}${nameLine.padEnd(nameWidth)} ${qtyStr}`, bold: true });
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

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
        renderer.align('center');
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

export type TransferPrintPayload = {
  transferNumber: string;
  sourceWarehouseName: string;
  destinationWarehouseName: string;
  responsiblePerson: string;
  remarks: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  staffName: string;
  dispatchedByName?: string | null;
  items: {
    skuId: string;
    name: string;
    requestedQty: number;
    dispatchedQty: number;
    unit: string;
  }[];
};

export function generateTransferSlip(payload: TransferPrintPayload): StyledLine[] {
  const lines: StyledLine[] = [];
  const width = 46;

  const dateStr = new Date(payload.dispatchedAt || payload.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  });

  // 1. TOP TITLE
  lines.push({ text: 'KAMNA TRADERS', size: 'double-width', bold: true, align: 'center' });
  lines.push({ text: 'STOCK TRANSFER', bold: true, align: 'center' });
  lines.push({ text: '' });

  // 2. DETAILS
  lines.push({ text: `TR NO     : ${payload.transferNumber}`, bold: true });
  lines.push({ text: `FROM      : ${payload.sourceWarehouseName}` });
  lines.push({ text: `TO        : ${payload.destinationWarehouseName}` });
  lines.push({ text: `RESP      : ${payload.responsiblePerson.toUpperCase()}` });
  lines.push({ text: `DATE      : ${dateStr}` });
  lines.push({ text: `BY        : ${payload.dispatchedByName || payload.staffName}` });
  if (payload.remarks) {
    lines.push({ text: `REMARKS   : ${payload.remarks}` });
  }
  lines.push({ text: '' });

  // 3. PRODUCT TABLE
  const colIndexSku = `#  SKU_ID`;
  const colQty = `QTY`;
  const headerText = colIndexSku.padEnd(width - colQty.length) + colQty;
  
  lines.push({ text: headerText, bold: true });
  lines.push({ text: '.'.repeat(width) });

  payload.items.forEach((item, index) => {
    if (index > 0) {
      lines.push({ text: '.'.repeat(width) });
    }

    const indexStr = `${index + 1}`.padEnd(3); // e.g. "1  "
    const skuStr = `[${item.skuId}]`;
    const prefixStr = `${indexStr}${skuStr}`;

    const unitLower = item.unit ? item.unit.trim().toLowerCase() : '';
    const showUnit = unitLower && unitLower !== 'unit' && unitLower !== 'none';
    const formattedQty = showUnit 
      ? `${item.dispatchedQty} ${unitLower}` 
      : `${item.dispatchedQty}`;

    const itemRow = prefixStr.padEnd(width - formattedQty.length) + formattedQty;
    lines.push({ text: itemRow, bold: true });

    // Truncate name to 43 characters and indent by 3 spaces
    const cleanName = item.name.toUpperCase().substring(0, 43);
    lines.push({ text: `   ${cleanName}` });
  });

  // 4. FOOTER STATS
  const totalItemsCount = payload.items.length;
  const totalDispQty = payload.items.reduce((sum, item) => sum + item.dispatchedQty, 0);

  lines.push({ text: '' });
  lines.push({ text: '.'.repeat(width) });
  lines.push({ text: `TOTAL ITEMS : ${totalItemsCount}`, bold: true });
  lines.push({ text: `TOTAL QTY   : ${totalDispQty}`, bold: true });

  return lines;
}

export function renderTransferSlips(payload: TransferPrintPayload): Uint8Array {
  const renderer = new EscPosRenderer();

  const lines = generateTransferSlip(payload);
  lines.forEach(line => {
    renderer.align(line.align || 'left');
    renderer.bold(!!line.bold);
    renderer.size(line.size || 'normal');
    renderer.line(line.text);
  });
  renderer.cut();

  return renderer.build();
}

export type TransferReceivePrintPayload = {
  transferNumber: string;
  sourceWarehouseName: string;
  destinationWarehouseName: string;
  responsiblePerson: string;
  remarks: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  staffName: string;
  receivedByName?: string | null;
  items: {
    skuId: string;
    name: string;
    dispatchedQty: number;
    receivedQty: number;
    shortQty: number;
    unit: string;
  }[];
};

export function generateTransferReceiveSlip(payload: TransferReceivePrintPayload): StyledLine[] {
  const lines: StyledLine[] = [];
  const width = 46;

  const dateStr = new Date(payload.receivedAt || new Date()).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  });

  // 1. TOP TITLE
  lines.push({ text: 'KAMNA TRADERS', size: 'double-width', bold: true, align: 'center' });
  lines.push({ text: 'STOCK RECEIPT', bold: true, align: 'center' });
  lines.push({ text: '' });

  // 2. DETAILS
  lines.push({ text: `TR NO     : ${payload.transferNumber}`, bold: true });
  lines.push({ text: `FROM      : ${payload.sourceWarehouseName}` });
  lines.push({ text: `TO        : ${payload.destinationWarehouseName}` });
  lines.push({ text: `RESP      : ${payload.responsiblePerson.toUpperCase()}` });
  lines.push({ text: `DATE      : ${dateStr}` });
  lines.push({ text: `BY        : ${payload.receivedByName || payload.staffName}` });
  if (payload.remarks) {
    lines.push({ text: `REMARKS   : ${payload.remarks}` });
  }
  lines.push({ text: '' });

  // 3. PRODUCT TABLE
  const colIndexSku = `#  SKU_ID`;
  const colQty = `REC / DISP`;
  const headerText = colIndexSku.padEnd(width - colQty.length) + colQty;
  
  lines.push({ text: headerText, bold: true });
  lines.push({ text: '.'.repeat(width) });

  payload.items.forEach((item, index) => {
    if (index > 0) {
      lines.push({ text: '.'.repeat(width) });
    }

    const indexStr = `${index + 1}`.padEnd(3); // e.g. "1  "
    const skuStr = `[${item.skuId}]`;
    const prefixStr = `${indexStr}${skuStr}`;

    const formattedQty = `${item.receivedQty} / ${item.dispatchedQty}`;
    const itemRow = prefixStr.padEnd(width - formattedQty.length) + formattedQty;
    lines.push({ text: itemRow, bold: true });

    // Truncate name to 43 characters and indent by 3 spaces
    const cleanName = item.name.toUpperCase().substring(0, 43);
    lines.push({ text: `   ${cleanName}` });

    const pending = item.dispatchedQty - item.receivedQty - item.shortQty;
    const unit = item.unit || 'PCS';
    lines.push({ text: `   SHORT: ${item.shortQty} ${unit} | PENDING: ${pending} ${unit}` });
  });

  // 4. FOOTER STATS
  const totalItemsCount = payload.items.length;
  const totalRecQty = payload.items.reduce((sum, item) => sum + item.receivedQty, 0);
  const totalShortQty = payload.items.reduce((sum, item) => sum + item.shortQty, 0);

  lines.push({ text: '' });
  lines.push({ text: '.'.repeat(width) });
  lines.push({ text: `TOTAL ITEMS : ${totalItemsCount}`, bold: true });
  lines.push({ text: `TOTAL REC   : ${totalRecQty}`, bold: true });
  lines.push({ text: `TOTAL SHORT : ${totalShortQty}`, bold: true });

  return lines;
}

export function renderTransferReceiveSlips(payload: TransferReceivePrintPayload): Uint8Array {
  const renderer = new EscPosRenderer();

  const lines = generateTransferReceiveSlip(payload);
  lines.forEach(line => {
    renderer.align(line.align || 'left');
    renderer.bold(!!line.bold);
    renderer.size(line.size || 'normal');
    renderer.line(line.text);
  });
  renderer.cut();

  return renderer.build();
}

// ============================================================================
// CUSTOMER STATEMENT SLIP
// ============================================================================

export type StatementPrintPayload = {
  customerName: string;
  mobile: string;
  gst: string;
  openingBalance: number;
  closingBalance: number;
  totalInvoices: number;
  totalPayments: number;
  totalBills: number;
  transactions: {
    date: string;
    type: string;
    description: string;
    amount: number;
    balance: number;
  }[];
};

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(amount);
}

export function generateStatementSlip(payload: StatementPrintPayload): StyledLine[] {
  const lines: StyledLine[] = [];
  const width = 46;

  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const timeStr = new Date().toLocaleString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
  });

  // Dynamic Transaction Window Logic
  // Look back up to 10 transactions. Stop earlier if we find a settled point (abs(balance) <= 100).
  const maxItems = 10;
  const minItems = 5;
  const maxBackIndex = Math.max(0, payload.transactions.length - maxItems);
  let startIndex = maxBackIndex;
  
  for (let i = payload.transactions.length - 1; i >= maxBackIndex; i--) {
    if (Math.abs(payload.transactions[i].balance) <= 100) {
      startIndex = i;
      break;
    }
  }

  // Enforce minimum 5 transactions (or total available if less than 5)
  const minBackIndex = Math.max(0, payload.transactions.length - minItems);
  if (startIndex > minBackIndex) {
    startIndex = minBackIndex;
  }

  const displayTx = payload.transactions.slice(startIndex);
  const tableOpeningBalance = startIndex > 0 ? payload.transactions[startIndex - 1].balance : payload.openingBalance;

  // 1. TOP TITLE
  lines.push({ text: 'KAMNA TRADERS', size: 'double-width', bold: true, align: 'center' });
  lines.push({ text: 'CUSTOMER STATEMENT', bold: true, align: 'center' });
  lines.push({ text: '' });

  // 2. DETAILS
  lines.push({ text: `NAME : ${payload.customerName.toUpperCase().substring(0, 38)}` });
  lines.push({ text: `MOB  : ${payload.mobile || 'N/A'}` });
  lines.push({ text: `GST  : ${payload.gst || 'N/A'}` });
  lines.push({ text: `DATE : ${dateStr}         TIME: ${timeStr}` });
  lines.push({ text: '' });

  // 3. STATEMENT PERIOD BOX
  lines.push({ text: '-'.repeat(width) });
  if (displayTx.length > 0) {
    const dStart = new Date(displayTx[0].date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const dEnd = new Date(displayTx[displayTx.length - 1].date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    lines.push({ text: 'STATEMENT PERIOD', bold: true, align: 'center' });
    lines.push({ text: `${dStart} TO ${dEnd}`, align: 'center' });
  } else {
    lines.push({ text: 'STATEMENT PERIOD', bold: true, align: 'center' });
    lines.push({ text: `AS OF ${dateStr}`, align: 'center' });
  }
  lines.push({ text: '-'.repeat(width) });
  lines.push({ text: '' });

  // 4. PRODUCT TABLE (COLUMNAR LAYOUT)
  // Columns: DATE(6) + " " + DETAILS(18) + " " + AMT(9) + " " + BAL(10) = 46
  lines.push({ text: 'DATE   DETAILS               AMOUNT    BALANCE', bold: true });
  lines.push({ text: '-'.repeat(width) });

  // Opening Balance Row
  lines.push({ 
    text: `--     OPENING BAL.     -- ${formatINR(tableOpeningBalance).padStart(14)}` 
  });
  lines.push({ text: '' }); // Spacing between rows

  displayTx.forEach(t => {
    const d = new Date(t.date);
    const dateFormatted = `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('en-IN', { month: 'short' })}`; // "20-May"
    
    // Convert descriptions
    let typeShort = t.type === 'invoice' ? 'INV' : t.type === 'payment' ? 'PMT' : t.type === 'bill' ? 'BILL' : 'V.PMT';

    // Sign logic
    const isIncrease = t.type === 'invoice' || t.type === 'bill';
    const signChar = isIncrease ? '+' : '-';
    
    // Explicit signed amount
    const signedAmtStr = (signChar + formatINR(Math.abs(t.amount))).padStart(10);
    const balStr = formatINR(t.balance).padStart(10);
    
    // Line 1: DATE + TYPE + AMT + BAL
    // DATE(6) + " " + TYPE(17) + " " + AMT(10) + " " + BAL(10) = 46
    const l1Type = typeShort.padEnd(17);
    lines.push({ text: `${dateFormatted} ${l1Type} ${signedAmtStr} ${balStr}` });
    
    // Line 2: Details
    const cleanDesc = t.description.replace('✅', '').trim();
    // Do not repeat type prefixes, just use the cleaned description
    const fullDesc = cleanDesc;
    
    // 9 spaces padding: 46 - 9 = 37 char width for wrapped text
    const descWrapped = wrapText(fullDesc, 37);
    for (let i = 0; i < descWrapped.length; i++) {
      lines.push({ text: `         ${descWrapped[i]}` });
    }
    
    lines.push({ text: '' }); // Section divider between transactions
  });

  if (payload.transactions.length > maxItems) {
    lines.push({ text: '(Showing latest relevant transactions)', align: 'center' });
  }
  
  lines.push({ text: '-'.repeat(width) });
  lines.push({ text: '' });

  // 5. SUMMARY SECTION (Right Aligned Values)
  lines.push({ text: 'STATEMENT SUMMARY', bold: true, align: 'center' });
  lines.push({ text: '' });
  
  const printStat = (label: string, amt: number) => {
    lines.push({ text: `${label.padEnd(25)} ${formatINR(amt).padStart(20)}` });
  };

  // Calculate visible summary values from displayed subset
  const visibleInvoices = displayTx.filter(t => t.type === 'invoice').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const visiblePayments = displayTx.filter(t => t.type === 'payment' || t.type === 'vendor_payment').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const visibleBills = displayTx.filter(t => t.type === 'bill').reduce((sum, t) => sum + Math.abs(t.amount), 0);

  printStat('OPENING BALANCE', tableOpeningBalance);
  printStat('TOTAL INVOICES', visibleInvoices);
  printStat('TOTAL PAYMENTS', visiblePayments);
  printStat('TOTAL BILLS', visibleBills);
  
  lines.push({ text: '-'.repeat(width) });
  lines.push({ text: '' });

  // 6. FINAL STATUS & CLOSING BALANCE LOGIC
  const bal = payload.closingBalance;
  
  if (Math.abs(bal) <= 100) {
    // Settled
    lines.push({ text: 'ACCOUNT SETTLED', size: 'double-width', bold: true, align: 'center' });
  } else if (bal > 100) {
    // Receivable
    lines.push({ text: 'AMOUNT DUE', size: 'double-width', bold: true, align: 'center' });
    lines.push({ text: `Rs. ${formatINR(bal)}`, size: 'double-width', bold: true, align: 'center' });
    lines.push({ text: '' });
    lines.push({ text: '-'.repeat(width) });
    lines.push({ text: '' });
    lines.push({ text: 'PAYMENT DUE - SCAN TO PAY', bold: true, align: 'center' });
    
    if (bal < 99999) {
      lines.push({ text: `upi://pay?pa=ibkPOS.EP208232@icici&pn=Kamna Traders&am=${bal}&cu=INR&tn=Kamna Traders Statement Payment`, type: 'qr' });
      lines.push({ text: 'Scan to pay instantly', align: 'center' });
    } else {
      // Omit amount parameter for large dues to prevent UPI limit failures
      lines.push({ text: `upi://pay?pa=ibkPOS.EP208232@icici&pn=Kamna Traders&cu=INR&tn=Kamna Traders Statement Payment`, type: 'qr' });
      lines.push({ text: 'Enter payment amount manually after scanning', align: 'center' });
    }
    
    lines.push({ text: 'UPI ID: ibkPOS.EP208232@icici', align: 'center', bold: true });
  } else {
    // Payable (Customer Credit)
    lines.push({ text: 'CUSTOMER CREDIT', size: 'double-width', bold: true, align: 'center' });
    lines.push({ text: `Rs. ${formatINR(Math.abs(bal))} CR`, size: 'double-width', bold: true, align: 'center' });
  }

  lines.push({ text: '' });
  lines.push({ text: '-'.repeat(width) });
  lines.push({ text: 'This is a computer generated statement', align: 'center' });
  lines.push({ text: 'Thank you for your business', align: 'center' });
  lines.push({ text: '' });
  
  return lines;
}

export function renderStatementSlip(payload: StatementPrintPayload): Uint8Array {
  const renderer = new EscPosRenderer();
  const lines = generateStatementSlip(payload);
  lines.forEach(line => {
    if (line.type === 'qr') {
      renderer.align('center');
      renderer.qr(line.text, 6);
    } else {
      renderer.align(line.align || 'left');
      renderer.bold(!!line.bold);
      renderer.size(line.size || 'normal');
      renderer.line(line.text);
    }
  });
  renderer.cut();
  return renderer.build();
}

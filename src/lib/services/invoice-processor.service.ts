import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db';

export interface ProcessingResult {
  success: boolean;
  base64Output?: string;
  fileName?: string;
  stats?: {
    invoicesProcessed: number;
    rowsProcessed: number;
    invoiceMonth: string;
    processingTimeMs: number;
  };
  errors?: Array<{
    row: number;
    error: string;
  }>;
}

function parseExcelDate(value: any): { formattedDate: string; monthName: string; dateObj: Date } | null {
  if (typeof value === 'number') {
    // Excel serial number
    const d = new Date(Date.UTC(1899, 11, 30));
    d.setUTCDate(d.getUTCDate() + value);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    return {
      formattedDate: `${year}-${month}-${day}`,
      monthName: months[d.getUTCMonth()],
      dateObj: d
    };
  } else if (typeof value === 'string') {
    // Assume DD/MM/YYYY
    const parts = value.trim().split(/[-/]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        const year = y < 100 ? y + 2000 : y;
        const monthStr = String(m).padStart(2, '0');
        const dayStr = String(d).padStart(2, '0');
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        if (m >= 1 && m <= 12) {
          return {
            formattedDate: `${year}-${monthStr}-${dayStr}`,
            monthName: months[m - 1],
            dateObj: new Date(Date.UTC(year, m - 1, d))
          };
        }
      }
    }
  }
  return null;
}

function formatSheetDates(sheet: XLSX.WorkSheet, format = 'dd-mmm-yyyy') {
  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) continue;
    const cell = sheet[key];
    if (cell.t === 'd') {
      cell.z = format;
    }
  }
}

function mapInvoiceAuditRow(row: any) {
  let issuedDate = row['Issued Date'];
  if (issuedDate && !(issuedDate instanceof Date)) {
    const parsed = parseExcelDate(issuedDate);
    if (parsed) issuedDate = parsed.dateObj;
  }
  return {
    'Invoice Date': row['Invoice Date'],
    'Invoice ID': row['Invoice ID'] || '',
    'Invoice Number': row['Invoice Number'] || '',
    'Issued Date': issuedDate || '',
    'Invoice Status': row['Invoice Status'] || '',
    'Accounts Receivable': row['Accounts Receivable'] || '',
    'Customer ID': row['Customer ID'] || '',
    'Customer Name': row['Customer Name'] || '',
    'Customer Number': row['Customer Number'] || ''
  };
}

function mapEwayBillAuditRow(row: any) {
  const base = mapInvoiceAuditRow(row);
  return {
    ...base,
    'Total Amount (Incl. Tax)': Number(row['Total'] || row['Total (Invoice Amount Including Tax)'] || row['Invoice Total'] || row['Total Amount'] || 0),
    'Shipping Address': String(row['Shipping Address'] || '').trim()
  };
}

const REQUIRED_COLUMNS_INPUT = [
  'Invoice Date',
  'Invoice Number',
  'Customer Name',
  'GST Identification Number (GSTIN)',
  'Invoice Status',
  'Item Tax',
  'Item Total',
  'Item Tax Amount'
];

const FINAL_SHEET_COLUMNS = [
  'Invoice Date',
  'Invoice Number',
  'Customer Name',
  'GST Identification Number (GSTIN)',
  'GST18 (Subtotal)',
  'GST5 (Subtotal)',
  'IGST18 (Subtotal)',
  'IGST5 (Subtotal)',
  'GST18 (Tax)',
  'GST5 (Tax)',
  'IGST18 (Tax)',
  'IGST5 (Tax)',
  'Grand Total (Tax)'
];

export class InvoiceProcessorService {
  /**
   * Process the raw Zoho Books Invoice export
   */
  static async processFile(buffer: Buffer, originalFileName: string, userId: string): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    try {
      // 1. Read Raw Data
      const workbook = XLSX.read(buffer, { type: 'buffer', cellNF: true, cellStyles: true }); 
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return { success: false, errors: [{ row: 0, error: 'Empty workbook' }] };
      }
      
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      
      if (rawData.length === 0) {
        return { success: false, errors: [{ row: 0, error: 'No data found in the first sheet.' }] };
      }
      
      const headerRow = Object.keys(rawData[0]);

      // 2. Validate mandatory columns
      const missingColumns = REQUIRED_COLUMNS_INPUT.filter(col => !headerRow.includes(col));
      if (missingColumns.length > 0) {
        return { 
          success: false, 
          errors: [{ row: 0, error: `Missing mandatory columns: ${missingColumns.join(', ')}` }]
        };
      }

      // Fix dates in the original sheet
      let invoiceDateCol = -1;
      for (const key of Object.keys(sheet)) {
        if (key.startsWith('!')) continue;
        if (sheet[key].v === 'Invoice Date') {
          invoiceDateCol = XLSX.utils.decode_cell(key).c;
          break;
        }
      }
      if (invoiceDateCol !== -1) {
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const cellAddr = XLSX.utils.encode_cell({ c: invoiceDateCol, r: R });
          const cell = sheet[cellAddr];
          if (cell) {
            if (cell.t === 'n') {
              cell.z = 'dd-mmm-yyyy';
            } else if (cell.t === 's') {
              const p = parseExcelDate(cell.v);
              if (p) {
                cell.t = 'd';
                cell.v = p.dateObj;
                cell.z = 'dd-mmm-yyyy';
              }
            }
          }
        }
      }
      
      const errors: Array<{ row: number; error: string }> = [];
      const invoiceMonths = new Set<string>();
      const invoicesMap = new Map<string, Record<string, any>>();
      let rowsProcessedCount = 0;
      
      rawData.forEach((row, index) => {
        const rowNum = index + 2; // +1 for 0-index, +1 for header
        
        const invoiceNumber = row['Invoice Number'];
        if (!invoiceNumber || String(invoiceNumber).trim() === '') {
          errors.push({ row: rowNum, error: 'Invoice Number is missing' });
          return;
        }

        if (String(invoiceNumber).trim().toUpperCase().startsWith('BOS')) {
          return; // Ignore BOS Documents Completely
        }

        let invoiceDate = row['Invoice Date'];
        let parsedDateObj: Date;
        let formattedDate = '';
        if (!invoiceDate || String(invoiceDate).trim() === '') {
          errors.push({ row: rowNum, error: 'Invoice Date is missing' });
          return;
        } else {
          const parsedDate = parseExcelDate(invoiceDate);
          if (parsedDate) {
            formattedDate = parsedDate.formattedDate;
            parsedDateObj = parsedDate.dateObj;
            invoiceMonths.add(parsedDate.monthName);
            row['Invoice Date'] = parsedDateObj; // Mutate for subsequent use
          } else {
            errors.push({ row: rowNum, error: 'Invalid Invoice Date format' });
            return;
          }
        }

        // Skip Void invoices completely from Final calculations
        if (String(row['Invoice Status']).trim().toLowerCase() === 'void') {
          return;
        }

        rowsProcessedCount++;

        // Initialize invoice group if not exists
        if (!invoicesMap.has(invoiceNumber)) {
          invoicesMap.set(invoiceNumber, {
            'Invoice Date': parsedDateObj,
            'Invoice Number': invoiceNumber,
            'Customer Name': row['Customer Name'] || '',
            'GST Identification Number (GSTIN)': row['GST Identification Number (GSTIN)'] || '',
            'GST18 (Subtotal)': 0,
            'GST5 (Subtotal)': 0,
            'IGST18 (Subtotal)': 0,
            'IGST5 (Subtotal)': 0,
            'GST18 (Tax)': 0,
            'GST5 (Tax)': 0,
            'IGST18 (Tax)': 0,
            'IGST5 (Tax)': 0,
            'Grand Total (Tax)': 0,
          });
        }

        const inv = invoicesMap.get(invoiceNumber)!;
        
        const itemTax = String(row['Item Tax'] || '').trim().toUpperCase();
        const itemTotal = Number(row['Item Total']) || 0;
        const itemTaxAmt = Number(row['Item Tax Amount']) || 0;

        if (itemTax === 'GST18') {
          inv['GST18 (Subtotal)'] += itemTotal;
          inv['GST18 (Tax)'] += itemTaxAmt;
        } else if (itemTax === 'GST5') {
          inv['GST5 (Subtotal)'] += itemTotal;
          inv['GST5 (Tax)'] += itemTaxAmt;
        } else if (itemTax === 'IGST18') {
          inv['IGST18 (Subtotal)'] += itemTotal;
          inv['IGST18 (Tax)'] += itemTaxAmt;
        } else if (itemTax === 'IGST5') {
          inv['IGST5 (Subtotal)'] += itemTotal;
          inv['IGST5 (Tax)'] += itemTaxAmt;
        }
      });

      if (errors.length > 0) {
        return { success: false, errors };
      }

      // Check mixed months validation
      if (invoiceMonths.size > 1) {
        return { 
          success: false, 
          errors: [{ 
            row: 0, 
            error: 'The uploaded file contains invoices from multiple months. Please upload one month\'s data at a time.' 
          }] 
        };
      }

      // Finalize Grand Total
      const validRows = Array.from(invoicesMap.values());
      validRows.forEach(inv => {
        inv['Grand Total (Tax)'] = inv['GST18 (Tax)'] + inv['GST5 (Tax)'] + inv['IGST18 (Tax)'] + inv['IGST5 (Tax)'];
      });

      // Generate Workbook
      const outWorkbook = XLSX.utils.book_new();
      
      // Sheet 1: Raw Data (Copy original sheet untouched)
      XLSX.utils.book_append_sheet(outWorkbook, sheet, "Raw Data");

      // Sheet 2: Final
      const outSheet = XLSX.utils.json_to_sheet(validRows, { header: FINAL_SHEET_COLUMNS });
      
      // Formatting Final Sheet
      formatSheetDates(outSheet);
      outSheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
      if (outSheet['!ref']) {
        outSheet['!autofilter'] = { ref: outSheet['!ref'] };
      }
      
      // Auto-size columns to reasonably fit content
      const colWidths = FINAL_SHEET_COLUMNS.map(col => ({ wch: Math.max(col.length, 15) }));
      outSheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(outWorkbook, outSheet, "Final");

      // Sheet 3: Verification (Independent Calculation)
      const verification = {
        invoiceCount: 0,
        lineItems: 0,
        totalSales: 0,
        totalTax: 0,
        GST18: { subtotal: 0, tax: 0 },
        GST5: { subtotal: 0, tax: 0 },
        IGST18: { subtotal: 0, tax: 0 },
        IGST5: { subtotal: 0, tax: 0 },
      };
      
      const vUniqueInvoices = new Set<string>();
      
      rawData.forEach((row) => {
        const invoiceNumber = String(row['Invoice Number'] || '').trim();
        if (!invoiceNumber || invoiceNumber.toUpperCase().startsWith('BOS')) return;
        if (String(row['Invoice Status']).trim().toLowerCase() === 'void') return;
        
        vUniqueInvoices.add(String(invoiceNumber));
        verification.lineItems++;
        
        const itemTax = String(row['Item Tax'] || '').trim().toUpperCase();
        const itemTotal = Number(row['Item Total']) || 0;
        const itemTaxAmt = Number(row['Item Tax Amount']) || 0;
        
        if (itemTax === 'GST18') {
          verification.GST18.subtotal += itemTotal;
          verification.GST18.tax += itemTaxAmt;
        } else if (itemTax === 'GST5') {
          verification.GST5.subtotal += itemTotal;
          verification.GST5.tax += itemTaxAmt;
        } else if (itemTax === 'IGST18') {
          verification.IGST18.subtotal += itemTotal;
          verification.IGST18.tax += itemTaxAmt;
        } else if (itemTax === 'IGST5') {
          verification.IGST5.subtotal += itemTotal;
          verification.IGST5.tax += itemTaxAmt;
        }
        
        verification.totalSales += itemTotal;
        verification.totalTax += itemTaxAmt;
      });
      verification.invoiceCount = vUniqueInvoices.size;
      
      // Calculate Final Totals from validRows
      const finalTotals = {
        GST18: { subtotal: 0, tax: 0 },
        GST5: { subtotal: 0, tax: 0 },
        IGST18: { subtotal: 0, tax: 0 },
        IGST5: { subtotal: 0, tax: 0 },
      };
      
      validRows.forEach(inv => {
        finalTotals.GST18.subtotal += Number(inv['GST18 (Subtotal)']) || 0;
        finalTotals.GST18.tax += Number(inv['GST18 (Tax)']) || 0;
        finalTotals.GST5.subtotal += Number(inv['GST5 (Subtotal)']) || 0;
        finalTotals.GST5.tax += Number(inv['GST5 (Tax)']) || 0;
        finalTotals.IGST18.subtotal += Number(inv['IGST18 (Subtotal)']) || 0;
        finalTotals.IGST18.tax += Number(inv['IGST18 (Tax)']) || 0;
        finalTotals.IGST5.subtotal += Number(inv['IGST5 (Subtotal)']) || 0;
        finalTotals.IGST5.tax += Number(inv['IGST5 (Tax)']) || 0;
      });
      
      const diffs = [
        { Metric: 'GST18 Subtotal', Verification: verification.GST18.subtotal, FinalSheet: finalTotals.GST18.subtotal, Difference: verification.GST18.subtotal - finalTotals.GST18.subtotal },
        { Metric: 'GST18 Tax', Verification: verification.GST18.tax, FinalSheet: finalTotals.GST18.tax, Difference: verification.GST18.tax - finalTotals.GST18.tax },
        { Metric: 'GST5 Subtotal', Verification: verification.GST5.subtotal, FinalSheet: finalTotals.GST5.subtotal, Difference: verification.GST5.subtotal - finalTotals.GST5.subtotal },
        { Metric: 'GST5 Tax', Verification: verification.GST5.tax, FinalSheet: finalTotals.GST5.tax, Difference: verification.GST5.tax - finalTotals.GST5.tax },
        { Metric: 'IGST18 Subtotal', Verification: verification.IGST18.subtotal, FinalSheet: finalTotals.IGST18.subtotal, Difference: verification.IGST18.subtotal - finalTotals.IGST18.subtotal },
        { Metric: 'IGST18 Tax', Verification: verification.IGST18.tax, FinalSheet: finalTotals.IGST18.tax, Difference: verification.IGST18.tax - finalTotals.IGST18.tax },
        { Metric: 'IGST5 Subtotal', Verification: verification.IGST5.subtotal, FinalSheet: finalTotals.IGST5.subtotal, Difference: verification.IGST5.subtotal - finalTotals.IGST5.subtotal },
        { Metric: 'IGST5 Tax', Verification: verification.IGST5.tax, FinalSheet: finalTotals.IGST5.tax, Difference: verification.IGST5.tax - finalTotals.IGST5.tax },
      ];
      
      const allMatch = diffs.every(d => Math.abs(d.Difference) < 0.0001);
      
      const verSheetData: any[] = [];
      if (allMatch) {
        verSheetData.push(['🟢 VERIFIED']);
        verSheetData.push(['Independent verification passed. All GST calculations match.']);
      } else {
        verSheetData.push(['🔴 VERIFICATION FAILED']);
        verSheetData.push(['Mismatches detected between raw calculations and final sheet output.']);
      }
      
      verSheetData.push([]);
      verSheetData.push(['Verification Summary', 'Value']);
      verSheetData.push(['Invoice Count', verification.invoiceCount]);
      verSheetData.push(['Line Items', verification.lineItems]);
      verSheetData.push(['Total Sales', verification.totalSales]);
      verSheetData.push(['Total Tax', verification.totalTax]);
      
      verSheetData.push([]);
      verSheetData.push(['GST Summary', 'Sales', 'Tax']);
      verSheetData.push(['GST18', verification.GST18.subtotal, verification.GST18.tax]);
      verSheetData.push(['GST5', verification.GST5.subtotal, verification.GST5.tax]);
      verSheetData.push(['IGST18', verification.IGST18.subtotal, verification.IGST18.tax]);
      verSheetData.push(['IGST5', verification.IGST5.subtotal, verification.IGST5.tax]);
      
      verSheetData.push([]);
      verSheetData.push(['Cross Verification', 'Verification', 'Final Sheet', 'Difference']);
      diffs.forEach(d => {
        verSheetData.push([d.Metric, d.Verification, d.FinalSheet, d.Difference]);
      });
      
      const verSheet = XLSX.utils.aoa_to_sheet(verSheetData);
      verSheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      // Bold critical headers
      const boldCells = ['A1', 'A3', 'B3', 'A8', 'B8', 'C8', 'A14', 'B14', 'C14', 'D14'];
      boldCells.forEach(addr => {
        if (verSheet[addr]) verSheet[addr].s = { font: { bold: true } };
      });
      
      XLSX.utils.book_append_sheet(outWorkbook, verSheet, "Verification");

      // 4, 5, 6, 7: Audit Sheets Generation
      const prefixesAndNumbers: { prefix: string, num: number, original: string, date: any }[] = [];
      const invoiceNumbersSet = new Set<string>();
      
      const pendingEInvoicesMap = new Map<string, any>();
      const pendingEWayBillsMap = new Map<string, any>();
      const draftInvoicesMap = new Map<string, any>();

      rawData.forEach(row => {
        const invStr = String(row['Invoice Number'] || '').trim();
        if (!invStr || invStr.toUpperCase().startsWith('BOS')) {
          return;
        }

        const invId = String(row['Invoice ID'] || '').trim();
        const uniqueKey = invId || invStr;

        const invStatus = String(row['Invoice Status']).trim().toLowerCase();

        // Missing Invoices Logic (Includes Void)
        if (!invoiceNumbersSet.has(invStr)) {
          invoiceNumbersSet.add(invStr);
          const match = invStr.match(/^(.*?)(\d+)$/);
          if (match) {
            prefixesAndNumbers.push({ 
              prefix: match[1], 
              num: parseInt(match[2], 10), 
              original: invStr,
              date: row['Invoice Date']
            });
          }
        }

        if (invStatus === 'void') {
          return; // Exclude Void from other audit sheets
        }

        if (invStatus === 'draft') {
          if (!draftInvoicesMap.has(uniqueKey)) draftInvoicesMap.set(uniqueKey, mapInvoiceAuditRow(row));
        }

        // Pending e-Invoices Logic
        const gst = String(row['GST Identification Number (GSTIN)'] || '').trim();
        const eInvStatus = String(row['e-Invoice Status'] || '').trim();
        if (gst !== '' && eInvStatus === 'Yet To Be Pushed') {
          if (!pendingEInvoicesMap.has(uniqueKey)) pendingEInvoicesMap.set(uniqueKey, mapInvoiceAuditRow(row));
        }

        // Pending E-Way Bills Logic
        const total = Number(row['Total (Invoice Amount Including Tax)'] || row['Total'] || row['Invoice Total'] || row['Total Amount'] || 0);
        const ewayStatus = String(row['E-WayBill Status'] || '').trim();
        const isPendingEway = ewayStatus === '' || ewayStatus.toUpperCase() === 'NULL' || ewayStatus !== 'Generated';
        if (total > 50000 && isPendingEway) {
          if (!pendingEWayBillsMap.has(uniqueKey)) pendingEWayBillsMap.set(uniqueKey, mapEwayBillAuditRow(row));
        }
      });

      const prefixGroups = new Map<string, typeof prefixesAndNumbers>();
      prefixesAndNumbers.forEach(item => {
        if (!prefixGroups.has(item.prefix)) {
          prefixGroups.set(item.prefix, []);
        }
        prefixGroups.get(item.prefix)!.push(item);
      });
      
      const missingInvoicesData: any[] = [];
      for (const [prefix, items] of prefixGroups.entries()) {
        if (items.length < 2) continue;
        items.sort((a, b) => a.num - b.num);
        
        for (let idx = 0; idx < items.length - 1; idx++) {
          const current = items[idx];
          const next = items[idx + 1];
          const diff = next.num - current.num;
          
          if (diff > 1) {
            const padLen = current.original.substring(prefix.length).length;
            for (let i = current.num + 1; i < next.num; i++) {
              const reconstructed = `${prefix}${String(i).padStart(padLen, '0')}`;
              missingInvoicesData.push({ 
                "Previous Invoice": current.original,
                "Previous Date": current.date,
                "Missing Invoice": reconstructed,
                "Next Invoice": next.original,
                "Next Date": next.date
              });
            }
          }
        }
      }

      const sortRows = (a: any, b: any) => {
        const dateA = a['Invoice Date'] instanceof Date ? a['Invoice Date'].getTime() : 0;
        const dateB = b['Invoice Date'] instanceof Date ? b['Invoice Date'].getTime() : 0;
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        const numA = String(a['Invoice Number'] || '');
        const numB = String(b['Invoice Number'] || '');
        return numA.localeCompare(numB);
      };

      const pendingEInvoicesData = Array.from(pendingEInvoicesMap.values());
      const pendingEWayBillsData = Array.from(pendingEWayBillsMap.values());
      const draftInvoicesData = Array.from(draftInvoicesMap.values());

      pendingEInvoicesData.sort(sortRows);
      pendingEWayBillsData.sort(sortRows);
      draftInvoicesData.sort(sortRows);

      const missingSheet = XLSX.utils.json_to_sheet(missingInvoicesData, { 
        header: ["Previous Invoice", "Previous Date", "Missing Invoice", "Next Invoice", "Next Date"] 
      });
      formatSheetDates(missingSheet);
      XLSX.utils.book_append_sheet(outWorkbook, missingSheet, "Missing Invoice Numbers");

      const AUDIT_COLUMNS = [
        'Invoice Date',
        'Invoice ID',
        'Invoice Number',
        'Issued Date',
        'Invoice Status',
        'Accounts Receivable',
        'Customer ID',
        'Customer Name',
        'Customer Number'
      ];

      const EWAY_BILLS_COLUMNS = [
        ...AUDIT_COLUMNS,
        'Total Amount (Incl. Tax)',
        'Shipping Address'
      ];

      const pendingEInvoicesSheet = XLSX.utils.json_to_sheet(pendingEInvoicesData, { header: AUDIT_COLUMNS });
      formatSheetDates(pendingEInvoicesSheet);
      XLSX.utils.book_append_sheet(outWorkbook, pendingEInvoicesSheet, "Pending e-Invoices");

      const pendingEWayBillsSheet = XLSX.utils.json_to_sheet(pendingEWayBillsData, { header: EWAY_BILLS_COLUMNS });
      
      const ewayRange = XLSX.utils.decode_range(pendingEWayBillsSheet['!ref'] || 'A1:A1');
      let shipAddrCol = EWAY_BILLS_COLUMNS.indexOf('Shipping Address');
      if (shipAddrCol !== -1) {
        for (let R = ewayRange.s.r + 1; R <= ewayRange.e.r; ++R) {
          const cellAddr = XLSX.utils.encode_cell({ c: shipAddrCol, r: R });
          if (pendingEWayBillsSheet[cellAddr]) {
            if (!pendingEWayBillsSheet[cellAddr].s) pendingEWayBillsSheet[cellAddr].s = {};
            pendingEWayBillsSheet[cellAddr].s.alignment = { wrapText: true };
          }
        }
      }

      formatSheetDates(pendingEWayBillsSheet);
      XLSX.utils.book_append_sheet(outWorkbook, pendingEWayBillsSheet, "Pending E-Way Bills");

      const draftInvoicesSheet = XLSX.utils.json_to_sheet(draftInvoicesData, { header: AUDIT_COLUMNS });
      formatSheetDates(draftInvoicesSheet);
      XLSX.utils.book_append_sheet(outWorkbook, draftInvoicesSheet, "Draft Invoices");

      // Generate file buffer
      const outBuffer = XLSX.write(outWorkbook, { type: 'buffer', bookType: 'xlsx' });
      const base64Output = outBuffer.toString('base64');
      
      let finalMonth = 'Unknown';
      if (invoiceMonths.size === 1) {
        finalMonth = Array.from(invoiceMonths)[0];
      }

      const outputFileName = `Invoice_${finalMonth}_Kamna_Traders.xlsx`;
      const processingTimeMs = Math.round(performance.now() - startTime);

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'PROCESS_INVOICE_EXCEL',
          details: JSON.stringify({
            originalFileName,
            outputFileName,
            rowsProcessed: rowsProcessedCount,
            invoicesProcessed: validRows.length,
            processingTimeMs
          })
        }
      });

      return {
        success: true,
        base64Output,
        fileName: outputFileName,
        stats: {
          invoicesProcessed: validRows.length,
          rowsProcessed: rowsProcessedCount,
          invoiceMonth: finalMonth,
          processingTimeMs
        }
      };

    } catch (error: any) {
      console.error('[InvoiceProcessorService] Error:', error);
      return { success: false, errors: [{ row: 0, error: 'Internal processing error: ' + error.message }] };
    }
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchInvoiceByNumber, fetchInvoiceById } from '@/lib/zoho/invoices';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceNumbers } = await req.json();
    if (!invoiceNumbers || !Array.isArray(invoiceNumbers)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const results = [];

    for (let idOrNum of invoiceNumbers) {
      idOrNum = idOrNum.trim();
      if (!idOrNum) continue;

      console.log(`[Manual Import Precheck API] Checking input: ${idOrNum}`);

      // 1. Check DCR database
      let existing;
      try {
        existing = await prisma.dcrInvoice.findFirst({
          where: {
            OR: [
              { invoiceNumber: idOrNum },
              { zohoInvoiceId: idOrNum }
            ]
          }
        });
      } catch (err: any) {
        console.error(`[Manual Import Precheck API] DB Check Error for ${idOrNum}:`, err);
        results.push({ status: 'FAILED', input: idOrNum, reason: 'Database error: ' + err.message });
        continue;
      }

      if (existing) {
        console.log(`[Manual Import Precheck API] Found existing in DB: ${existing.invoiceNumber}`);
        results.push({
          status: 'ALREADY_IMPORTED',
          currentDcrStatus: existing.dcrStatus,
          invoiceNumber: existing.invoiceNumber,
          customer: existing.customerName,
          date: existing.invoiceDate,
          total: existing.invoiceTotal,
          invoiceId: existing.zohoInvoiceId,
          input: idOrNum
        });
        continue;
      }

      // 2. Search Zoho
      let foundInvoices = [];
      let isIdSearch = /^\d{16,}$/.test(idOrNum); // Zoho IDs are typically 19 digits

      if (isIdSearch) {
        try {
          console.log(`[Manual Import Precheck API] Searching Zoho by ID: ${idOrNum}`);
          const { invoice } = await fetchInvoiceById(idOrNum);
          if (invoice) {
            foundInvoices = [invoice];
            console.log(`[Manual Import Precheck API] Found in Zoho by ID.`);
          }
        } catch (err: any) {
          console.error(`[Manual Import Precheck API] Error fetching by ID ${idOrNum}:`, err.message);
          try {
            console.log(`[Manual Import Precheck API] Fallback searching Zoho by Number: ${idOrNum}`);
            const searchRes = await searchInvoiceByNumber(idOrNum);
            foundInvoices = searchRes.invoices;
          } catch (e: any) {
            console.error(`[Manual Import Precheck API] Error searching by Number ${idOrNum}:`, e.message);
            results.push({ status: 'FAILED', input: idOrNum, reason: 'Zoho API Error: ' + e.message });
            continue;
          }
        }
      } else {
        try {
          console.log(`[Manual Import Precheck API] Searching Zoho by Number: ${idOrNum}`);
          const searchRes = await searchInvoiceByNumber(idOrNum);
          foundInvoices = searchRes.invoices;
          console.log(`[Manual Import Precheck API] Found ${foundInvoices.length} results.`);
        } catch (err: any) {
          console.error(`[Manual Import Precheck API] Error searching by Number ${idOrNum}:`, err.message);
          results.push({ status: 'FAILED', input: idOrNum, reason: 'Zoho API Error: ' + err.message });
          continue;
        }
      }

      const exactMatch = foundInvoices.find((inv: any) => 
        inv.invoice_number === idOrNum || inv.invoice_id === idOrNum
      ) || foundInvoices[0];

      if (exactMatch) {
        const checkMatch = await prisma.dcrInvoice.findUnique({
          where: { zohoInvoiceId: exactMatch.invoice_id }
        });

        if (checkMatch) {
           results.push({
            status: 'ALREADY_IMPORTED',
            currentDcrStatus: checkMatch.dcrStatus,
            invoiceNumber: checkMatch.invoiceNumber,
            customer: checkMatch.customerName,
            date: checkMatch.invoiceDate,
            total: checkMatch.invoiceTotal,
            invoiceId: checkMatch.zohoInvoiceId,
            input: idOrNum
          });
        } else {
          results.push({
            status: 'FOUND_IN_ZOHO',
            invoiceId: exactMatch.invoice_id,
            invoiceNumber: exactMatch.invoice_number,
            customer: exactMatch.customer_name,
            date: exactMatch.date,
            total: exactMatch.total,
            input: idOrNum
          });
        }
      } else {
        results.push({
          status: 'NOT_FOUND',
          input: idOrNum
        });
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('[Manual Import Precheck Error]:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

// Helper to fetch all invoices within a specific date range from Zoho
async function fetchZohoInvoicesLast60Days(customerId: string): Promise<any[]> {
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  if (!orgId || !accessToken) throw new Error('Zoho auth failed');

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const dateStart = sixtyDaysAgo.toISOString().split('T')[0];

  let allInvoices: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&customer_id=${customerId}&date_start=${dateStart}&page=${page}&per_page=200&sort_column=date&sort_order=D`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    
    if (!response.ok) break;
    const data = await response.json();
    const items = data.invoices || [];
    
    // Filter void invoices immediately
    const validItems = items.filter((inv: any) => inv.status !== 'void');
    allInvoices = [...allInvoices, ...validItems];

    if (data.page_context && data.page_context.has_more_page) {
      page++;
    } else {
      hasMore = false;
    }

    // Safety limit to prevent infinite loops (max 1000 invoices = 5 pages)
    if (page > 5) break;
  }

  return allInvoices;
}

async function fetchZohoContactBalance(customerId: string): Promise<number> {
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  if (!orgId || !accessToken) return 0;
  try {
    const url = `${API_BASE_URL}/books/v3/contacts/${customerId}?organization_id=${orgId}`;
    const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!response.ok) return 0;
    const data = await response.json();
    return Number(data.contact?.outstanding_receivable_amount || 0);
  } catch (e) {
    return 0;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = await params;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // 1. Check Invoice Cache
    const cachedSummary = getCache('customerLookupInvoiceCache', customerId);
    if (cachedSummary) {
      return NextResponse.json({
        success: true,
        data: cachedSummary
      });
    }

    // 2. Fetch Zoho Invoices (Last 60 days) and Contact Balance concurrently
    const [zohoInvoices, closingBalance] = await Promise.all([
      fetchZohoInvoicesLast60Days(customerId),
      fetchZohoContactBalance(customerId)
    ]);

    // 3. Fetch Prisma DCR Invoices for this customer
    const dcrInvoices = await prisma.dcrInvoice.findMany({
      where: { customerId },
      include: {
        items: {
          include: {
            serialAllocations: {
              include: {
                serial: {
                  select: {
                    status: true,
                    vendorDcrStatus: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const dcrMap = new Map(dcrInvoices.map(inv => [inv.zohoInvoiceId, inv]));

    let totalPanelsSold = 0;
    let totalVendorDcrPending = 0;
    let totalReadyToIssue = 0;
    let totalIssued = 0;
    let totalOnHold = 0;
    let invoicesReviewed = 0;
    let invoicesPendingReview = 0;

    const mergedInvoices: any[] = [];
    const processedZohoIds = new Set<string>();

    const processRow = (
      id: string,
      zohoInvoiceId: string,
      invoiceNumber: string,
      invoiceDate: string,
      invoiceTotal: number,
      salespersonName: string,
      dcrInv: any | undefined
    ) => {
      let processingStatus = 'UNPROCESSED';
      let displayStatus = 'UNPROCESSED';
      let isUnprocessed = false;

      let dcrPanels = 0;
      let nonDcrPanels = 0;
      let serialEntryPending = 0;
      let vendorDcrPending = 0;
      let onHold = 0;
      let issued = 0;
      let readyToIssue = 0;

      if (!dcrInv) {
        // No DCR record exists
        isUnprocessed = true;
        invoicesPendingReview++;
        processingStatus = 'UNPROCESSED';
        displayStatus = 'UNPROCESSED';
      } else {
        isUnprocessed = dcrInv.dcrStatus === 'NEW' || dcrInv.dcrStatus === 'UNDER_REVIEW';

        if (isUnprocessed) {
          invoicesPendingReview++;
        } else {
          invoicesReviewed++;
        }

        dcrInv.items.forEach((item: any) => {
          if (item.selectedForDCR) {
            dcrPanels += item.quantity;
            totalPanelsSold += item.quantity;
            
            if (item.quantity > item.serialAllocations.length) {
              serialEntryPending += (item.quantity - item.serialAllocations.length);
            }
          } else {
            nonDcrPanels += item.quantity;
          }

          item.serialAllocations.forEach((alloc: any) => {
            const s = alloc.serial;
            if (!s) return;
            
            if (s.vendorDcrStatus !== 'RECEIVED') {
              vendorDcrPending++;
              totalVendorDcrPending++;
            }

            if (s.status === 'ISSUED') {
              issued++;
              totalIssued++;
            } else if (s.status === 'READY_TO_ISSUE') {
              readyToIssue++;
              totalReadyToIssue++;
            } else if (s.status === 'HOLD') {
              onHold++;
              totalOnHold++;
            }
          });
        });

        // Processing Status Engine logic (Requested Update)
        const reviewRecordExists = !isUnprocessed;
        
        if (!reviewRecordExists) {
          processingStatus = 'UNPROCESSED';
        } else if (reviewRecordExists && dcrPanels === 0) {
          processingStatus = 'PROCESSED_NO_DCR';
        } else if (reviewRecordExists && dcrPanels > 0) {
          processingStatus = 'PROCESSED_DCR';
        }

        // Display Status Mapping
        if (dcrInv.dcrStatus === 'NO_DCR_REQUIRED' || processingStatus === 'PROCESSED_NO_DCR') {
          displayStatus = 'PROCESSED - NO DCR REQUIRED';
        } else if (serialEntryPending > 0) {
          displayStatus = 'SERIAL ENTRY PENDING';
        } else if (vendorDcrPending > 0) {
          displayStatus = 'VENDOR DCR PENDING';
        } else if (onHold > 0) {
          displayStatus = 'HOLD QUEUE';
        } else if (readyToIssue > 0) {
          displayStatus = 'READY TO ISSUE';
        } else if (dcrPanels > 0 && issued === dcrPanels) {
          displayStatus = 'FULLY ISSUED';
        } else if (dcrPanels > 0) {
          displayStatus = 'DCR IDENTIFIED';
        } else if (isUnprocessed) {
          displayStatus = 'UNPROCESSED';
        }
      }

      return {
        id,
        zohoInvoiceId,
        invoiceNumber,
        invoiceDate,
        invoiceTotal,
        salesperson: salespersonName || '--',
        dcrStatus: dcrInv ? dcrInv.dcrStatus : 'NONE',
        processingStatus,
        displayStatus,
        dcrPanels,
        nonDcrPanels,
        serialEntryPending,
        vendorDcrPending,
        onHold,
        readyToIssue,
        issued,
      };
    };

    // 4. Process all Zoho invoices (Last 60 Days)
    zohoInvoices.forEach((zInv: any) => {
      processedZohoIds.add(zInv.invoice_id);
      const dcrInv = dcrMap.get(zInv.invoice_id);
      
      const invoiceDate = zInv.date || zInv.created_time || '';
      
      const row = processRow(
        dcrInv?.id || zInv.invoice_id,
        zInv.invoice_id,
        zInv.invoice_number,
        invoiceDate,
        Number(zInv.total || 0),
        zInv.salesperson_name,
        dcrInv
      );
      mergedInvoices.push(row);
    });

    // 5. Process older DCR Invoices (not in the recent Zoho fetch)
    dcrInvoices.forEach((dcrInv) => {
      if (!processedZohoIds.has(dcrInv.zohoInvoiceId)) {
        const row = processRow(
          dcrInv.id,
          dcrInv.zohoInvoiceId,
          dcrInv.invoiceNumber,
          dcrInv.invoiceDate.toISOString(),
          dcrInv.invoiceTotal,
          '--', 
          dcrInv
        );
        // Only include older invoice if it has unfinished DCR activity
        const hasPendingWork = row.serialEntryPending > 0 || row.vendorDcrPending > 0 || row.onHold > 0 || row.readyToIssue > 0;
        if (hasPendingWork) {
          mergedInvoices.push(row);
        }
      }
    });

    // Sort mergedInvoices by date DESC
    mergedInvoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

    const summaryData = {
      kpis: {
        totalPanelsSold,
        vendorDcrPending: totalVendorDcrPending,
        readyToIssue: totalReadyToIssue,
        issued: totalIssued,
        onHold: totalOnHold,
        invoicesReviewed,
        invoicesPendingReview,
        dcrPanels: totalPanelsSold,
        closingBalance,
      },
      invoices: mergedInvoices
    };

    // Store in our new 15-min cache
    setCache('customerLookupInvoiceCache', customerId, summaryData, 15 * 60 * 1000);

    return NextResponse.json({
      success: true,
      data: summaryData
    });

  } catch (error: any) {
    console.error('Customer Summary Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';
import { getCustomerInvoices } from '@/lib/zoho/customer-statement';

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

    // Check backend cache for summary
    const cachedSummary = getCache('dcrSummaryCache', customerId);
    if (cachedSummary) {
      return NextResponse.json({
        success: true,
        data: cachedSummary
      });
    }

    // 1. Fetch Zoho Invoices (Last ~60 days, up to 100 via API)
    const zohoRes = await getCustomerInvoices(customerId);
    const zohoInvoices = zohoRes.success && zohoRes.data ? zohoRes.data : [];

    // 2. Fetch Prisma DCR Invoices for this customer
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

    // Map Prisma DCR invoices by zohoInvoiceId for quick lookup
    const dcrMap = new Map(dcrInvoices.map(inv => [inv.zohoInvoiceId, inv]));

    let totalPanelsSold = 0;
    let totalVendorDcrPending = 0;
    let totalReadyToIssue = 0;
    let totalIssued = 0;
    let totalOnHold = 0;
    let invoicesReviewed = 0;
    let invoicesPendingReview = 0;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const mergedInvoices: any[] = [];
    const processedZohoIds = new Set<string>();

    // Helper to process an invoice row
    const processRow = (
      id: string,
      zohoInvoiceId: string,
      invoiceNumber: string,
      invoiceDate: string,
      invoiceTotal: number,
      salespersonName: string,
      dcrInv: any | undefined
    ) => {
      let processingStatus = 'NOT_REVIEWED';
      let displayStatus = 'NOT_REVIEWED';
      let isUnprocessed = false;

      let dcrPanels = 0;
      let nonDcrPanels = 0;
      let serialEntryPending = 0;
      let vendorDcrPending = 0;
      let onHold = 0;
      let issued = 0;
      let readyToIssue = 0;

      if (!dcrInv) {
        // Exists in Zoho, but no record in DCR module
        // Usually means not reviewed
      } else {
        // Exists in DCR
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

        // Processing Status Engine logic
        if (dcrInv.dcrStatus === 'NO_DCR_REQUIRED') {
          processingStatus = 'NO_DCR_REQUIRED';
          displayStatus = 'NO DCR REQUIRED';
        } else if (serialEntryPending > 0 || vendorDcrPending > 0 || onHold > 0 || readyToIssue > 0) {
          processingStatus = 'IN_PROGRESS';
          if (serialEntryPending > 0) displayStatus = 'SERIAL ENTRY PENDING';
          else if (vendorDcrPending > 0) displayStatus = 'VENDOR DCR PENDING';
          else if (onHold > 0) displayStatus = 'HOLD QUEUE';
          else if (readyToIssue > 0) displayStatus = 'READY TO ISSUE';
        } else if (dcrPanels > 0 && issued === dcrPanels) {
          processingStatus = 'COMPLETED';
          displayStatus = 'FULLY ISSUED';
        } else if (dcrPanels > 0) {
          processingStatus = 'DCR_IDENTIFIED';
          displayStatus = 'DCR IDENTIFIED';
        } else if (isUnprocessed) {
          processingStatus = 'NOT_REVIEWED'; // Still tracking it as not reviewed fully in the workflow
          displayStatus = 'UNPROCESSED';
        }
      }

      return {
        id, // For routing, if we don't have DCR ID we can pass Zoho ID or a dummy, but we need Prisma ID to open the modal correctly. Wait, if it's not in Prisma, we'll use Zoho ID as a fallback.
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

    // 3. Process all Zoho invoices
    zohoInvoices.forEach((zInv: any) => {
      processedZohoIds.add(zInv.invoiceId);
      const dcrInv = dcrMap.get(zInv.invoiceId);
      const row = processRow(
        dcrInv?.id || zInv.invoiceId, // Use Prisma ID if available, else Zoho ID
        zInv.invoiceId,
        zInv.invoiceNumber,
        zInv.invoiceDate,
        zInv.total,
        zInv.salespersonName,
        dcrInv
      );
      mergedInvoices.push(row);
    });

    // 4. Process older DCR Invoices not in the recent Zoho fetch
    dcrInvoices.forEach((dcrInv) => {
      if (!processedZohoIds.has(dcrInv.zohoInvoiceId)) {
        const row = processRow(
          dcrInv.id,
          dcrInv.zohoInvoiceId,
          dcrInv.invoiceNumber,
          dcrInv.invoiceDate.toISOString(),
          dcrInv.invoiceTotal,
          '--', // We don't have salesperson cached in DcrInvoice currently
          dcrInv
        );
        // Only include if there is pending work
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
      },
      invoices: mergedInvoices
    };

    setCache('dcrSummaryCache', customerId, summaryData, 15 * 60);

    return NextResponse.json({
      success: true,
      data: summaryData
    });

  } catch (error: any) {
    console.error('Customer Summary Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

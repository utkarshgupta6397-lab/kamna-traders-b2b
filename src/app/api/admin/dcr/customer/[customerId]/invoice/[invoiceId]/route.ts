import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCache, setCache } from '@/lib/cache';

export async function GET(req: Request, { params }: { params: Promise<{ customerId: string; invoiceId: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, invoiceId } = await params;
    if (!customerId || !invoiceId) {
      return NextResponse.json({ error: 'Customer ID and Invoice ID are required' }, { status: 400 });
    }

    // Check backend cache
    const cacheKey = `${customerId}_${invoiceId}_v2`;
    const cachedData = getCache('dcrInvoiceCache', cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData });
    }

    // Attempt to fetch invoice details from Prisma
    // The invoiceId parameter might be a Prisma ID (if reviewed) or a Zoho ID (if not reviewed)
    const invoice = await prisma.dcrInvoice.findFirst({
      where: {
        OR: [
          { id: invoiceId },
          { zohoInvoiceId: invoiceId }
        ],
        customerId: customerId
      },
      include: {
        items: {
          include: {
            serialAllocations: {
              include: {
                serial: true
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      // It exists in Zoho but hasn't been synced to DCR module yet (NOT_REVIEWED)
      // For this optimized tool, we return an empty array to signify no items exist yet locally.
      // The modal UI will handle this and display "Invoice not yet reviewed".
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch all SKUs matching these items to get vendor/brand fallback
    const itemIds = invoice.items.map(i => i.itemId).filter(Boolean) as string[];
    const skuNames = invoice.items.map(i => i.sku).filter(Boolean) as string[];
    
    const skus = await prisma.sku.findMany({
      where: {
        OR: [
          { zohoBookItemId: { in: itemIds } },
          { id: { in: skuNames } }
        ]
      },
      include: { brand: true }
    });

    // Map serials and compute metrics
    const skuGroups = invoice.items.map(item => {
      let serialEntryPending = 0;
      let vendorDcrPending = 0;
      let onHold = 0;
      let issued = 0;
      let readyToIssue = 0;

      if (item.selectedForDCR) {
        if (item.quantity > item.serialAllocations.length) {
          serialEntryPending = item.quantity - item.serialAllocations.length;
        }
      }

      // Identify item vendor
      let itemVendor = '--';
      const matchedSku = skus.find(s => s.zohoBookItemId === item.itemId || s.id === item.sku);
      if (matchedSku?.brand?.name) {
        itemVendor = matchedSku.brand.name;
      }

      const serials = item.serialAllocations.map(alloc => {
        const s = alloc.serial;
        if (!s) return null;
        
        if (s.vendorDcrStatus !== 'RECEIVED') {
          vendorDcrPending++;
        } else if (s.status === 'ISSUED') {
          issued++;
        } else if (s.status === 'READY_TO_ISSUE') {
          readyToIssue++;
        } else {
          onHold++;
        }

        // Identify serial vendor
        let serialVendor = s.vendorName || itemVendor;

        return {
          id: alloc.id,
          serialNumber: alloc.serialNumber,
          vendorName: serialVendor,
          vendorDcrStatus: s.vendorDcrStatus, // RECEIVED or NOT_RECEIVED
          status: s.status, // AVAILABLE, ALLOCATED, HOLD, READY_TO_ISSUE, ISSUED
          allocatedAt: alloc.allocatedAt,
        };
      }).filter(Boolean);

      let itemStatus = '';
      if (!item.selectedForDCR) itemStatus = 'NON DCR ITEM';
      else if (serialEntryPending > 0) itemStatus = 'SERIAL ENTRY PENDING';
      else if (vendorDcrPending > 0) itemStatus = 'VENDOR DCR PENDING';
      else if (onHold > 0) itemStatus = 'ON HOLD';
      else if (issued === item.quantity) itemStatus = 'FULLY ISSUED';
      else if (issued > 0) itemStatus = 'PARTIALLY ISSUED';
      else itemStatus = 'PENDING ACTIVITY';

      // If we got vendor from serials, use the most common one if itemVendor is missing.
      // But itemVendor from Sku Master is reliable.
      if (itemVendor === '--' && serials.length > 0 && serials[0]?.vendorName) {
        itemVendor = serials[0].vendorName;
      }

      return {
        itemId: item.id,
        itemName: item.itemName,
        sku: item.sku,
        vendor: itemVendor,
        quantity: item.quantity,
        selectedForDCR: item.selectedForDCR,
        metrics: {
          panels: item.quantity,
          serialEntryPending,
          vendorDcrPending,
          onHold,
          readyToIssue,
          issued
        },
        itemStatus,
        serials
      };
    });

    setCache('dcrInvoiceCache', cacheKey, skuGroups, 15 * 60);

    return NextResponse.json({ success: true, data: skuGroups });

  } catch (error: any) {
    console.error('Customer Invoice Detail Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

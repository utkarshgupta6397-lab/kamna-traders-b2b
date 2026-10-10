import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let invoice;

    if (id.startsWith('cm')) {
      invoice = await prisma.dcrInvoice.findUnique({
        where: { id },
        include: {
          items: true,
          serialAllocations: true,
        },
      });
    } else {
      invoice = await prisma.dcrInvoice.findUnique({
        where: { zohoInvoiceId: id },
        include: {
          items: true,
          serialAllocations: true,
        },
      });
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if full invoice details / line items need fetching or enrichment
    const hasNoItems = !invoice.items || invoice.items.length === 0;
    const hasIncompleteItems = invoice.items.some(
      item => item.source === 'ZOHO' && (item.rate === null || item.amount === null)
    );
    const needsEnrichment = hasNoItems || hasIncompleteItems;

    if (needsEnrichment) {
      try {
        const { fetchInvoiceById } = await import('@/lib/zoho/invoices');
        const { invoice: zohoInvoice, apiCallsUsed } = await fetchInvoiceById(invoice.zohoInvoiceId);

        if (apiCallsUsed > 0) {
          await prisma.zohoApiLog.create({
            data: {
              endpoint: 'FETCH_INVOICE_DETAILS',
              module: 'DCR',
              userId: session.userId || 'SYSTEM_REVIEW',
            },
          });
        }

        if (zohoInvoice && zohoInvoice.line_items) {
          const ops: any[] = [];

          if (hasNoItems) {
            // Bulk create line items
            for (const zItem of zohoInvoice.line_items) {
              let rate = zItem.rate ?? zItem.bcy_rate ?? 0;
              const amount = zItem.item_total ?? (rate ? rate * zItem.quantity : 0);
              if (rate === 0 && amount && zItem.quantity) {
                rate = amount / zItem.quantity;
              }
              const description = zItem.description ?? zItem.item_description ?? zItem.sales_description ?? null;
              ops.push(
                prisma.dcrInvoiceItem.create({
                  data: {
                    dcrInvoiceId: invoice.id,
                    itemId: zItem.item_id,
                    itemName: zItem.name,
                    sku: zItem.sku || null,
                    quantity: zItem.quantity,
                    rate,
                    amount,
                    description,
                    source: 'ZOHO',
                  },
                })
              );
            }
          } else {
            // Update existing items and create any missing line items
            for (const zItem of zohoInvoice.line_items) {
              const matchingDbItem = invoice.items.find(
                item => item.itemId === zItem.item_id && item.source === 'ZOHO'
              );
              let rate = zItem.rate ?? zItem.bcy_rate ?? null;
              const amount = zItem.item_total ?? (rate ? rate * zItem.quantity : 0);
              if (rate === null || rate === 0) {
                rate = (amount && zItem.quantity) ? amount / zItem.quantity : 0;
              }
              const description = zItem.description ?? zItem.item_description ?? zItem.sales_description ?? null;

              if (matchingDbItem) {
                ops.push(
                  prisma.dcrInvoiceItem.update({
                    where: { id: matchingDbItem.id },
                    data: {
                      rate,
                      amount,
                      description,
                      quantity: zItem.quantity,
                      itemName: zItem.name,
                    },
                  })
                );
              } else {
                ops.push(
                  prisma.dcrInvoiceItem.create({
                    data: {
                      dcrInvoiceId: invoice.id,
                      itemId: zItem.item_id,
                      itemName: zItem.name,
                      sku: zItem.sku || null,
                      quantity: zItem.quantity,
                      rate,
                      amount,
                      description,
                      source: 'ZOHO',
                    },
                  })
                );
              }
            }
          }

          // Update header fields if available from full invoice
          const updateHeaderData: any = {};
          if (zohoInvoice.location_id && !invoice.locationId) {
            updateHeaderData.locationId = zohoInvoice.location_id;
          }
          if ((zohoInvoice.location_name || zohoInvoice.branch_name) && !invoice.locationName) {
            updateHeaderData.locationName = zohoInvoice.location_name || zohoInvoice.branch_name;
          }
          if (typeof zohoInvoice.balance === 'number' && invoice.outstandingAmount !== zohoInvoice.balance) {
            updateHeaderData.outstandingAmount = zohoInvoice.balance;
            updateHeaderData.outstandingUpdatedAt = new Date();
          }

          if (Object.keys(updateHeaderData).length > 0) {
            ops.push(
              prisma.dcrInvoice.update({
                where: { id: invoice.id },
                data: updateHeaderData,
              })
            );
          }

          if (ops.length > 0) {
            await prisma.$transaction(ops);
          }

          // Reload from DB
          const enrichedInvoice = await prisma.dcrInvoice.findUnique({
            where: { id: invoice.id },
            include: {
              items: true,
              serialAllocations: true,
            },
          });
          return NextResponse.json({ invoice: enrichedInvoice });
        }
      } catch (err: any) {
        console.error('[GET Invoice Details] Failed to enrich items from Zoho:', err);
        // If the invoice has no items, it cannot be safely reviewed without them.
        if (hasNoItems) {
          return NextResponse.json(
            { error: `Failed to load invoice line items from Zoho Books: ${err.message || 'Network error'}. Please refresh or try again.` },
            { status: 502 }
          );
        }
      }
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('[DCR Invoice Details GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice details' }, { status: 500 });
  }
}

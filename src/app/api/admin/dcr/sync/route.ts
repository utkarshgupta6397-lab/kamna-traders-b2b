import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchInvoicesByRange, fetchInvoiceById } from '@/lib/zoho/invoices';
import { ensureCustomerExists } from '@/lib/dcr-customer-sync';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date_start, date_end } = await req.json();
    if (!date_start || !date_end) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
    }

    // Startup Safety Check
    const customerCount = await prisma.customer.count();
    if (customerCount === 0) {
      console.warn('[DCR Sync] Customer table is empty. Triggering background backfill...');
      // Fire and forget backfill
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetch(`${origin}/api/admin/dcr/backfill-customers`, { method: 'POST' }).catch(e => console.error('Backfill trigger failed:', e.message));
    }

    const { invoices, apiCallsUsed: syncCalls } = await fetchInvoicesByRange(date_start, date_end);

    if (syncCalls > 0) {
      await prisma.zohoApiLog.createMany({
        data: Array.from({ length: syncCalls }).map(() => ({
          endpoint: 'FETCH_INVOICES',
          module: 'DCR',
          userId: session.userId,
        }))
      });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const invoice of invoices) {
      const { invoice: fullInvoice, apiCallsUsed: detailCalls } = await fetchInvoiceById(invoice.invoice_id);

      if (detailCalls > 0) {
        await prisma.zohoApiLog.create({
          data: {
            endpoint: 'FETCH_INVOICE_DETAILS',
            module: 'DCR',
            userId: session.userId,
          }
        });
      }

      const existing = await prisma.dcrInvoice.findUnique({
        where: { zohoInvoiceId: fullInvoice.invoice_id },
      });

      // Ensure customer exists before ANY invoice insert/update
      await ensureCustomerExists({
        customerId: fullInvoice.customer_id,
        customerName: fullInvoice.customer_name,
      });

      if (existing) {
        // Update existing record
        const isLowValue = fullInvoice.total < 5000;
        await prisma.dcrInvoice.update({
          where: { id: existing.id },
          data: {
            invoiceStatus: fullInvoice.status,
            invoiceTotal: fullInvoice.total,
            syncedAt: new Date(),
            ...(isLowValue ? {
              dcrStatus: 'NO_DCR_REQUIRED',
              archived: true,
              processedAt: new Date(),
              processingReason: 'AUTO_LOW_VALUE'
            } : {})
          },
        });

        await prisma.dcrAuditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: existing.id,
            action: 'SYNC_UPDATE_FROM_ZOHO',
            userId: session.userId,
          },
        });

        updatedCount++;
      } else {
        // Create new record
        const isLowValue = fullInvoice.total < 5000;
        const newInvoice = await prisma.dcrInvoice.create({
          data: {
            zohoInvoiceId: fullInvoice.invoice_id,
            invoiceNumber: fullInvoice.invoice_number,
            customerId: fullInvoice.customer_id,
            customerName: fullInvoice.customer_name,
            invoiceDate: new Date(fullInvoice.date),
            invoiceStatus: fullInvoice.status,
            invoiceTotal: fullInvoice.total,
            dcrStatus: isLowValue ? 'NO_DCR_REQUIRED' : 'NEW',
            archived: isLowValue,
            processedAt: isLowValue ? new Date() : null,
            processingReason: isLowValue ? 'AUTO_LOW_VALUE' : null,
            items: {
              create: fullInvoice.line_items.map((item: any) => ({
                itemId: item.item_id,
                itemName: item.name,
                sku: item.sku || null,
                quantity: item.quantity,
                source: 'ZOHO',
              })),
            },
          },
        });

        await prisma.dcrAuditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: newInvoice.id,
            action: fullInvoice.total < 5000 ? 'SYNC_CREATE_AUTO_SKIPPED' : 'SYNC_CREATE_FROM_ZOHO',
            userId: session.userId,
          },
        });

        createdCount++;
      }
    }

    await prisma.dcrAuditLog.create({
      data: {
        entityType: 'SYNC_RUN',
        entityId: 'SYSTEM',
        action: 'SYNC_COMPLETE',
        userId: session.userId,
        metadata: {
          startDate: date_start,
          endDate: date_end,
          created: createdCount,
          updated: updatedCount,
        }
      }
    });

    return NextResponse.json({
      success: true,
      created: createdCount,
      updated: updatedCount,
    });
  } catch (error: any) {
    console.error('[DCR Sync API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync' }, { status: 500 });
  }
}

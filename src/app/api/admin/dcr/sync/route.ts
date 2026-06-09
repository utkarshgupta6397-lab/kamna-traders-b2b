import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchInvoicesByRange, fetchInvoiceById } from '@/lib/zoho/invoices';
import { ensureCustomerExists } from '@/lib/dcr-customer-sync';
import { isVoidInvoice } from '@/lib/dcr-utils';
import { ingestZohoInvoice } from '@/lib/dcr-ingestion';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    // if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    const userId = session?.userId || 'SYSTEM_TEST';

    const { date_start, date_end } = await req.json();
    console.log(`[DCR Sync Audit] Sync request received`);
    console.log(`[DCR Sync Audit] Date range: ${date_start} to ${date_end}`);
    
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
    console.log(`[DCR Sync Audit] Zoho invoices fetched: ${invoices.length}`);

    if (syncCalls > 0) {
      await prisma.zohoApiLog.createMany({
        data: Array.from({ length: syncCalls }).map(() => ({
          endpoint: 'FETCH_INVOICES',
          module: 'DCR',
          userId: userId,
        }))
      });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const invoice of invoices) {
      console.log(`[DCR Sync Audit] Start ingestion`);
      console.log(`[DCR Sync Audit] Invoice number: ${invoice.invoice_number}`);
      console.log(`[DCR Sync Audit] Invoice ID: ${invoice.invoice_id}`);
      try {
        const { action } = await ingestZohoInvoice(invoice.invoice_id, userId, 'ZOHO_SYNC');
        console.log(`[DCR Sync Audit] End ingestion for ${invoice.invoice_id} with action: ${action}`);
        if (action === 'CREATED') createdCount++;
        if (action === 'UPDATED') updatedCount++;
      } catch (err: any) {
        console.error(`[DCR Sync Audit] Ingestion failed for ${invoice.invoice_id}`, err.stack);
        throw err;
      }
    }

    await prisma.dcrAuditLog.create({
      data: {
        entityType: 'SYNC_RUN',
        entityId: 'SYSTEM',
        action: 'SYNC_COMPLETE',
        userId: userId,
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

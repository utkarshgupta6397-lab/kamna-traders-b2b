import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ingestZohoInvoice } from '@/lib/dcr-ingestion';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceIds } = await req.json();
    if (!invoiceIds || !Array.isArray(invoiceIds)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    let imported = 0;
    let failed = 0;
    const results = [];

    for (const invoiceId of invoiceIds) {
      try {
        console.log(`[Manual Import API] Starting ingestion for Zoho ID: ${invoiceId}`);
        const { action, invoice } = await ingestZohoInvoice(invoiceId, session.userId, 'MANUAL');
        
        if (action === 'CREATED' || action === 'UPDATED') {
          imported++;
          results.push({
            invoiceId,
            invoiceNumber: invoice?.invoiceNumber || invoiceId,
            status: 'SUCCESS',
            reason: action
          });
          console.log(`[Manual Import API] Ingestion complete for ${invoice?.invoiceNumber} (${action})`);
        } else {
          failed++;
          results.push({
            invoiceId,
            invoiceNumber: invoiceId,
            status: 'FAILED',
            reason: `Skipped: ${action}`
          });
          console.log(`[Manual Import API] Ingestion skipped/failed for ${invoiceId}: ${action}`);
        }
      } catch (err: any) {
        console.error(`[Manual Import API] Error importing invoice ${invoiceId}:`, err);
        failed++;
        results.push({
          invoiceId,
          invoiceNumber: invoiceId,
          status: 'FAILED',
          reason: err.message || 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      imported,
      alreadyImported: 0,
      notFound: 0,
      failed,
      results
    });

  } catch (error: any) {
    console.error('[Manual Import Error]:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { runSkuSync } from '@/lib/sku-sync';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Verify CRON_SECRET for security
  // We check for ?secret= parameter for compatibility with external cron services
  if (!secret || secret !== process.env.CRON_SECRET) {
    console.warn('[Cron] Unauthorized attempt to trigger SKU sync');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('[Cron] Starting SKU sync via external trigger...');
    const result = await runSkuSync();
    console.log('[Cron] External SKU sync completed:', result);
    
    return NextResponse.json({
      success: true,
      summary: result
    });
  } catch (error: any) {
    console.error('[Cron] External SKU sync failed:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}

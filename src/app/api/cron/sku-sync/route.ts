import { NextResponse } from 'next/server';
import { runSkuSync } from '@/lib/sku-sync';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (!secret || secret !== process.env.CRON_SECRET) {
    console.warn('[Cron] Unauthorized attempt to trigger SKU sync');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const limit = parseInt(searchParams.get('limit') || '0', 10);

    console.log('[Cron] Starting scheduled SKU sync...');
    const result = await runSkuSync({ 
      limit, 
      trigger: 'CRON' 
    });
    
    return NextResponse.json({
      success: true,
      summary: result
    });
  } catch (error: any) {
    console.error('[Cron] SKU sync failed:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}

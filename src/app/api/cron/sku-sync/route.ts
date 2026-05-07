import { NextResponse } from 'next/server';
import { runSkuSync } from '@/lib/sku-sync';

export async function GET(request: Request) {
  // Verify CRON_SECRET for security
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('[Cron] Starting SKU sync...');
    const result = await runSkuSync();
    console.log('[Cron] SKU sync completed:', result);
    
    return NextResponse.json({
      success: true,
      summary: result
    });
  } catch (error: any) {
    console.error('[Cron] SKU sync failed:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}

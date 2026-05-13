import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { runSkuSync } from '@/lib/sku-sync';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === 'number' ? body.limit : 0;

    const result = await runSkuSync({ 
      limit, 
      trigger: 'USER' 
    });

    return NextResponse.json({
      success: true,
      summary: result
    });
  } catch (error: any) {
    console.error('[Admin Sync] Manual run failed:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}

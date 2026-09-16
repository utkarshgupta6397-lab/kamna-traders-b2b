import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasDesktopPostDispatchReviewAccess } from '@/lib/post-dispatch-auth';
import { ProductLookupService } from '@/lib/services/ProductLookupService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDesktopPostDispatchReviewAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 50);

  if (query.length < 2) return NextResponse.json({ skus: [] });

  try {
    // Canonical product lookup matching "Adjust Inventory" behavior — source of truth is Product -> ProductVariant
    const rawItems = await ProductLookupService.search('inventory', {
      query,
      includeInactive: false,
    });

    const skus = rawItems.slice(0, limit).map((item) => ({
      id: item.sku || item.id,
      name: item.name,
      unit: item.unitShort || item.unit || 'Units',
      code: item.code || item.sku || item.id,
      isDecimal: Boolean(item.isDecimal),
    }));

    return NextResponse.json({
      skus,
    });
  } catch (error) {
    console.error('[SKU Search]', error);
    return NextResponse.json({ error: 'Failed to search SKUs' }, { status: 500 });
  }
}

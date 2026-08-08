import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { ZohoProductService } from '@/lib/services/zoho-books';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.catalog_products_sync)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const itemId = searchParams.get('itemId');

  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
  }

  try {
    const item = await ZohoProductService.fetchItem(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Item not found in Zoho Books' }, { status: 404 });
    }

    return NextResponse.json({
      name: item.name,
      sku: item.sku,
      status: item.status,
      product_type: item.product_type,
      rate: item.rate,
      purchase_rate: item.purchase_rate
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products/${id}/zoho/fetch error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

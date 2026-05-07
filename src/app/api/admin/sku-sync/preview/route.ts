import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getZohoSyncUrl } from '@/lib/zoho';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const zohoUrl = getZohoSyncUrl();
    if (!zohoUrl) {
      return NextResponse.json({ error: 'Zoho sync environment variables missing' }, { status: 503 });
    }

    const response = await fetch(zohoUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Zoho API returned an error status:', response.status);
      return NextResponse.json({ error: 'Failed to fetch from Zoho' }, { status: 502 });
    }

    const data = await response.json();
    const skus = data?.result?.data;

    if (!Array.isArray(skus) || skus.length === 0) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    const normalizedData = skus.map((sku: any) => ({
      skuId: sku.sku_id || '',
      name: sku.name || '',
      brand: sku.brand || '',
      category: sku.category || '',
      price: typeof sku.price === 'number' ? sku.price : parseFloat(sku.price) || 0,
      caseSize: typeof sku.case_size === 'number' ? sku.case_size : parseInt(sku.case_size, 10) || 1,
      uom: sku.uom || '',
      status: sku.status || '',
      zohoBookItemId: sku.zoho_book_item_id ? sku.zoho_book_item_id.toString() : null,
    }));

    return NextResponse.json({
      success: true,
      count: normalizedData.length,
      data: normalizedData,
    });

  } catch (error) {
    console.error('Error fetching Zoho SKUs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

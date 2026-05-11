import { prisma } from '@/lib/db';
import { getZohoTokens } from '@/lib/zoho-auth';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = await getZohoTokens();
  if (!accessToken) {
    return NextResponse.json({ error: 'Zoho not connected or token refresh failed' }, { status: 400 });
  }

  try {
    // 1. Fetch Active SKUs with Zoho IDs
    const activeSkus = await prisma.sku.findMany({
      where: {
        isActive: true,
        zohoBooksId2: { not: null }
      }
    });

    if (activeSkus.length === 0) {
      return NextResponse.json({ error: 'No active SKUs with Zoho Books IDs found' }, { status: 400 });
    }

    // 2. Prepare Payload
    const orgId = process.env.ZOHO_BOOKS_ORG_ID;
    const customerId = process.env.ZOHO_BOOKS_CUSTOMER_ID;
    const salespersonId = process.env.ZOHO_BOOKS_SALESPERSON_ID || '1759923000001693003';
    const timestamp = Date.now();
    
    const payload = {
      customer_id: customerId,
      salesperson_id: salespersonId,
      reference_number: `TEST-SO-${timestamp}`,
      date: new Date().toISOString().split('T')[0],
      line_items: activeSkus.map(sku => ({
        item_id: sku.zohoBooksId2,
        quantity: 5,
        rate: sku.price
      }))
    };

    // 3. Call Zoho API
    const orgId = process.env.ZOHO_ORGANIZATION_ID || "60027595766";
    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
    const url = `${apiBase}/books/v3/salesorders?organization_id=${orgId}`;
    
    const finalPayload = {
      customer_id: process.env.DEFAULT_CUSTOMER_ID || "1759923000000023423",
      salesperson_id: process.env.DEFAULT_SALESPERSON_ID || "1759923000001693003",
      reference_number: payload.reference_number,
      date: payload.date,
      line_items: payload.line_items,
    };

    console.log('FETCH URL', url);
    console.log('FETCH BODY', JSON.stringify(finalPayload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalPayload)
    });

    const data = await response.json();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      payload: finalPayload,
      response: data,
      skuCount: activeSkus.length
    });

  } catch (error: any) {
    console.error('[ZohoSO] Error creating test SO:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const { lineItemId, itemId, newRate } = await request.json();

    if (!lineItemId || !itemId || newRate === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id }
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const accessToken = await getZohoTokens();
    const orgId = getZohoOrgId();

    if (!accessToken) {
      return NextResponse.json({ error: 'Zoho not authorized' }, { status: 401 });
    }

    // 1. Fetch latest Sales Order
    const getRes = await fetch(`${API_BASE_URL}/books/v3/salesorders/${order.zohoSalesorderId}?organization_id=${orgId}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });

    if (!getRes.ok) {
      const errText = await getRes.text();
      console.error('[Zoho API Fetch SO Error]', errText);
      return NextResponse.json({ error: 'Failed to fetch SO from Zoho', details: errText }, { status: 502 });
    }

    const getJson = await getRes.json();
    const so = getJson.salesorder;

    // 2. Extract line items and find target
    const lineItems = so.line_items || [];
    let found = false;

    const updatedLineItems = lineItems.map((item: any) => {
      const clone = { ...item };
      
      // Remove read-only fields that Zoho rejects on PUT
      delete clone.quantity_manuallyfulfilled;
      
      if (item.line_item_id === lineItemId) {
        found = true;
        clone.rate = newRate;
      }
      return clone;
    });

    if (!found) {
      return NextResponse.json({ error: 'Line item not found in Zoho' }, { status: 404 });
    }

    // 3. Construct update payload
    const payload = {
      customer_id: so.customer_id,
      line_items: updatedLineItems
    };

    // 4. Update Sales Order
    const putRes = await fetch(`${API_BASE_URL}/books/v3/salesorders/${order.zohoSalesorderId}?organization_id=${orgId}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error('[Zoho API Update SO Error]', errText);
      return NextResponse.json({ error: 'Failed to update rate in Zoho', details: errText }, { status: putRes.status === 400 ? 400 : 502 });
    }

    const putJson = await putRes.json();
    
    // 5. Update local details json cache if we can
    await prisma.dispatchIncomingOrder.update({
      where: { id },
      data: {
        zohoDetailsJson: putJson.salesorder || so
      }
    });

    return NextResponse.json({ success: true, message: 'Rate updated successfully' });

  } catch (error: any) {
    console.error('[Rate Update Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

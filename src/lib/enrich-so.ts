import { prisma } from '@/lib/db';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';

export async function enrichSalesOrder(salesorderId: string, dbId: string, requestId: string) {
  try {
    // Set to pending initially
    await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: { detailsStatus: 'PENDING', detailsFetchError: null }
    });

    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();
    
    console.log(`[INCOMING SO][${requestId}] Fetching Zoho Sales Order details...`);
    
    if (!orgId || !accessToken) {
      throw new Error('Missing Zoho credentials');
    }

    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
    const url = `${apiBase}/books/v3/salesorders/${salesorderId}?organization_id=${orgId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
       const errorText = await response.text().catch(() => '');
       throw new Error(`Zoho fetch failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (!data.salesorder) {
       throw new Error('Sales Order not found in Zoho response');
    }

    console.log(`[INCOMING SO][${requestId}] Zoho fetch: SUCCESS`);

    const so = data.salesorder;
    // Safe parse floats to avoid NaN in DB and UI
    let rawTax = so.tax_total !== undefined ? so.tax_total : so.total_tax;
    let totalTax = parseFloat(rawTax);
    if (isNaN(totalTax)) totalTax = 0;
    
    let parsedTotal = parseFloat(so.total);
    if (isNaN(parsedTotal)) parsedTotal = 0;
    
    let totalItems = 0;
    if (Array.isArray(so.line_items)) {
      // Use the sum of line item quantities as specifically requested
      totalItems = so.line_items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    }

    const updated = await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: {
        salesorderNumber: so.salesorder_number,
        customerName: so.customer_name,
        total: parsedTotal,
        currencyCode: so.currency_code || 'INR',
        totalItems,
        totalTax,
        totalUniqueRows: Array.isArray(so.line_items) ? so.line_items.length : 0,
        customerId: so.customer_id,
        customerGst: so.gst_no || so.gst_number || "",
        zohoDetailsJson: so,
        detailsStatus: 'FETCHED',
        detailsFetchedAt: new Date(),
        detailsFetchError: null
      }
    });

    console.log(`[INCOMING SO][${requestId}] Final database update successful.`);
    
    // Emit update event so UI re-renders with enriched data
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updated);
    
    return updated;

  } catch (err: any) {
    console.error(`[INCOMING SO][${requestId}] Zoho fetch failed or DB update failed:`, err);
    
    await prisma.incomingSoRequest.create({
      data: {
        salesorder_id: salesorderId,
        status: 'FAILED',
        error_message: err.message || 'Failed to enrich Sales Order from Zoho',
      },
    });

    // Save error state in the incoming order record
    const failedUpdate = await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: {
        detailsStatus: 'FAILED',
        detailsFetchError: err.message || 'Failed to enrich Sales Order'
      }
    });
    
    // Emit update event so UI shows the FAILED state
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, failedUpdate);
    
    throw err;
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';


// Helper function to enrich data asynchronously
import { enrichSalesOrder } from '@/lib/enrich-so';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(2, 9);
  console.log(`[INCOMING SO][${requestId}] Incoming request received`);

  try {
    const apiKey = request.headers.get('x-api-key');
    
    // Check DB first
    const dbConfig = await prisma.integrationConfig.findUnique({
      where: { key: 'INCOMING_SO_API_KEY' }
    });
    
    const configuredKey = dbConfig?.value || process.env.INCOMING_SO_API_KEY;

    if (!configuredKey || apiKey !== configuredKey) {
      console.log(`[INCOMING SO][${requestId}] Request validation result: FAILED (Auth)`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid or missing API Key.', requestId },
        { status: 401 }
      );
    }

    console.log(`[INCOMING SO][${requestId}] Request validation result: SUCCESS`);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.log(`[INCOMING SO][${requestId}] JSON parse failed.`);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.', requestId },
        { status: 400 }
      );
    }

    if (body.test_connection === true) {
      console.log(`[INCOMING SO][${requestId}] Test connection successful.`);
      return NextResponse.json(
        { success: true, message: 'Connection test successful. API is reachable and authenticated.', requestId },
        { status: 200 }
      );
    }

    const { salesorder_id } = body;
    console.log(`[INCOMING SO][${requestId}] salesorder_id received: ${salesorder_id}`);

    if (!salesorder_id || typeof salesorder_id !== 'string' || salesorder_id.trim() === '') {
      console.log(`[INCOMING SO][${requestId}] Missing or invalid salesorder_id.`);
      await prisma.incomingSoRequest.create({
        data: {
          salesorder_id: 'UNKNOWN',
          status: 'FAILED',
          error_message: 'Missing or invalid salesorder_id',
        },
      });
      return NextResponse.json(
        { success: false, error: 'Missing or invalid salesorder_id.', requestId },
        { status: 400 }
      );
    }

    // Save raw request
    await prisma.incomingSoRequest.create({
      data: {
        salesorder_id: salesorder_id.trim(),
        status: 'RECEIVED',
      },
    });

    const cleanId = salesorder_id.trim();

    // Check if it already exists
    let dispatchOrder = await prisma.dispatchIncomingOrder.findUnique({
      where: { zohoSalesorderId: cleanId }
    });

    if (!dispatchOrder) {
      console.log(`[INCOMING SO][${requestId}] Incoming record created`);
      
      // PERSIST FIRST
      dispatchOrder = await prisma.dispatchIncomingOrder.create({
        data: {
          zohoSalesorderId: cleanId,
          status: 'NEW'
        }
      });
      
      // Emit initial creation SSE event
      dispatchEventEmitter.emit(DISPATCH_EVENTS.NEW_INCOMING_ORDER, dispatchOrder);

      // FIRE AND FORGET ENRICHMENT
      enrichSalesOrder(cleanId, dispatchOrder.id, requestId).catch(console.error);
    } else {
      console.log(`[INCOMING SO][${requestId}] Existing record found. Retrying enrichment.`);
      
      const isRePush = dispatchOrder.status === 'SENT_BACK_TO_OPS';
      
      if (isRePush) {
        dispatchOrder = await prisma.dispatchIncomingOrder.update({
          where: { zohoSalesorderId: cleanId },
          data: { status: 'NEW', updatedAt: new Date() }
        });
        
        // Emit as a "new" order again so the frontend plays the sound and highlights it
        const repushEventOrder = { ...dispatchOrder, _isRePush: true, _rePushTimestamp: Date.now() };
        dispatchEventEmitter.emit(DISPATCH_EVENTS.NEW_INCOMING_ORDER, repushEventOrder);
      } else {
        dispatchOrder = await prisma.dispatchIncomingOrder.update({
          where: { zohoSalesorderId: cleanId },
          data: { updatedAt: new Date() }
        });
      }
      
      // Always re-trigger enrichment to heal incomplete records or refresh data
      enrichSalesOrder(cleanId, dispatchOrder.id, requestId).catch(console.error);
    }

    // === LOCK ZOHO SALES ORDER ===
    try {
      const orgId = getZohoOrgId();
      const accessToken = await getZohoTokens();
      const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

      if (!accessToken) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
            details: { message: 'No valid Zoho OAuth token found.' },
            salesOrderId: cleanId
          }, { status: 502 }
        );
      }

      // 1. Fetch SO to check current lock status & get custom fields
      const getRes = await fetch(`${apiBase}/books/v3/salesorders/${cleanId}?organization_id=${orgId}`, {
        headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
      });
      
      if (!getRes.ok) {
         return NextResponse.json(
          { 
            success: false, 
            error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
            details: { status: getRes.status, message: 'Failed to fetch SO from Zoho' },
            salesOrderId: cleanId
          }, { status: 502 }
        );
      }
      const soJson = await getRes.json();
      const so = soJson.salesorder;

      let cfLockedId = null;
      if (so.custom_fields) {
        const field = so.custom_fields.find((f: any) => f.placeholder === 'cf_is_locked' || f.label === 'Is Locked' || f.label === 'cf_is_locked');
        if (field) cfLockedId = field.customfield_id || field.field_id;
      }

      if (!cfLockedId) {
        const cfMetaRes = await fetch(`${apiBase}/books/v3/settings/fields?entity=salesorder&organization_id=${orgId}`, {
          headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        if (cfMetaRes.ok) {
          const cfMetaJson = await cfMetaRes.json();
          const field = cfMetaJson.fields?.find((f: any) => f.placeholder === 'cf_is_locked' || f.column_name === 'cf_is_locked' || f.field_name === 'cf_is_locked' || f.api_name === 'cf_is_locked');
          if (field) cfLockedId = field.customfield_id || field.field_id;
        }
      }

      if (!cfLockedId) {
         return NextResponse.json({ 
            success: false, 
            error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
            details: { message: 'Could not resolve customfield_id for cf_is_locked.' }
          }, { status: 500 });
      }
      
      // Check if it's already locked (Idempotency)
      const currentLockField = so.custom_fields?.find((f: any) => f.customfield_id === cfLockedId || f.field_id === cfLockedId);
      if (!currentLockField || (currentLockField.value !== true && currentLockField.value !== 'true')) {
          // Need to lock
          const cfPayload = {
              custom_fields: [{
                customfield_id: cfLockedId,
                value: true
              }]
          };

          const cfUpdateRes = await fetch(`${apiBase}/books/v3/salesorder/${cleanId}/customfields?organization_id=${orgId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(cfPayload)
          });

          let cfTxt = '';
          if (!cfUpdateRes.ok) {
              cfTxt = await cfUpdateRes.text().catch(() => '');
              return NextResponse.json({ 
                  success: false, 
                  error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
                  details: { status: cfUpdateRes.status, message: cfTxt }
              }, { status: 502 });
          } else {
              // Also check for code === 0 in case of 200 with error inside JSON
              cfTxt = await cfUpdateRes.text().catch(() => '');
              try {
                const cfJson = JSON.parse(cfTxt);
                if (cfJson.code !== 0) {
                  return NextResponse.json({ 
                      success: false, 
                      error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
                      details: { status: cfUpdateRes.status, message: cfTxt }
                  }, { status: 502 });
                }
              } catch(e) {}
          }
          
          // Final Verification
          const verifyRes = await fetch(`${apiBase}/books/v3/salesorders/${cleanId}?organization_id=${orgId}`, {
            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
          });
          
          if (!verifyRes.ok) {
              return NextResponse.json({ 
                  success: false, 
                  error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
                  details: { status: verifyRes.status, message: 'Verification fetch failed' }
              }, { status: 502 });
          }
          const verifyJson = await verifyRes.json();
          const finalSo = verifyJson.salesorder;
          const finalLockField = finalSo?.custom_fields?.find((f: any) => f.customfield_id === cfLockedId || f.field_id === cfLockedId);
          const finalVal = finalLockField ? finalLockField.value : false;
          
          if (finalVal !== true && finalVal !== 'true') {
              return NextResponse.json({
                  success: false,
                  error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
                  details: { message: `Verification failed: cf_is_locked is still ${finalVal}` }
              }, { status: 502 });
          }
      }
    } catch (lockError: any) {
      console.error(`[INCOMING SO][${requestId}] Lock error:`, lockError);
      return NextResponse.json({ 
          success: false, 
          error: 'Sales Order was pushed to ERP, but Zoho Books locking failed.',
          details: { message: lockError?.message || 'Unknown lock error' }
      }, { status: 500 });
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Sales Order accepted for Dispatch and successfully locked in Zoho.',
        salesOrderId: cleanId,
        incomingOrderId: dispatchOrder.id
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error(`[INCOMING SO][${requestId}] Unhandled error:`, error);
    
    // Attempt to log failure safely
    try {
      await prisma.incomingSoRequest.create({
        data: {
          salesorder_id: 'UNKNOWN',
          status: 'FAILED',
          error_message: error?.message?.substring(0, 500) || 'Internal Server Error',
        },
      });
    } catch (dbErr) {
      console.error(`[INCOMING SO][${requestId}] Fatal DB logging failed:`, dbErr);
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error.', requestId },
      { status: 500 }
    );
  }
}

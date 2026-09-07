import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authorize Dispatch user
  if (session.role !== 'ADMIN' && !session.dispatch_view) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Must not be already sent back
    if (order.status === 'SENT_BACK_TO_OPS') {
      return NextResponse.json({ error: 'Order is already sent back.' }, { status: 400 });
    }

    // Check if mock / test order (not in Zoho Books)
    const isMockTestOrder =
      order.zohoSalesorderId.startsWith('zoho_test_') ||
      order.id.startsWith('test_') ||
      process.env.NODE_ENV !== 'production' && order.zohoSalesorderId.includes('test');

    if (isMockTestOrder) {
      const updatedOrder = await prisma.dispatchIncomingOrder.update({
        where: { id },
        data: {
          status: 'SENT_BACK_TO_OPS',
          updatedAt: new Date()
        },
        include: {
          preDispatchWorkflow: true,
          truckUpload: true
        }
      });

      dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updatedOrder);

      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        message: 'Sales Order sent back to Operations successfully.'
      });
    }

    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();
    if (!accessToken) {
      return NextResponse.json({ error: 'Zoho connection required. Reauthorization may be needed for required scopes (ZohoBooks.salesorders.UPDATE, ZohoBooks.salesorders.CREATE).' }, { status: 401 });
    }
    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
    const salesorderId = order.zohoSalesorderId;

    // 1. Fetch latest Sales Order to verify eligibility
    const getRes = await fetch(`${apiBase}/books/v3/salesorders/${salesorderId}?organization_id=${orgId}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });
    
    if (!getRes.ok) {
      if (getRes.status === 404) {
        // If order doesn't exist in Zoho (e.g. seeded/purged/test), still allow ERP send-back
        const updatedOrder = await prisma.dispatchIncomingOrder.update({
          where: { id },
          data: {
            status: 'SENT_BACK_TO_OPS',
            updatedAt: new Date()
          },
          include: {
            preDispatchWorkflow: true,
            truckUpload: true
          }
        });

        dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updatedOrder);

        return NextResponse.json({
          success: true,
          status: 'SUCCESS',
          message: 'Sales Order not found in Zoho, but successfully marked as Sent Back in ERP.'
        });
      }
      return NextResponse.json({ error: `Failed to fetch Sales Order from Zoho: ${getRes.status}` }, { status: 502 });
    }
    
    const getJson = await getRes.json();
    const so = getJson.salesorder;

    let partialFailures = [];

    // 2. Update Substatus to cs_editreq
    const substatusRes = await fetch(`${apiBase}/books/v3/salesorders/${salesorderId}/substatus/cs_editreq?organization_id=${orgId}`, {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });
    
    if (!substatusRes.ok) {
      const errTxt = await substatusRes.text().catch(() => '');
      // Zoho returns 400 with code 252006 if the substatus is already set to the requested value.
      // In this case, we consider it a success/no-op rather than a failure.
      if (!errTxt.includes('"code":252006') && !errTxt.includes('same required status')) {
        partialFailures.push(`Substatus update failed: ${substatusRes.status} ${errTxt}`);
      }
    }

    // 3. Resolve customfield_id and Update cf_is_locked to false
    let cfLockedId = null;
    
    // First try to find it in the fetched SO custom fields
    if (so.custom_fields) {
      const field = so.custom_fields.find((f: any) => f.placeholder === 'cf_is_locked' || f.label === 'Is Locked' || f.label === 'cf_is_locked');
      if (field) cfLockedId = field.customfield_id;
    }

    // If not found in SO, fetch from settings
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

    if (cfLockedId) {
      const cfPayload = {
        custom_fields: [{
          customfield_id: cfLockedId,
          value: false
        }]
      };

      console.log('[DEBUG Send Back] Attempting custom field update:', JSON.stringify({
        salesorderId,
        customfieldId: cfLockedId,
        fieldLabel: so.custom_fields?.find((f: any) => f.customfield_id === cfLockedId)?.label || 'cf_is_locked',
        payload: cfPayload
      }));

      // NOTE: Using the standard PUT endpoint instead if customfields endpoint is silently failing, 
      // but following instructions to inspect first. I'll stick to the requested endpoint, but log response strictly.
      const cfUpdateRes = await fetch(`${apiBase}/books/v3/salesorder/${salesorderId}/customfields?organization_id=${orgId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cfPayload)
      });
      
      const cfTxt = await cfUpdateRes.text().catch(() => '');
      console.log('[DEBUG Send Back] Custom field update response:', cfUpdateRes.status, cfTxt);
      
      let isCfSuccess = false;
      try {
         const cfJson = JSON.parse(cfTxt);
         if (cfJson.code === 0) isCfSuccess = true;
      } catch (e) {}

      if (!cfUpdateRes.ok || !isCfSuccess) {
        partialFailures.push(`Custom field update failed: ${cfUpdateRes.status} ${cfTxt}`);
      }
    } else {
      partialFailures.push(`Could not resolve customfield_id for cf_is_locked.`);
    }

    // 4. Add Comment
    const formattedComment = `${session.name || 'Unknown User'} : ${comment.trim()}`;
    const commentRes = await fetch(`${apiBase}/books/v3/salesorders/${salesorderId}/comments?organization_id=${orgId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description: formattedComment })
    });

    if (!commentRes.ok) {
      const errTxt = await commentRes.text().catch(() => '');
      partialFailures.push(`Comment creation failed: ${commentRes.status} ${errTxt}`);
    }

    if (partialFailures.length > 0) {
      return NextResponse.json({ 
        success: false, 
        status: 'PARTIAL_FAILURE', 
        message: 'Some Zoho updates failed.', 
        details: partialFailures 
      }, { status: 207 });
    }

    // 5. Verify final state by re-fetching
    const verifyRes = await fetch(`${apiBase}/books/v3/salesorders/${salesorderId}?organization_id=${orgId}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });
    
    if (!verifyRes.ok) {
      return NextResponse.json({ 
        success: false, 
        status: 'PARTIAL_FAILURE', 
        message: 'All updates sent, but final verification fetch failed.', 
        details: [`Verification fetch failed: ${verifyRes.status}`] 
      }, { status: 207 });
    }

    const verifyJson = await verifyRes.json();
    const finalSo = verifyJson.salesorder;
    const finalLockField = finalSo?.custom_fields?.find((f: any) => f.customfield_id === cfLockedId || f.field_id === cfLockedId);
    const finalVal = finalLockField ? finalLockField.value : false; // Omitted means false for checkboxes
    console.log('[DEBUG Send Back] Final verification:', JSON.stringify({ 
      sub_status: finalSo.sub_status, 
      cf_is_locked_val: finalVal 
    }));

    if (finalVal !== false && finalVal !== 'false') {
       return NextResponse.json({
         success: false,
         status: 'PARTIAL_FAILURE',
         message: 'Sales Order moved to cs_editreq, but cf_is_locked could not be updated.',
         details: [`Verification failed: cf_is_locked is still ${finalVal}`]
       }, { status: 207 });
    }

    // 6. Update local ERP DB state
    const updatedOrder = await prisma.dispatchIncomingOrder.update({
      where: { id },
      data: {
        status: 'SENT_BACK_TO_OPS',
        updatedAt: new Date(),
      },
      include: {
        preDispatchWorkflow: true,
        truckUpload: true,
      },
    });

    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updatedOrder);

    return NextResponse.json({ 
      success: true, 
      status: 'SUCCESS',
      message: 'Sales Order sent back to Operations successfully.'
    });

  } catch (error: any) {
    console.error('[Send Back API Error]', error);
    return NextResponse.json({ success: false, status: 'FAILED', error: 'Internal Server Error' }, { status: 500 });
  }
}

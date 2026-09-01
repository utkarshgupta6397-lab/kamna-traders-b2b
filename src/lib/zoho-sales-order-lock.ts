import { prisma } from '@/lib/db';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';
import { buildZohoCustomFieldsPayload, getSalesOrderCustomFieldsMetadata } from '@/lib/zoho-custom-fields';

export async function lockZohoSalesOrder(dbId: string, salesorderId: string) {
  try {
    // 1. Mark as PENDING
    await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: {
        zohoLockStatus: 'PENDING',
        zohoLockAttemptedAt: new Date(),
        zohoLockError: null,
      }
    });

    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();
    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

    // 2. Build Payload
    const customFieldsToUpdate = { cf_is_locked: true };
    const cfPayload = await buildZohoCustomFieldsPayload(customFieldsToUpdate);
    
    if (cfPayload.length === 0) {
      throw new Error("Could not resolve custom field ID for cf_is_locked.");
    }

    const payloadObj = { custom_fields: cfPayload };

    // 3. Perform PUT
    const putUrl = `${apiBase}/books/v3/salesorders/${salesorderId}?organization_id=${orgId}`;
    const putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payloadObj)
    });

    const putStatus = putResponse.status;
    let putJson = null;
    let putError = null;

    try {
      putJson = await putResponse.json();
    } catch (e) {
      putError = await putResponse.text().catch(() => 'Failed to parse PUT response');
    }

    if (!putResponse.ok && !putError) {
      putError = putJson?.message || `HTTP ${putStatus}`;
    }

    // Update with PUT results
    let updatedRecord = await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: {
        zohoLockRequestJson: payloadObj,
        zohoLockPutResponseJson: putJson || putError,
        zohoLockHttpStatus: putStatus,
      }
    });

    let lockStatusBeforeVerification = 'PENDING';
    if (!putResponse.ok) {
      lockStatusBeforeVerification = 'FAILED';
      updatedRecord = await prisma.dispatchIncomingOrder.update({
        where: { id: dbId },
        data: {
          zohoLockError: putError || 'PUT operation failed.'
        }
      });
    }

    // 4. Perform VERIFICATION GET
    const getUrl = `${apiBase}/books/v3/salesorders/${salesorderId}?organization_id=${orgId}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!getResponse.ok) {
      const getErr = await getResponse.text().catch(() => '');
      updatedRecord = await prisma.dispatchIncomingOrder.update({
        where: { id: dbId },
        data: {
          zohoLockStatus: 'VERIFICATION_FAILED',
          zohoLockError: `Verification GET failed: ${getResponse.status} ${getErr}`
        }
      });
      dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updatedRecord);
      return updatedRecord;
    }

    const getJson = await getResponse.json();
    const verifiedOrder = getJson.salesorder;
    
    // Resolve CF metadata again to know exactly which ID to check
    const metadata = await getSalesOrderCustomFieldsMetadata();
    const fieldMeta = metadata.find(f => f.placeholder === 'cf_is_locked' || f.label === 'cf_is_locked' || f.label === 'Is Locked');
    
    let isLocked = false;
    if (verifiedOrder?.custom_fields && fieldMeta) {
      const fieldData = verifiedOrder.custom_fields.find((f: any) => f.customfield_id === fieldMeta.customfield_id);
      if (fieldData) {
        // Zoho booleans might be true, "true", etc.
        isLocked = fieldData.value === true || fieldData.value === 'true';
      }
    }

    const finalStatus = isLocked ? 'SUCCESS' : 'VERIFICATION_FAILED';
    const finalError = isLocked ? null : 'PUT succeeded but verification GET returned cf_is_locked false or missing.';

    updatedRecord = await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: {
        zohoLockStatus: finalStatus,
        zohoLockValue: isLocked,
        zohoLockVerifiedAt: new Date(),
        zohoLockVerificationResponseJson: getJson,
        zohoLockError: finalError
      }
    });

    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updatedRecord);
    return updatedRecord;

  } catch (err: any) {
    const errorMsg = err.message || 'Unknown lock error occurred.';
    console.error(`[LOCK SERVICE] Error:`, err);
    
    const updatedRecord = await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: {
        zohoLockStatus: 'FAILED',
        zohoLockError: errorMsg
      }
    });
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updatedRecord);
    return updatedRecord;
  }
}

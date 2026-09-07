import { prisma } from '@/lib/db';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';

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

    // (The previous cf_is_locked PUT update logic was intentionally removed here)
    // Going forward, locking happens natively. This function now only verifies the lock status.
    
    // 2. Perform VERIFICATION GET
    const getUrl = `${apiBase}/books/v3/salesorders/${salesorderId}?organization_id=${orgId}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let updatedRecord = await prisma.dispatchIncomingOrder.findUnique({ where: { id: dbId } });

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
    
    // UI/DB Dependency Flag: The UI and database still track zohoLockStatus.
    // Since we must not guess at a replacement lock-status source (like 'is_locked' or 'is_closed'),
    // we default to false and report this dependency to the user.
    let isLocked = false; 

    const finalStatus = isLocked ? 'SUCCESS' : 'VERIFICATION_FAILED';
    const finalError = isLocked ? null : 'Native lock verification logic is not yet mapped to a specific Zoho Books response field.';

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

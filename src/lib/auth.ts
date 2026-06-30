import { cookies, headers } from 'next/headers';
import { encrypt, decrypt } from './jwt';
import { cache } from 'react';

export { encrypt, decrypt };

export async function createSession(params: {
  userId: string;
  role: string;
  deviceType: string;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  const start = performance.now();
  const { userId, role, deviceType, userAgent, ipAddress } = params;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  const sessionToken = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  console.log(`[Auth] Creating session for ${userId} (${role}). Token: ${sessionToken.slice(0, 8)}...`);

  const { registerSession } = await import('./session');
  await registerSession({
    userId,
    sessionToken,
    deviceType: deviceType as any,
    userAgent,
    ipAddress
  });

  const jwt = await encrypt({ userId, role, sessionToken, deviceType, expires: expires.toISOString() });
  const cookieStore = await cookies();
  cookieStore.set('session', jwt, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' });

  console.log(`[Perf] createSession: ${(performance.now() - start).toFixed(2)}ms`);
}

/**
 * REQUEST-LEVEL MEMOIZED SESSION RETRIEVAL
 * Ensures exactly ONE database validation per request lifecycle.
 * (Delegates TTL caching to validateSession in session.ts)
 */
export const getSession = cache(async (): Promise<Record<string, any> | null> => {
  const start = performance.now();
  
  if ((global as any).__SYSTEM_RESET_RUNNING__) return null;

  const cookieStore = await cookies();
  const jwt = cookieStore.get('session')?.value;
  if (!jwt) return null;
  
  try {
    const payload = await decrypt(jwt);
    const sessionToken = payload.sessionToken as string;

    if (!sessionToken) {
      console.log(`[Auth] No session token in JWT payload`);
      return payload;
    }

    // uses 5-min TTL cache internally in session.ts
    const { validateSession } = await import('./session');
    const validation = await validateSession(sessionToken);
    
    if (!validation.isValid) {
      console.warn(`[Auth] Session token ${sessionToken.slice(0, 8)} NOT valid in DB.`);
      return null;
    }

    const merged = { ...payload, ...(validation.permissions || {}) };

    // ── ADMIN OVERRIDE ──
    // If user is ADMIN, force full access
    if (merged.role === 'ADMIN') {
      merged.canManageCarts = true;
      merged.canAdjustInventory = true;
      merged.canRunSkuSync = true;
      merged.canManageZoneMappings = true;
      merged.canManageUnlimitedSkus = true;
      merged.canManageTransfers = true;
      merged.canDeleteTransfers = true;
      merged.accounts_customer_statement = true;
      merged.accounts_transactions = true;
      merged.accounts_summary_view = true;
      merged.stock_alerts_manage = true;
      merged.accounts_recovery_manage = true;
      merged.release_statement_queue = true;
      merged.dcr_management = true;
      merged.dcr_serial_mapping_override = true;
      merged.dcr_hold_release = true;
      merged.solar_orders_view = true;
      merged.solar_orders_create = true;
      merged.solar_orders_edit = true;
      merged.solar_orders_approve = true;
      merged.solar_orders_delete = true;
      merged.solar_documentation_view = true;
      merged.solar_documentation_edit = true;
      merged.solar_documentation_approve = true;
      merged.solar_installation_view = true;
      merged.solar_installation_complete = true;
      merged.solar_upload_documents = true;
      merged.solar_view_financials = true;
      merged.solar_manage_workflow = true;
    }

    console.log(`[Auth] getSession success for ${merged.userId} (Role: ${merged.role})`);
    return merged;
  } catch (err) {
    console.error(`[Auth] getSession error:`, err);
    return null;
  }
});

export async function logout() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get('session')?.value;
  
  if (jwt) {
    try {
      const payload = await decrypt(jwt);
      if (payload.sessionToken) {
        const { invalidateSession } = await import('./session');
        await invalidateSession(payload.sessionToken as string);
      }
    } catch (err) {
      // Ignore
    }
  }

  cookieStore.set('session', '', { expires: new Date(0) });
}

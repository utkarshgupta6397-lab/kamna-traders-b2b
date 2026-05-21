import { prisma } from './db';

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';
const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

console.log('ZOHO CONFIG', {
  org: process.env.ZOHO_ORGANIZATION_ID,
  apiBase: process.env.ZOHO_API_BASE_URL,
  accountsBase: process.env.ZOHO_ACCOUNTS_URL,
  redirect: process.env.ZOHO_REDIRECT_URI,
  hasCreatorUrl: !!process.env.ZOHO_CREATOR_SYNC_URL,
});

if (!CLIENT_ID || !CLIENT_SECRET || !process.env.ZOHO_REDIRECT_URI) {
  console.warn('[ZohoAuth] CRITICAL: Zoho OAuth credentials or ZOHO_REDIRECT_URI missing in environment variables.');
}

/**
 * Robustly retrieves the Zoho Organization ID from environment variables.
 * Prioritizes ZOHO_BOOKS_ORG_ID.
 */
export function getZohoOrgId(): string {
  const id = (process.env.ZOHO_BOOKS_ORG_ID || process.env.ZOHO_ORGANIZATION_ID || '').trim();
  return id;
}

export interface ZohoTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Appends a lifecycle checkpoint to the cart's execution trace.
 * This is critical for debugging serverless execution failures.
 */
export async function addZohoTrace(cartId: string, step: string) {
  const timestamp = new Date().toISOString();
  console.log(`[ZOHO TRACE][${cartId}] ${step} @ ${timestamp}`);
  
  try {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      select: { zohoExecutionTrace: true }
    });

    const currentTrace = Array.isArray(cart?.zohoExecutionTrace) 
      ? cart.zohoExecutionTrace as any[] 
      : [];
    
    const newTrace = [...currentTrace, { step, time: timestamp }];

    await prisma.cart.update({
      where: { id: cartId },
      data: { zohoExecutionTrace: newTrace }
    });
  } catch (err) {
    console.error(`[ZOHO TRACE][${cartId}] Failed to persist trace step ${step}:`, err);
  }
}

/**
 * Gets valid tokens from DB. Automatically refreshes if expired.
 */
export async function getZohoTokens(): Promise<string | null> {
  console.log('[ZohoAuth] Prisma models available:', Object.keys(prisma));
  const tokenRecord = await prisma.zohoToken.findUnique({
    where: { id: 'singleton' }
  });

  if (!tokenRecord) return null;

  const now = new Date();
  // Buffer of 5 minutes
  if (tokenRecord.expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokenRecord.accessToken;
  }

  // Refresh token
  console.log('[ZohoAuth] Access token expired, refreshing...');
  try {
    const response = await fetch(`${ACCOUNTS_URL}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenRecord.refreshToken,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        grant_type: 'refresh_token'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ZohoAuth] Refresh failed:', data);
      return null;
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    
    await prisma.zohoToken.update({
      where: { id: 'singleton' },
      data: {
        accessToken: data.access_token,
        expiresAt
      }
    });

    return data.access_token;
  } catch (error) {
    console.error('[ZohoAuth] Refresh error:', error);
    return null;
  }
}

/**
 * Exchanges auth code for tokens and saves to DB.
 */
export async function exchangeAuthCode(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[ZohoAuth] Attempting token exchange with code...');
    
    const params = new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: process.env.ZOHO_REDIRECT_URI!,
      grant_type: 'authorization_code'
    });

    const response = await fetch(`${ACCOUNTS_URL}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();
    console.log(`[ZohoAuth] Response Status: ${response.status}`);
    console.log('[ZohoAuth] Response Body:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('[ZohoAuth] Token exchange failed:', data);
      return { success: false, error: data.error || 'Token exchange failed' };
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    console.log('[ZohoAuth] Prisma models before upsert:', Object.keys(prisma));
    await prisma.zohoToken.upsert({
      where: { id: 'singleton' },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || undefined,
        expiresAt
      },
      create: {
        id: 'singleton',
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error('[ZohoAuth] Exchange error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}

export function getAuthorizationUrl(): string {
  const scopes = [
    'ZohoBooks.salesorders.CREATE',
    'ZohoBooks.items.READ',
    'ZohoBooks.contacts.READ',
    'ZohoBooks.invoices.READ',
    'ZohoBooks.customerpayments.READ',
    'ZohoBooks.bills.READ',
    'ZohoBooks.banking.READ'
  ];

  console.log('ZOHO REDIRECT URI', process.env.ZOHO_REDIRECT_URI);

  const params = new URLSearchParams({
    scope: scopes.join(','),
    client_id: CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.ZOHO_REDIRECT_URI!,
    access_type: 'offline',
    prompt: 'consent' // Required to get refresh_token
  });

  const authUrl = `${ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`;
  console.log('[ZOHO SCOPES]', scopes);
  console.log('FINAL_SCOPE_STRING=' + scopes.join(','));
  console.log('FINAL_AUTH_URL=' + authUrl);
  
  return authUrl;
}

/**
 * Creates a Zoho Books Sales Order from an internal dispatch cart with staged status updates.
 * This function is designed to be bulletproof with aggressive logging and persistence.
 */
export async function syncDispatchToZoho(cartId: string): Promise<{ success: boolean; error?: string; response?: any; payload?: any }> {
  const t0 = Date.now();
  console.log(`[ZOHO][PROD-SYNC][${cartId}] Lifecycle INITIATED`);
  await addZohoTrace(cartId, 'SYNC_WORKER_STARTED');
  
  // 0. Environment Validation
  const rawCustomerId = process.env.DEFAULT_CUSTOMER_ID || process.env.ZOHO_BOOKS_CUSTOMER_ID;
  const rawSalespersonId = process.env.DEFAULT_SALESPERSON_ID || process.env.ZOHO_BOOKS_SALESPERSON_ID;
  
  // PRIMARY SOURCE OF TRUTH FOR ORG ID
  const orgId = getZohoOrgId();
  const redirectUri = process.env.ZOHO_REDIRECT_URI;

  console.log(`[ZOHO][${cartId}] ENV_CHECK:`, {
    orgId_length: orgId.length,
    has_cert: !!process.env.ZOHO_CLIENT_ID,
    env_used: process.env.ZOHO_BOOKS_ORG_ID ? 'ZOHO_BOOKS_ORG_ID' : 'ZOHO_ORGANIZATION_ID'
  });

  // STRICT ID VALIDATION (Preventing JS precision loss)
  const validateId = (id: any, name: string) => {
    if (!id) return { valid: false, error: `${name} is missing` };
    const idStr = String(id).trim();
    // Zoho IDs in this org are typically 19 digits
    if (!/^\d{19}$/.test(idStr)) {
      return { 
        valid: false, 
        error: `${name} is invalid (expected 19 digits, got ${idStr.length}). Value: ${idStr}` 
      };
    }
    return { valid: true, value: idStr };
  };

  const customerCheck = validateId(rawCustomerId, 'DEFAULT_CUSTOMER_ID');
  const salespersonCheck = validateId(rawSalespersonId, 'DEFAULT_SALESPERSON_ID');

  if (!customerCheck.valid || !salespersonCheck.valid || !CLIENT_ID || !CLIENT_SECRET || !redirectUri || !orgId) {
    const errors = [];
    if (!customerCheck.valid) errors.push(customerCheck.error);
    if (!salespersonCheck.valid) errors.push(salespersonCheck.error);
    if (!CLIENT_ID) errors.push('ZOHO_CLIENT_ID missing');
    if (!CLIENT_SECRET) errors.push('ZOHO_CLIENT_SECRET missing');
    if (!redirectUri) errors.push('ZOHO_REDIRECT_URI missing');
    if (!orgId) errors.push('ZOHO_BOOKS_ORG_ID missing');
    
    const msg = `CRITICAL VALIDATION FAILED: ${errors.join(' | ')}`;
    console.error(`[ZOHO][${cartId}] ${msg}`);
    return { success: false, error: msg };
  }

  const customerId = customerCheck.value!;
  const salespersonId = salespersonCheck.value!;

  console.log(`[ZOHO][${cartId}] ID Validation Passed: Customer=${customerId}, Salesperson=${salespersonId}`);

  const updateStep = async (step: string, status: string = 'PENDING', extra: any = {}) => {
    console.log(`[ZOHO][${cartId}] STEP: ${step} (${status})`);
    try {
      await prisma.cart.update({
        where: { id: cartId },
        data: { 
          zohoSyncStep: step, 
          zohoSyncStatus: status,
          ...extra 
        }
      });
    } catch (dbErr) {
      console.error(`[ZOHO][${cartId}] DB Update Failed:`, dbErr);
    }
  };

  try {
    // 1. Fetching Cart & Checking for Duplicates
    console.log(`[ZOHO][${cartId}] Fetching cart and checking for duplicates...`);
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            sku: true
          }
        }
      }
    });

    if (!cart) {
      const msg = 'Cart not found in database';
      console.error(`[ZOHO][${cartId}] ${msg}`);
      await updateStep('FAILED', 'FAILED', { zohoSyncError: msg });
      return { success: false, error: msg };
    }

    // DUPLICATE PREVENTION: Skip if already synced
    if (cart.zohoSalesorderId) {
      console.log(`[ZOHO][${cartId}] Duplicate sync prevented. Sales Order already exists: ${cart.zohoSalesorderId}`);
      return { 
        success: true, 
        error: 'Order already synced', 
        response: cart.zohoResponse, 
        payload: cart.zohoPayload 
      };
    }

    // 2. Building Payload
    await addZohoTrace(cartId, 'PAYLOAD_BUILD_STARTED');
    console.log(`[ZOHO][${cartId}] Building payload...`);
    await updateStep('PREPARING_PAYLOAD');

    // Values already validated and logged at function start
    const payload: any = {
      customer_id: customerId,
      salesperson_id: salespersonId,
      reference_number: cart.dispatchSlipNumber,
      date: new Date(cart.createdAt).toISOString().split('T')[0],
      line_items: cart.items
        .filter(item => item.sku.zohoBooksId2)
        .map(item => ({
          item_id: item.sku.zohoBooksId2,
          quantity: item.qty,
          rate: item.sku.price
        }))
    };

    await addZohoTrace(cartId, 'PAYLOAD_BUILD_SUCCESS');

    if (payload.line_items.length === 0) {
      const msg = 'No SKUs with valid zohoBooksId2 found';
      console.warn(`[ZOHO][${cartId}] ${msg}`);
      await updateStep('FAILED', 'FAILED', { zohoSyncError: msg, zohoPayload: payload });
      return { success: false, error: msg, payload };
    }

    // CRITICAL: Save payload BEFORE the API call
    console.log(`[ZOHO][${cartId}] Payload ready (Auto-numbering ENABLED), saving to DB...`);
    await updateStep('REFRESHING_TOKEN', 'PENDING', { zohoPayload: payload });

    // 3. Token Refresh
    await addZohoTrace(cartId, 'TOKEN_LOOKUP_STARTED');
    console.log(`[ZOHO][${cartId}] Refreshing OAuth token...`);
    const accessToken = await getZohoTokens();
    if (!accessToken) {
      const msg = 'OAuth token refresh failed (no token returned)';
      console.error(`[ZOHO][${cartId}] ${msg}`);
      await addZohoTrace(cartId, 'TOKEN_LOOKUP_FAILED');
      await updateStep('FAILED', 'FAILED', { zohoSyncError: msg });
      return { success: false, error: msg, payload };
    }
    await addZohoTrace(cartId, 'TOKEN_FOUND');

    // 4. Sending Request
    await addZohoTrace(cartId, 'ZOHO_API_STARTED');
    console.log(`[ZOHO][${cartId}] Sending request to Zoho API...`);
    await updateStep('WAITING_FOR_ZOHO_RESPONSE');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    if (!orgId) {
      throw new Error("CRITICAL: ZOHO_BOOKS_ORG_ID is empty or undefined. Cannot construct API URL.");
    }

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

    const apiStartTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalPayload),
        signal: controller.signal
      });

      const responseTimeMs = Date.now() - apiStartTime;
      const data = await response.json();
      clearTimeout(timeout);

      console.log(`[ZOHO][${cartId}] Response received in ${responseTimeMs}ms. Status: ${response.status}`);
      if (response.ok) {
        await addZohoTrace(cartId, 'ZOHO_API_SUCCESS');
      } else {
        await addZohoTrace(cartId, `ZOHO_API_FAILED_${response.status}`);
      }

      // 5. Finalizing
      const syncStatus = response.ok ? 'SUCCESS' : 'FAILED';
      const syncError = response.ok ? null : (data.message || 'Zoho API Error');

      try {
        await addZohoTrace(cartId, 'DB_PERSIST_STARTED');
        console.log(`[ZOHO][${cartId}] FINAL SUCCESS SAVE - Persisting Sales Order: ${data.salesorder?.salesorder_number}`);
        await prisma.cart.update({
          where: { id: cartId },
          data: {
            zohoSalesorderId: data.salesorder?.salesorder_id || null,
            zohoSalesorderNumber: data.salesorder?.salesorder_number || null,
            zohoSyncStatus: syncStatus,
            zohoSyncStep: syncStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            zohoSyncError: syncError,
            zohoResponse: data,
            zohoResponseTimeMs: responseTimeMs,
            zohoLastSyncAt: new Date()
          }
        });
        await addZohoTrace(cartId, 'DB_PERSIST_SUCCESS');
        console.log(`[ZOHO][${cartId}] DB UPDATE COMPLETE`);
        await addZohoTrace(cartId, 'SYNC_COMPLETED');
      } catch (dbErr: any) {
        console.error(`[ZOHO][${cartId}] Final DB Update Failed (Zoho was ${syncStatus}):`, dbErr);
      }

      console.log(`[ZOHO][${cartId}] Final Status: ${syncStatus}`);
      return { 
        success: response.ok, 
        error: syncError, 
        response: data, 
        payload 
      };

    } catch (e: any) {
      if (e.name === 'AbortError') {
        const msg = 'Zoho API timeout (20s)';
        console.error(`[ZOHO][${cartId}] ${msg}`);
        await updateStep('FAILED', 'FAILED', { zohoSyncError: msg });
        return { success: false, error: msg };
      }
      throw e;
    }

  } catch (error: any) {
    const msg = error.message || 'Unknown internal error';
    console.error(`[ZOHO][${cartId}] CRITICAL FAILURE:`, error);
    await addZohoTrace(cartId, 'SYNC_CRASHED');
    await prisma.cart.update({
      where: { id: cartId },
      data: {
        zohoSyncStatus: 'FAILED',
        zohoSyncStep: 'FAILED',
        zohoSyncError: `[CRASH][${msg}]\nStack: ${error.stack?.substring(0, 500)}`
      }
    });
    return { success: false, error: msg };
  }
}

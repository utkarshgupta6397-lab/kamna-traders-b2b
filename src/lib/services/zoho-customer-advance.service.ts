import { prisma } from '../db';
import { getZohoTokens, getZohoOrgId } from '../zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
export const DEFAULT_ICICI_ACCOUNT_ID = '1759923000003416718';
export const ZOHO_POS_PAYMENT_MODE = 'POS Device';

export interface ZohoCustomerAdvanceResult {
  success: boolean;
  paymentId?: string;
  paymentNumber?: string;
  isExisting?: boolean;
  error?: string;
  statusCode?: number;
}

export interface PaymentRequestInput {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  amount: any;
  paymentDate: Date | string;
  paymentMode: string;
  status: string;
  zohoPaymentId?: string | null;
}

/**
 * Strips sensitive authorization tokens and URL parameters from error strings.
 */
export function sanitizeZohoError(err: any): string {
  if (!err) return 'Unknown error occurred';
  let message = typeof err === 'string' ? err : err.message || JSON.stringify(err);
  // Remove any auth tokens or secret keys
  message = message.replace(/(?:Zoho-oauthtoken\s+|token=)([a-zA-Z0-9._-]+)/gi, '***REDACTED***');
  // Truncate overly verbose HTML responses if any
  if (message.length > 500) {
    message = message.substring(0, 500) + '...';
  }
  return message;
}

/**
 * Pre-flight check: queries Zoho Books to see if a customer payment with this reference_number already exists.
 * This prevents duplicate customer advances on retries or lost responses.
 */
export async function findExistingZohoPaymentByReference(
  requestNumber: string,
  customerId: string,
  accessToken: string,
  orgId: string
): Promise<{ payment_id: string; payment_number: string } | null> {
  try {
    const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&customer_id=${customerId}&reference_number=${encodeURIComponent(
      requestNumber
    )}`;

    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });

    if (!res.ok) {
      console.warn(`[ZohoCustomerAdvance] Idempotency lookup returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const payments = data.customerpayments || [];
    const matching = payments.find(
      (p: any) => (p.reference_number || '').trim().toLowerCase() === requestNumber.trim().toLowerCase()
    );

    if (matching && matching.payment_id) {
      return {
        payment_id: String(matching.payment_id),
        payment_number: String(matching.payment_number || '')
      };
    }
    return null;
  } catch (err) {
    console.warn('[ZohoCustomerAdvance] Idempotency lookup error:', err);
    return null;
  }
}

/**
 * Creates a Zoho Books Customer Advance for a PaymentRequest.
 * 
 * STRICT RULES:
 * 1. Customer Advance only: invoices array is OMITTED.
 * 2. Payment Mode: "POS Device".
 * 3. Deposit To Account: "Kamna Traders ICICI" (1759923000003416718).
 * 4. Reference Number: ERP requestNumber.
 */
export async function createZohoCustomerAdvance(
  payment: PaymentRequestInput
): Promise<ZohoCustomerAdvanceResult> {
  // 1. Validation
  const amountNum = Number(payment.amount);
  if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
    return {
      success: false,
      error: `Invalid payment amount: ₹${payment.amount}. Must be greater than 0.`
    };
  }

  if (amountNum > 200000) {
    return {
      success: false,
      error: `Payment amount ₹${amountNum.toLocaleString('en-IN')} exceeds maximum limit of ₹2,00,000.`
    };
  }

  if (!payment.customerId || !/^\d+$/.test(payment.customerId)) {
    return {
      success: false,
      error: `Invalid or unmapped Zoho Customer ID: ${payment.customerId}.`
    };
  }

  // 2. Authentication check
  const orgId = getZohoOrgId();
  if (!orgId) {
    return {
      success: false,
      error: 'Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID configuration.'
    };
  }

  const accessToken = await getZohoTokens();
  if (!accessToken) {
    return {
      success: false,
      error: 'Zoho Books authentication token missing or expired. Please re-authenticate at /api/admin/zoho/login.'
    };
  }

  // 3. Pre-flight Idempotency Check
  const existingPayment = await findExistingZohoPaymentByReference(
    payment.requestNumber,
    payment.customerId,
    accessToken,
    orgId
  );

  if (existingPayment) {
    console.log(
      `[ZohoCustomerAdvance] Found existing Customer Advance in Zoho: ${existingPayment.payment_id} for ${payment.requestNumber}`
    );
    return {
      success: true,
      paymentId: existingPayment.payment_id,
      paymentNumber: existingPayment.payment_number,
      isExisting: true
    };
  }

  // 4. Resolve Deposit To Account
  const accountId = (process.env.ZOHO_ICICI_ACCOUNT_ID || DEFAULT_ICICI_ACCOUNT_ID).trim();

  // Format date as YYYY-MM-DD
  let dateStr: string;
  if (payment.paymentDate instanceof Date) {
    dateStr = payment.paymentDate.toISOString().split('T')[0];
  } else if (typeof payment.paymentDate === 'string') {
    dateStr = payment.paymentDate.split('T')[0];
  } else {
    dateStr = new Date().toISOString().split('T')[0];
  }

  // 5. Construct Payload for Customer Advance
  // CRITICAL: NO invoices array, NO invoice_id, NO amount_applied
  const payload = {
    customer_id: payment.customerId,
    payment_mode: ZOHO_POS_PAYMENT_MODE,
    amount: amountNum,
    date: dateStr,
    reference_number: payment.requestNumber,
    description: `POS Customer Advance recorded from Kamna ERP Payment Request ${payment.requestNumber}`,
    account_id: accountId
  };

  console.log(`[ZohoCustomerAdvance] Creating Customer Advance for ${payment.requestNumber}:`, {
    customer_id: payload.customer_id,
    amount: payload.amount,
    date: payload.date,
    payment_mode: payload.payment_mode,
    account_id: payload.account_id,
    reference_number: payload.reference_number
  });

  try {
    const res = await fetch(`${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || data.code !== 0) {
      console.error('[ZohoCustomerAdvance] Zoho API Error:', { status: res.status, data });

      let errorMessage = data?.message || `Zoho Books API returned status ${res.status}`;
      if (
        res.status === 401 ||
        res.status === 403 ||
        data?.code === 57 ||
        (data?.message || '').toLowerCase().includes('not authorized') ||
        (data?.message || '').toLowerCase().includes('scope')
      ) {
        errorMessage =
          'Zoho Books authorization scope error: Permission to create customer payments (ZohoBooks.customerpayments.CREATE) may not be granted. Please re-authenticate at /api/admin/zoho/login.';
      }

      return {
        success: false,
        error: sanitizeZohoError(errorMessage),
        statusCode: res.status
      };
    }

    const createdPayment = data.customerpayment || data.payment;
    if (!createdPayment?.payment_id) {
      return {
        success: false,
        error: 'Zoho Books did not return a valid payment_id in the response.'
      };
    }

    return {
      success: true,
      paymentId: String(createdPayment.payment_id),
      paymentNumber: String(createdPayment.payment_number || '')
    };
  } catch (error: any) {
    console.error('[ZohoCustomerAdvance] Network or unexpected exception:', error);
    return {
      success: false,
      error: sanitizeZohoError(error?.message || 'Network failure connecting to Zoho Books API.')
    };
  }
}

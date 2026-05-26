import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

/**
 * CustomerEnrichment — full shape returned per customer.
 * All fields are optional/nullable so callers can safely destructure.
 */
export interface CustomerEnrichment {
  unusedCredits: number;
  creditLimit: number;
  // GST — resolved via full fallback hierarchy
  gstNumber: string;
  // Billing address
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
  // Display helpers
  displayName: string;
  companyName: string;
  // Operational markers
  tallyReady: boolean;
}

const API_BASE = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

/**
 * Resolve GST from a Zoho contact object using the full fallback hierarchy:
 *   invoice gst → tax_reg_no → gst_no → billing_address gst_treatment
 *   → shipping_address gst → tax_info_list → ''
 */
function resolveGstFromContact(contact: any): string {
  return (
    contact.gst_no ||
    contact.tax_reg_no ||
    contact.gstin ||
    (Array.isArray(contact.tax_info_list) && contact.tax_info_list[0]?.tax_registration_no) ||
    contact.billing_address?.gst_no ||
    contact.shipping_address?.gst_no ||
    ''
  );
}

/**
 * Resolve unused credits — Zoho Books has changed field names across API versions.
 * Try all known variants.
 */
function resolveUnusedCredits(contact: any): number {
  const raw =
    contact.unused_credits_receivable_amount ??
    contact.unused_credits_amount ??
    contact.unused_credits ??
    contact.credits ??
    contact.excess_payments ??
    contact.unapplied_amount ??
    0;
  return Math.max(0, Number(raw) || 0);
}

function resolveBillingAddress(contact: any): {
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
} {
  const ba = contact.billing_address ?? contact.address ?? {};
  return {
    billingAddress: (ba.address || ba.street || ba.attention || '').trim(),
    billingCity:    (ba.city || '').trim(),
    billingState:   (ba.state || ba.state_code || '').trim(),
    billingZip:     (ba.zip || ba.zip_code || ba.postal_code || '').trim(),
    billingCountry: (ba.country || ba.country_code || '').trim(),
  };
}

/**
 * Check for cf_tally_ready in direct attributes or custom_fields array.
 */
function resolveTallyReady(contact: any): boolean {
  if (contact.cf_tally_ready === true || contact.cf_tally_ready === 'true') return true;
  if (Array.isArray(contact.custom_fields)) {
    const field = contact.custom_fields.find((f: any) => f.api_name === 'cf_tally_ready' || f.api_name === 'tally_ready' || f.placeholder === 'cf_tally_ready');
    if (field && (field.value === true || field.value === 'true')) return true;
  }
  return false;
}

/**
 * POST /api/accounts/summary/enrich-customers
 *
 * Body:  { customerIds: string[] }
 * Returns: { success, data: Record<customerId, CustomerEnrichment>, apiCallsUsed, usingMock }
 *
 * Design principles:
 *  - Server-side dedup (caller should also dedup but guarded here)
 *  - Parallel Promise.all — no N+1
 *  - Graceful fallback to deterministic mock data in dev mode
 *  - Capped at 50 IDs per call
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let customerIds: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body?.customerIds)) {
        customerIds = [
          ...new Set(
            (body.customerIds as unknown[]).filter(
              (id): id is string => typeof id === 'string' && id.trim() !== ''
            )
          ),
        ];
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    if (customerIds.length === 0) {
      return NextResponse.json({ success: true, data: {}, apiCallsUsed: 0 });
    }

    const safeIds = customerIds.slice(0, 50); // safety cap

    let orgId: string | null = null;
    let accessToken: string | null = null;
    let usingMock = false;

    try {
      orgId = getZohoOrgId();
      accessToken = await getZohoTokens();
    } catch {
      usingMock = true;
    }
    if (!orgId || !accessToken) usingMock = true;

    // Daily Credit check
    const cache = await prisma.invoiceSummaryCache.findUnique({
      where: { id: 'singleton' },
    });

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    let dailyCreditsUsed = 0;
    let dailyCreditsDate = todayStr;
    let dailyInvoiceRefreshes = 0;
    let dailyCustomerRefreshes = 0;
    let dailyEnrichmentCalls = 0;
    let dailyGlobalRefreshes = 0;

    if (cache) {
      const summary = (cache.summary as any) || {};
      dailyCreditsUsed = summary.dailyCreditsUsed || 0;
      dailyCreditsDate = summary.dailyCreditsDate || todayStr;
      dailyInvoiceRefreshes = summary.dailyInvoiceRefreshes || 0;
      dailyCustomerRefreshes = summary.dailyCustomerRefreshes || 0;
      dailyEnrichmentCalls = summary.dailyEnrichmentCalls || 0;
      dailyGlobalRefreshes = summary.dailyGlobalRefreshes || 0;

      if (dailyCreditsDate !== todayStr) {
        dailyCreditsUsed = 0;
        dailyCreditsDate = todayStr;
        dailyInvoiceRefreshes = 0;
        dailyCustomerRefreshes = 0;
        dailyEnrichmentCalls = 0;
        dailyGlobalRefreshes = 0;
      }
    }

    if (dailyCreditsUsed >= 1000 && !usingMock) {
      return NextResponse.json({
        success: false,
        error: 'Daily API budget of 1000 credits exceeded.',
        dailyCreditsUsed
      }, { status: 429 });
    }

    const enrichMap: Record<string, CustomerEnrichment> = {};
    let apiCallsUsed = 0;

    if (usingMock) {
      // Deterministic mock — stable across renders, realistic enough for dev
      const mockCities = ['Mumbai', 'Pune', 'Delhi', 'Bengaluru', 'Chennai'];
      const mockStates = ['Maharashtra', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu'];
      const mockGsts   = ['27AAAAA1111A1Z1', '27BBBBB2222B2Z2', '07CCCCC3333C3Z3', '29DDDDD4444D4Z4', '33EEEEE5555E5Z5'];

      for (const id of safeIds) {
        const seed = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const idx = seed % 5;
        const credits = seed % 5 === 0 ? 0 : (seed % 18000) + 2000;
        enrichMap[id] = {
          unusedCredits:  credits,
          creditLimit:    100000,
          gstNumber:      mockGsts[idx],
          billingAddress: `${(seed % 999) + 1}, Sample Nagar`,
          billingCity:    mockCities[idx],
          billingState:   mockStates[idx],
          billingZip:     `4${String(seed % 100000).padStart(5, '0')}`,
          billingCountry: 'India',
          displayName:    '',
          companyName:    '',
          tallyReady:     seed % 3 === 0, // Mock some as tally ready
        };
      }
    } else {
      // Parallel Zoho Books /contacts/{id} fetch
      await Promise.all(
        safeIds.map(async (custId) => {
          try {
            const url = `${API_BASE}/books/v3/contacts/${custId}?organization_id=${orgId}`;
            const res = await fetch(url, {
              headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            });
            apiCallsUsed++;

            if (res.ok) {
              const json = await res.json();
              const contact = json?.contact;
              if (contact) {
                const addr = resolveBillingAddress(contact);
                enrichMap[custId] = {
                  unusedCredits:  resolveUnusedCredits(contact),
                  creditLimit:    Number(contact.credit_limit ?? 0),
                  gstNumber:      resolveGstFromContact(contact),
                  displayName:    contact.display_name || contact.contact_name || '',
                  companyName:    contact.company_name || '',
                  tallyReady:     resolveTallyReady(contact),
                  ...addr,
                };
              } else {
                enrichMap[custId] = emptyEnrichment();
              }
            } else {
              enrichMap[custId] = emptyEnrichment();
            }
          } catch (err) {
            console.error(`[enrich-customers] Failed for ${custId}:`, err);
            enrichMap[custId] = emptyEnrichment();
          }
        })
      );
    }

    if (cache && apiCallsUsed > 0) {
      dailyCreditsUsed += apiCallsUsed;
      dailyEnrichmentCalls += apiCallsUsed;

      await prisma.invoiceSummaryCache.update({
        where: { id: 'singleton' },
        data: {
          apiCallsUsed: (cache.apiCallsUsed || 0) + apiCallsUsed,
          summary: {
            ...((cache.summary as any) || {}),
            dailyCreditsUsed,
            dailyCreditsDate,
            dailyInvoiceRefreshes,
            dailyCustomerRefreshes,
            dailyEnrichmentCalls,
            dailyGlobalRefreshes,
          }
        }
      });
    }

    return NextResponse.json({ success: true, data: enrichMap, apiCallsUsed, usingMock });
  } catch (err: any) {
    console.error('[enrich-customers] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

function emptyEnrichment(): CustomerEnrichment {
  return {
    unusedCredits: 0,
    creditLimit: 0,
    gstNumber: '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
    billingCountry: '',
    displayName: '',
    companyName: '',
    tallyReady: false,
  };
}

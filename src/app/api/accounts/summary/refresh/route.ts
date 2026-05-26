import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchInvoicesByRange, fetchInvoiceById, fetchInvoicesByCustomerId } from '@/lib/zoho/invoices';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

type RangeParam = 'today' | 'yesterday' | '3days' | '7days' | '15days';

/** Returns YYYY-MM-DD in IST for a given JS Date */
function getISTDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Returns { startDate, endDate } as YYYY-MM-DD strings in IST */
function getDateRange(range: RangeParam): { startDate: string; endDate: string } {
  const now = new Date();
  const today = getISTDateString(now);

  switch (range) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const y = getISTDateString(new Date(now.getTime() - 86400_000));
      return { startDate: y, endDate: y };
    }
    case '3days':
      return { startDate: getISTDateString(new Date(now.getTime() - 2 * 86400_000)), endDate: today };
    case '7days':
      return { startDate: getISTDateString(new Date(now.getTime() - 6 * 86400_000)), endDate: today };
    case '15days':
      return { startDate: getISTDateString(new Date(now.getTime() - 14 * 86400_000)), endDate: today };
    default:
      return { startDate: today, endDate: today };
  }
}

function recalculateSummaryAndDistributions(
  rows: any[],
  startDate: string,
  endDate: string,
  range: string,
  refreshedBy: string,
  usingMock: boolean
) {
  const nonVoidRows = rows.filter((r) => r.paymentStatus !== 'void');
  const voidRows = rows.filter((r) => r.paymentStatus === 'void');
  const totalInvoices = nonVoidRows.length;
  const customersBilled = new Set(nonVoidRows.map((r) => r.customerName)).size;
  const totalInvoiceValue = nonVoidRows.reduce((s, r) => s + r.invoiceValue, 0);
  const totalCollected = nonVoidRows.reduce((s, r) => s + r.amountPaid, 0);
  const totalPending = nonVoidRows.reduce((s, r) => s + r.amountPending, 0);
  const fullyPaidCount = nonVoidRows.filter((r) => r.paymentStatus === 'paid').length;
  const partialPaidCount = nonVoidRows.filter((r) => r.paymentStatus === 'partially_paid').length;
  const unpaidCount = nonVoidRows.filter((r) => r.paymentStatus === 'unpaid').length;
  const avgInvoiceValue = totalInvoices > 0 ? Math.round(totalInvoiceValue / totalInvoices) : 0;
  const collectionPercent =
    totalInvoiceValue > 0 ? Math.round((totalCollected / totalInvoiceValue) * 100) : 0;
  const pendingPercent = 100 - collectionPercent;

  const summary = {
    fetchedStartDate: startDate,
    fetchedEndDate: endDate,
    fetchedRange: range,
    totalInvoices,
    customersBilled,
    totalInvoiceValue,
    totalCollected,
    collectionPercent,
    totalPending,
    pendingPercent,
    fullyPaidCount,
    partialPaidCount,
    unpaidCount,
    voidCount: voidRows.length,
    avgInvoiceValue,
    usingMock,
  };

  const distributions = {
    paid: {
      count: fullyPaidCount,
      percent: rows.length > 0 ? Math.round((fullyPaidCount / rows.length) * 100) : 0,
    },
    partial: {
      count: partialPaidCount,
      percent: rows.length > 0 ? Math.round((partialPaidCount / rows.length) * 100) : 0,
    },
    unpaid: {
      count: unpaidCount,
      percent: rows.length > 0 ? Math.round((unpaidCount / rows.length) * 100) : 0,
    },
    void: {
      count: voidRows.length,
      percent: rows.length > 0 ? Math.round((voidRows.length / rows.length) * 100) : 0,
    },
  };

  return { summary, distributions };
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse options from body
    let range: RangeParam = 'today';
    let invoiceId: string | undefined;
    let customerId: string | undefined;
    try {
      const body = await request.json();
      const validRanges: RangeParam[] = ['today', 'yesterday', '3days', '7days', '15days'];
      if (body?.range && validRanges.includes(body.range)) {
        range = body.range as RangeParam;
      }
      if (typeof body?.invoiceId === 'string' && body.invoiceId.trim() !== '') {
        invoiceId = body.invoiceId;
      }
      if (typeof body?.customerId === 'string' && body.customerId.trim() !== '') {
        customerId = body.customerId;
      }
    } catch {
      // Use default today range
    }

    const cache = await prisma.invoiceSummaryCache.findUnique({
      where: { id: 'singleton' },
    });

    const todayStr = getISTDateString(new Date());
    const existingSummary = (cache?.summary as any) || {};
    
    // Daily Credit Trackers
    let dailyCreditsUsed = existingSummary.dailyCreditsUsed || 0;
    let dailyCreditsDate = existingSummary.dailyCreditsDate || todayStr;
    let dailyInvoiceRefreshes = existingSummary.dailyInvoiceRefreshes || 0;
    let dailyCustomerRefreshes = existingSummary.dailyCustomerRefreshes || 0;
    let dailyEnrichmentCalls = existingSummary.dailyEnrichmentCalls || 0;
    let dailyGlobalRefreshes = existingSummary.dailyGlobalRefreshes || 0;
    let customerCooldowns = existingSummary.customerCooldowns || {};

    if (dailyCreditsDate !== todayStr) {
      dailyCreditsUsed = 0;
      dailyCreditsDate = todayStr;
      dailyInvoiceRefreshes = 0;
      dailyCustomerRefreshes = 0;
      dailyEnrichmentCalls = 0;
      dailyGlobalRefreshes = 0;
    }

    // Block if budget exceeded
    if (dailyCreditsUsed >= 1000) {
      return NextResponse.json({
        success: false,
        error: 'Daily API budget of 1000 credits exceeded.',
        dailyCreditsUsed
      }, { status: 429 });
    }

    // 0. Cooldown checks based on granular targets
    if (invoiceId) {
      // Check invoice row level cooldown
      const rowsList = cache?.rows as any[] || [];
      const row = rowsList.find((r) => r.invoiceId === invoiceId);
      if (row?.lastRefreshedAt) {
        const timeSince = Date.now() - new Date(row.lastRefreshedAt).getTime();
        if (timeSince < 60000) {
          const remaining = Math.ceil((60000 - timeSince) / 1000);
          return NextResponse.json({
            success: false,
            error: `Invoice refresh available in ${remaining}s`,
            cooldownRemaining: remaining
          }, { status: 429 });
        }
      }
    } else if (customerId) {
      // Check customer level cooldown
      const lastCustRefresh = customerCooldowns[customerId];
      if (lastCustRefresh) {
        const timeSince = Date.now() - new Date(lastCustRefresh).getTime();
        if (timeSince < 60000) {
          const remaining = Math.ceil((60000 - timeSince) / 1000);
          return NextResponse.json({
            success: false,
            error: `Customer refresh available in ${remaining}s`,
            cooldownRemaining: remaining
          }, { status: 429 });
        }
      }
    } else {
      // Check global cooldown
      const lastGlobal = existingSummary.globalRefreshedAt
        ? new Date(existingSummary.globalRefreshedAt).getTime()
        : cache ? cache.generatedAt.getTime() : 0;

      const timeSince = Date.now() - lastGlobal;
      if (timeSince < 60000 && cache) {
        const remaining = Math.ceil((60000 - timeSince) / 1000);
        return NextResponse.json({
          success: false,
          error: `Global refresh available in ${remaining}s`,
          cooldownRemaining: remaining
        }, { status: 429 });
      }
    }

    // 1. Concurrency Lock
    const lock = await prisma.syncLock.upsert({
      where: { name: 'INVOICE_SUMMARY_REFRESH' },
      update: {},
      create: { name: 'INVOICE_SUMMARY_REFRESH', isLocked: false },
    });

    if (lock.isLocked && lock.lockedAt && (Date.now() - lock.lockedAt.getTime() < 2 * 60 * 1000)) {
      return NextResponse.json({
        success: false,
        error: 'Summary is currently being refreshed by another user...',
      }, { status: 409 });
    }

    await prisma.syncLock.update({
      where: { name: 'INVOICE_SUMMARY_REFRESH' },
      data: { isLocked: true, lockedAt: new Date(), lockedBy: session.name || 'Admin' },
    });

    try {
      if (invoiceId) {
        // --- INVOICE LEVEL REFRESH ---
        if (!cache) {
          return NextResponse.json({ success: false, error: 'Cache not initialized. Please perform a global refresh first.' }, { status: 400 });
        }

        let updatedRows = [...(cache.rows as any[] || [])];
        let apiCallsUsed = 0;
        let usingMock = false;

        const idx = updatedRows.findIndex((r: any) => r.invoiceId === invoiceId);
        if (idx === -1) {
          return NextResponse.json({ success: false, error: `Invoice ${invoiceId} not found in cache.` }, { status: 404 });
        }

        if (invoiceId.startsWith('mock-')) {
          // Mock update simulation
          const row = updatedRows[idx];
          const nextStatus = row.paymentStatus === 'paid' ? 'unpaid' : 'paid';
          const value = row.invoiceValue;
          updatedRows[idx] = {
            ...row,
            amountPaid: nextStatus === 'paid' ? value : 0,
            amountPending: nextStatus === 'paid' ? 0 : value,
            paymentProgress: nextStatus === 'paid' ? 100 : 0,
            paymentStatus: nextStatus,
            lastRefreshedAt: new Date().toISOString(),
          };
          apiCallsUsed = 1;
        } else {
          let orgId: string | null = null;
          let accessToken: string | null = null;
          try {
            orgId = getZohoOrgId();
            accessToken = await getZohoTokens();
          } catch {
            usingMock = true;
          }
          if (!orgId || !accessToken) usingMock = true;

          if (usingMock) {
            const row = updatedRows[idx];
            const nextStatus = row.paymentStatus === 'paid' ? 'unpaid' : 'paid';
            const value = row.invoiceValue;
            updatedRows[idx] = {
              ...row,
              amountPaid: nextStatus === 'paid' ? value : 0,
              amountPending: nextStatus === 'paid' ? 0 : value,
              paymentProgress: nextStatus === 'paid' ? 100 : 0,
              paymentStatus: nextStatus,
              lastRefreshedAt: new Date().toISOString(),
            };
            apiCallsUsed = 1;
          } else {
            // Fetch from Zoho Books
            const res = await fetchInvoiceById(invoiceId);
            apiCallsUsed = res.apiCallsUsed;
            const inv = res.invoice;
            const total = Number(inv.total || 0);
            const balance = Number(inv.balance !== undefined ? inv.balance : (inv.balance_amount || 0));
            const paid = total - balance;
            const rawStatus = inv.status || 'unpaid';
            const custId = inv.customer_id;

            const existingRow = updatedRows[idx];
            const resolvedGst = existingRow?.customerGst || '';

            updatedRows[idx] = {
              invoiceId: inv.invoice_id,
              invoiceNumber: inv.invoice_number,
              invoiceDate: inv.date,
              dueDate: inv.due_date || null,
              createdTime: inv.created_time || null,
              customerName: inv.customer_name,
              customerId: custId,
              customerGst: resolvedGst || inv.gst_no || '',
              invoiceValue: total,
              amountPaid: paid,
              amountPending: balance,
              paymentStatus: rawStatus === 'sent' || rawStatus === 'unpaid' || rawStatus === 'overdue' ? 'unpaid' : rawStatus,
              paymentProgress: total > 0 ? Math.round((paid / total) * 100) : 0,
              lastPaymentDate: inv.last_payment_date || null,
              lastRefreshedAt: new Date().toISOString(),
            };
          }
        }

        // Budget updates
        dailyCreditsUsed += apiCallsUsed;
        dailyInvoiceRefreshes++;

        const cachedSummary: any = cache.summary || {};
        const cacheStartDate = cachedSummary.fetchedStartDate || getISTDateString(new Date(Date.now() - 14 * 86400000));
        const cacheEndDate = cachedSummary.fetchedEndDate || getISTDateString(new Date());
        const cacheRange = cachedSummary.fetchedRange || '15days';
        const isCacheUsingMock = cachedSummary.usingMock || false;

        const { summary, distributions } = recalculateSummaryAndDistributions(
          updatedRows,
          cacheStartDate,
          cacheEndDate,
          cacheRange,
          session.name || 'Admin',
          isCacheUsingMock || usingMock
        );

        // Merge daily budget data
        const mergedSummary = {
          ...summary,
          dailyCreditsUsed,
          dailyCreditsDate,
          dailyInvoiceRefreshes,
          dailyCustomerRefreshes,
          dailyEnrichmentCalls,
          dailyGlobalRefreshes,
          customerCooldowns,
          globalRefreshedAt: cachedSummary.globalRefreshedAt,
        };

        const cachedSnapshot = await prisma.invoiceSummaryCache.update({
          where: { id: 'singleton' },
          data: {
            apiCallsUsed: (cache.apiCallsUsed || 0) + apiCallsUsed,
            summary: mergedSummary,
            distributions,
            rows: updatedRows,
          },
        });

        return NextResponse.json({ success: true, data: cachedSnapshot });

      } else if (customerId) {
        // --- CUSTOMER LEVEL REFRESH ---
        if (!cache) {
          return NextResponse.json({ success: false, error: 'Cache not initialized. Please perform a global refresh first.' }, { status: 400 });
        }

        let updatedRows = [...(cache.rows as any[] || [])];
        let apiCallsUsed = 0;
        let usingMock = false;
        let enrichment: any = null;

        if (customerId.startsWith('c-')) {
          // Mock Customer Refresh simulation
          let hasChanges = false;
          updatedRows = updatedRows.map((r: any) => {
            if (r.customerId === customerId) {
              hasChanges = true;
              const nextStatus = r.paymentStatus === 'paid' ? 'unpaid' : 'paid';
              const value = r.invoiceValue;
              return {
                ...r,
                amountPaid: nextStatus === 'paid' ? value : 0,
                amountPending: nextStatus === 'paid' ? 0 : value,
                paymentProgress: nextStatus === 'paid' ? 100 : 0,
                paymentStatus: nextStatus,
                lastRefreshedAt: new Date().toISOString(),
              };
            }
            return r;
          });

          if (!hasChanges) {
            return NextResponse.json({ success: false, error: `Customer ${customerId} has no invoices in cache.` }, { status: 404 });
          }

          const seed = customerId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          const mockCities = ['Mumbai', 'Pune', 'Delhi', 'Bengaluru', 'Chennai'];
          const mockStates = ['Maharashtra', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu'];
          const mockGsts   = ['27AAAAA1111A1Z1', '27BBBBB2222B2Z2', '07CCCCC3333C3Z3', '29DDDDD4444D4Z4', '33EEEEE5555E5Z5'];
          const idx = seed % 5;
          const credits = seed % 5 === 0 ? 1000 : (seed % 18000) + 3000;
          enrichment = {
            unusedCredits:  credits,
            creditLimit:    120000,
            gstNumber:      mockGsts[idx],
            billingAddress: `${(seed % 999) + 1}, Sample Nagar Refreshed`,
            billingCity:    mockCities[idx],
            billingState:   mockStates[idx],
            billingZip:     `4${String(seed % 100000).padStart(5, '0')}`,
            billingCountry: 'India',
            displayName:    '',
            companyName:    '',
          };
          apiCallsUsed = 2;
        } else {
          let orgId: string | null = null;
          let accessToken: string | null = null;
          try {
            orgId = getZohoOrgId();
            accessToken = await getZohoTokens();
          } catch {
            usingMock = true;
          }
          if (!orgId || !accessToken) usingMock = true;

          if (usingMock) {
            updatedRows = updatedRows.map((r: any) => {
              if (r.customerId === customerId) {
                const nextStatus = r.paymentStatus === 'paid' ? 'unpaid' : 'paid';
                const value = r.invoiceValue;
                return {
                  ...r,
                  amountPaid: nextStatus === 'paid' ? value : 0,
                  amountPending: nextStatus === 'paid' ? 0 : value,
                  paymentProgress: nextStatus === 'paid' ? 100 : 0,
                  paymentStatus: nextStatus,
                  lastRefreshedAt: new Date().toISOString(),
                };
              }
              return r;
            });

            const seed = customerId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const mockCities = ['Mumbai', 'Pune', 'Delhi', 'Bengaluru', 'Chennai'];
            const mockStates = ['Maharashtra', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu'];
            const mockGsts   = ['27AAAAA1111A1Z1', '27BBBBB2222B2Z2', '07CCCCC3333C3Z3', '29DDDDD4444D4Z4', '33EEEEE5555E5Z5'];
            const idx = seed % 5;
            const credits = seed % 5 === 0 ? 1000 : (seed % 18000) + 3000;
            enrichment = {
              unusedCredits:  credits,
              creditLimit:    120000,
              gstNumber:      mockGsts[idx],
              billingAddress: `${(seed % 999) + 1}, Sample Nagar Refreshed`,
              billingCity:    mockCities[idx],
              billingState:   mockStates[idx],
              billingZip:     `4${String(seed % 100000).padStart(5, '0')}`,
              billingCountry: 'India',
              displayName:    '',
              companyName:    '',
            };
            apiCallsUsed = 2;
          } else {
            const cachedSummary: any = cache.summary || {};
            const cacheStartDate = cachedSummary.fetchedStartDate || getISTDateString(new Date(Date.now() - 14 * 86400000));
            const cacheEndDate = cachedSummary.fetchedEndDate || getISTDateString(new Date());

            // 1. Fetch contact info
            try {
              const url = `${API_BASE_URL}/books/v3/contacts/${customerId}?organization_id=${orgId}`;
              const response = await fetch(url, {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
              });
              apiCallsUsed++;
              if (response.ok) {
                const contactData = await response.json();
                const contact = contactData.contact;
                if (contact) {
                  const gstNumber = contact.gst_no ||
                    contact.tax_reg_no ||
                    contact.gstin ||
                    (Array.isArray(contact.tax_info_list) && contact.tax_info_list[0]?.tax_registration_no) ||
                    contact.billing_address?.gst_no ||
                    contact.shipping_address?.gst_no ||
                    '';
                  
                  const rawCredits = contact.unused_credits_receivable_amount ??
                    contact.unused_credits_amount ??
                    contact.unused_credits ??
                    contact.credits ??
                    contact.excess_payments ??
                    contact.unapplied_amount ??
                    0;
                  const unusedCredits = Math.max(0, Number(rawCredits) || 0);

                  const ba = contact.billing_address ?? contact.address ?? {};
                  enrichment = {
                    unusedCredits,
                    creditLimit: Number(contact.credit_limit ?? 0),
                    gstNumber,
                    displayName: contact.display_name || contact.contact_name || '',
                    companyName: contact.company_name || '',
                    billingAddress: (ba.address || ba.street || ba.attention || '').trim(),
                    billingCity: (ba.city || '').trim(),
                    billingState: (ba.state || ba.state_code || '').trim(),
                    billingZip: (ba.zip || ba.zip_code || ba.postal_code || '').trim(),
                    billingCountry: (ba.country || ba.country_code || '').trim(),
                  };
                }
              }
            } catch (err) {
              console.error(`[Customer Refresh] Failed to fetch contact ${customerId}:`, err);
            }

            // 2. Fetch customer invoices
            const invRes = await fetchInvoicesByCustomerId(customerId, cacheStartDate, cacheEndDate);
            apiCallsUsed += invRes.apiCallsUsed;
            const fetchedInvoices = invRes.invoices;

            const resolvedGst = enrichment?.gstNumber || '';

            // Map customer invoices to cache format
            const customerRows = fetchedInvoices.map((inv: any) => {
              const total = Number(inv.total || 0);
              const balance = Number(inv.balance !== undefined ? inv.balance : (inv.balance_amount || 0));
              const paid = total - balance;
              const rawStatus = inv.status || 'unpaid';
              return {
                invoiceId: inv.invoice_id,
                invoiceNumber: inv.invoice_number,
                invoiceDate: inv.date,
                dueDate: inv.due_date || null,
                createdTime: inv.created_time || null,
                customerName: inv.customer_name,
                customerId: customerId,
                customerGst: resolvedGst || inv.gst_no || '',
                invoiceValue: total,
                amountPaid: paid,
                amountPending: balance,
                paymentStatus: rawStatus === 'sent' || rawStatus === 'unpaid' || rawStatus === 'overdue' ? 'unpaid' : rawStatus,
                paymentProgress: total > 0 ? Math.round((paid / total) * 100) : 0,
                lastPaymentDate: inv.last_payment_date || null,
                lastRefreshedAt: new Date().toISOString(),
              };
            });

            // Filter out existing cached invoices for this customer
            const otherRows = updatedRows.filter((r: any) => r.customerId !== customerId);
            updatedRows = [...otherRows, ...customerRows];
          }
        }

        // Budget updates
        dailyCreditsUsed += apiCallsUsed;
        dailyCustomerRefreshes++;
        customerCooldowns[customerId] = new Date().toISOString();

        const cachedSummary: any = cache.summary || {};
        const cacheStartDate = cachedSummary.fetchedStartDate || getISTDateString(new Date(Date.now() - 14 * 86400000));
        const cacheEndDate = cachedSummary.fetchedEndDate || getISTDateString(new Date());
        const cacheRange = cachedSummary.fetchedRange || '15days';
        const isCacheUsingMock = cachedSummary.usingMock || false;

        const { summary, distributions } = recalculateSummaryAndDistributions(
          updatedRows,
          cacheStartDate,
          cacheEndDate,
          cacheRange,
          session.name || 'Admin',
          isCacheUsingMock || usingMock
        );

        const mergedSummary = {
          ...summary,
          dailyCreditsUsed,
          dailyCreditsDate,
          dailyInvoiceRefreshes,
          dailyCustomerRefreshes,
          dailyEnrichmentCalls,
          dailyGlobalRefreshes,
          customerCooldowns,
          globalRefreshedAt: cachedSummary.globalRefreshedAt,
        };

        const cachedSnapshot = await prisma.invoiceSummaryCache.update({
          where: { id: 'singleton' },
          data: {
            apiCallsUsed: (cache.apiCallsUsed || 0) + apiCallsUsed,
            summary: mergedSummary,
            distributions,
            rows: updatedRows,
          },
        });

        return NextResponse.json({ success: true, data: cachedSnapshot, enrichment });

      } else {
        // --- GLOBAL REFRESH ---
        const { startDate, endDate } = getDateRange(range);

        let invoices: any[] = [];
        let apiCallsUsed = 0;
        let usingMock = false;

        try {
          const res = await fetchInvoicesByRange(startDate, endDate);
          invoices = res.invoices;
          apiCallsUsed = res.apiCallsUsed;
        } catch (err: any) {
          console.warn('[Accounts Summary] Zoho API failed, using mock data.', err.message);
          usingMock = true;
          apiCallsUsed = 1;

          const now = new Date();
          const today = getISTDateString(now);

          const mockCustomers = [
            { name: 'Acme Corp', gst: '27AAAAA1111A1Z1', id: 'c-1' },
            { name: 'Bhavna Enterprises', gst: '27BBBBB2222B2Z2', id: 'c-2' },
            { name: 'Chandan & Sons', gst: '27CCCCC3333C3Z3', id: 'c-3' },
            { name: 'Deepak Retail', gst: '', id: 'c-4' },
            { name: 'Eshwar Logistics', gst: '27EEEEE5555E5Z5', id: 'c-5' },
          ];

          const daysSpan = range === 'today' || range === 'yesterday' ? 1
            : range === '3days' ? 3
            : range === '7days' ? 7
            : 15;

          const startOffset = range === 'yesterday' ? 1 : 0;

          for (let i = 0; i < daysSpan * 4; i++) {
            const dayOffset = startOffset + Math.floor(i / 4);
            const invDate = new Date(now.getTime() - dayOffset * 86400_000);
            const dateString = getISTDateString(invDate);

            if (dateString < startDate || dateString > endDate) continue;

            const customer = mockCustomers[i % mockCustomers.length];
            const statuses: ('paid' | 'partially_paid' | 'sent' | 'void')[] = ['paid', 'partially_paid', 'sent', 'void'];
            const status = statuses[i % statuses.length];
            const total = 5000 + (i * 750) % 50000;
            const balance = status === 'paid' ? 0 : status === 'partially_paid' ? Math.round(total / 3) : total;

            const dueDateOffset = dayOffset === 0 ? 0 : dayOffset - 1;
            const dueDate = getISTDateString(new Date(now.getTime() - dueDateOffset * 86400_000));

            invoices.push({
              invoice_id: `mock-inv-${i}`,
              invoice_number: `INV-2026-${1000 + i}`,
              date: dateString,
              due_date: dueDate,
              created_time: invDate.toISOString(),
              customer_id: customer.id,
              customer_name: customer.name,
              gst_no: customer.gst,
              status,
              total,
              balance,
            });
          }
        }

        const gstMap = new Map<string, string>();
        if (!usingMock) {
          const uniqueCustomerIds = Array.from(
            new Set(invoices.map((inv) => inv.customer_id).filter(Boolean))
          ) as string[];
          const orgId = getZohoOrgId();
          const accessToken = await getZohoTokens();

          if (orgId && accessToken && uniqueCustomerIds.length > 0) {
            await Promise.all(
              uniqueCustomerIds.map(async (custId) => {
                try {
                  const url = `${API_BASE_URL}/books/v3/contacts/${custId}?organization_id=${orgId}`;
                  const response = await fetch(url, {
                    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
                  });
                  apiCallsUsed++;
                  if (response.ok) {
                    const contactData = await response.json();
                    const contact = contactData.contact;
                    if (contact) {
                      const gstNo = contact.gst_no ||
                        contact.tax_reg_no ||
                        (Array.isArray(contact.tax_info_list) && contact.tax_info_list[0]?.tax_registration_no) ||
                        '';
                      gstMap.set(custId, gstNo);
                    }
                  }
                } catch (err) {
                  console.error(`[Accounts Summary Refresh] Failed to fetch contact ${custId}:`, err);
                }
              })
            );
          }
        }

        const rows: any[] = invoices.map((inv: any) => {
          const total = Number(inv.total || 0);
          const balance = Number(inv.balance !== undefined ? inv.balance : (inv.balance_amount || 0));
          const paid = total - balance;
          const rawStatus = inv.status || 'unpaid';
          const custId = inv.customer_id;

          const resolvedGst = usingMock
            ? (inv.gst_no || '')
            : (gstMap.get(custId) || inv.gst_no || '');

          return {
            invoiceId: inv.invoice_id,
            invoiceNumber: inv.invoice_number,
            invoiceDate: inv.date,
            dueDate: inv.due_date || null,
            createdTime: inv.created_time || null,
            customerName: inv.customer_name,
            customerId: custId,
            customerGst: resolvedGst,
            invoiceValue: total,
            amountPaid: paid,
            amountPending: balance,
            paymentStatus: rawStatus === 'sent' || rawStatus === 'unpaid' || rawStatus === 'overdue' ? 'unpaid' : rawStatus,
            paymentProgress: total > 0 ? Math.round((paid / total) * 100) : 0,
            lastPaymentDate: inv.last_payment_date || null,
          };
        });

        // Budget updates
        dailyCreditsUsed += apiCallsUsed;
        dailyGlobalRefreshes++;

        const { summary, distributions } = recalculateSummaryAndDistributions(
          rows,
          startDate,
          endDate,
          range,
          session.name || 'Admin',
          usingMock
        );

        const mergedSummary = {
          ...summary,
          dailyCreditsUsed,
          dailyCreditsDate,
          dailyInvoiceRefreshes,
          dailyCustomerRefreshes,
          dailyEnrichmentCalls,
          dailyGlobalRefreshes,
          customerCooldowns,
          globalRefreshedAt: new Date().toISOString(),
        };

        const cachedSnapshot = await prisma.invoiceSummaryCache.upsert({
          where: { id: 'singleton' },
          update: {
            generatedAt: new Date(),
            apiCallsUsed: (cache ? cache.apiCallsUsed : 0) + apiCallsUsed,
            refreshedBy: session.name || 'Admin',
            invoiceCount: invoices.length,
            summary: mergedSummary,
            distributions,
            rows,
          },
          create: {
            id: 'singleton',
            generatedAt: new Date(),
            apiCallsUsed,
            refreshedBy: session.name || 'Admin',
            invoiceCount: invoices.length,
            summary: mergedSummary,
            distributions,
            rows,
          },
        });

        return NextResponse.json({ success: true, data: cachedSnapshot });
      }
    } finally {
      await prisma.syncLock
        .update({
          where: { name: 'INVOICE_SUMMARY_REFRESH' },
          data: { isLocked: false, lockedAt: null, lockedBy: null },
        })
        .catch(() => null);
    }
  } catch (error: any) {
    console.error('[Accounts Summary Refresh Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { prisma } from '@/lib/db';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export interface CustomerBalance {
  customerId: string;
  netOutstandingBalance: number;
  balanceUpdatedAt: Date | null;
  balanceSyncStatus: string | null;
  balanceSyncError: string | null;
}

export class CustomerBalanceService {
  /**
   * Fast read of cached balances from the local database.
   * Zero API calls to Zoho.
   */
  static async getCustomerBalances(customerIds: string[]): Promise<Record<string, CustomerBalance>> {
    if (customerIds.length === 0) return {};

    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        netOutstandingBalance: true,
        balanceUpdatedAt: true,
        balanceSyncStatus: true,
        balanceSyncError: true,
      },
    });

    const result: Record<string, CustomerBalance> = {};
    for (const c of customers) {
      result[c.id] = {
        customerId: c.id,
        netOutstandingBalance: c.netOutstandingBalance ?? 0,
        balanceUpdatedAt: c.balanceUpdatedAt,
        balanceSyncStatus: c.balanceSyncStatus,
        balanceSyncError: c.balanceSyncError,
      };
    }
    return result;
  }

  /**
   * Fetches latest balances from Zoho, updates the local DB, and returns the updated values.
   * Batches requests to avoid N+1 queries.
   */
  static async refreshCustomerBalances(customerIds: string[]): Promise<Record<string, CustomerBalance>> {
    if (customerIds.length === 0) return {};

    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing Zoho Org ID');

    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token');

    // Remove duplicates
    const uniqueIds = Array.from(new Set(customerIds));
    const now = new Date();
    const result: Record<string, CustomerBalance> = {};

    // Zoho Books API can accept multiple IDs via contact_ids=ID1,ID2
    // We batch them in chunks of 25 just to be safe with URL length limits
    const CHUNK_SIZE = 25;
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const idsStr = chunk.join(',');

      try {
        const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&contact_ids=${idsStr}`;
        const res = await fetch(url, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });

        if (!res.ok) {
          throw new Error(`Zoho API responded with status: ${res.status}`);
        }

        const data = await res.json();
        
        if (data.contacts && Array.isArray(data.contacts)) {
          for (const contact of data.contacts) {
            const cid = contact.contact_id;
            const outstandingReceivable = contact.outstanding_receivable_amount || 0;
            const unusedCredits = contact.unused_credits_receivable_amount || 0;
            const netOutstanding = outstandingReceivable - unusedCredits;

            // Update local DB
            await prisma.customer.update({
              where: { id: cid },
              data: {
                netOutstandingBalance: netOutstanding,
                balanceUpdatedAt: now,
                balanceSyncStatus: 'SUCCESS',
                balanceSyncError: null,
              },
            });

            result[cid] = {
              customerId: cid,
              netOutstandingBalance: netOutstanding,
              balanceUpdatedAt: now,
              balanceSyncStatus: 'SUCCESS',
              balanceSyncError: null,
            };
          }
        }
      } catch (err: any) {
        console.error(`[CustomerBalanceService] Failed to refresh chunk`, err);
        // Mark failed ones in DB (if they exist)
        for (const cid of chunk) {
          try {
            await prisma.customer.update({
              where: { id: cid },
              data: {
                balanceSyncStatus: 'FAILED',
                balanceSyncError: err.message || 'Unknown error',
              },
            });
          } catch (e) {
            // Ignore if customer doesn't exist in local DB
          }
          result[cid] = {
            customerId: cid,
            netOutstandingBalance: 0,
            balanceUpdatedAt: null,
            balanceSyncStatus: 'FAILED',
            balanceSyncError: err.message || 'Unknown error',
          };
        }
      }
    }

    return result;
  }
}

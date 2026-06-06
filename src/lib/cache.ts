// Simple Global In-Memory Cache for Node.js
// Useful for serverless functions (during a single execution or reused container) or long-running Node processes.

// Define global cache maps
const globalAny: any = global;

if (!globalAny.dcrSummaryCache) globalAny.dcrSummaryCache = new Map<string, { data: any; expiry: number }>();
if (!globalAny.dcrInvoiceCache) globalAny.dcrInvoiceCache = new Map<string, { data: any; expiry: number }>();
if (!globalAny.customerBalanceCache) globalAny.customerBalanceCache = new Map<string, { data: any; expiry: number }>();
if (!globalAny.customerStatementCache) globalAny.customerStatementCache = new Map<string, { data: any; expiry: number }>();

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const getCache = (cacheName: 'dcrSummaryCache' | 'dcrInvoiceCache' | 'customerBalanceCache' | 'customerStatementCache', key: string) => {
  const cache: Map<string, { data: any; expiry: number }> = globalAny[cacheName];
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

export const setCache = (cacheName: 'dcrSummaryCache' | 'dcrInvoiceCache' | 'customerBalanceCache' | 'customerStatementCache', key: string, data: any, ttlMs: number = DEFAULT_TTL_MS) => {
  const cache: Map<string, { data: any; expiry: number }> = globalAny[cacheName];
  cache.set(key, { data, expiry: Date.now() + ttlMs });
};

export const clearCache = (cacheName: 'dcrSummaryCache' | 'dcrInvoiceCache' | 'customerBalanceCache' | 'customerStatementCache', key: string) => {
  const cache: Map<string, { data: any; expiry: number }> = globalAny[cacheName];
  cache.delete(key);
};

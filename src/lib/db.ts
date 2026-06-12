import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './database-url';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const datasourceUrl = getDatabaseUrl() || process.env.DATABASE_URL;

/**
 * Prisma Client Singleton
 * Ensures only one instance of Prisma is created across the entire application lifecycle.
 * In production, this maximizes connection reuse during serverless warm starts.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: ['error'], 
  });

// Always attach to global in all environments to prevent churn
globalForPrisma.prisma = prisma;

/**
 * Idempotent Database Initialization
 */
const globalForInit = globalThis as unknown as { __db_initialized?: boolean };

export async function initializeDatabase() {
  if (globalForInit.__db_initialized) return;
  globalForInit.__db_initialized = true;
  
  try {
    // --- TELEMETRY: MONKEY-PATCH GLOBAL FETCH FOR ZOHO TRACKING ---
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_API_TELEMETRY === 'true') {
      if (!(globalThis as any).__fetch_patched) {
        const originalFetch = globalThis.fetch;
        (globalThis as any).fetch = async (...args: any[]) => {
          const urlObj = args[0];
          const urlStr = typeof urlObj === 'string' ? urlObj : urlObj instanceof Request ? urlObj.url : '';
          
          if (urlStr.includes('zohoapis.in') || urlStr.includes('zoho')) {
            const start = performance.now();
            try {
              const res = await (originalFetch as any)(...args);
              const durationMs = Math.round(performance.now() - start);
              
              if (!(globalThis as any).__ZOHO_TELEMETRY__) {
                (globalThis as any).__ZOHO_TELEMETRY__ = [];
              }
              
              let method = 'GET';
              if (args[1] && args[1].method) {
                method = args[1].method.toUpperCase();
              } else if (urlObj instanceof Request && urlObj.method) {
                method = urlObj.method.toUpperCase();
              }
              
              const cleanEndpoint = urlStr.split('?')[0].replace(/https?:\/\/[^\/]+/, 'ZOHO:');
              
              (globalThis as any).__ZOHO_TELEMETRY__.push({
                time: new Date().toISOString(),
                method,
                endpoint: cleanEndpoint,
                durationMs,
                status: res.status,
                source: 'ZOHO'
              });
              
              return res;
            } catch (err) {
              const durationMs = Math.round(performance.now() - start);
              if (!(globalThis as any).__ZOHO_TELEMETRY__) {
                (globalThis as any).__ZOHO_TELEMETRY__ = [];
              }
              let method = 'GET';
              if (args[1] && args[1].method) method = args[1].method.toUpperCase();
              
              (globalThis as any).__ZOHO_TELEMETRY__.push({
                time: new Date().toISOString(),
                method,
                endpoint: urlStr.split('?')[0].replace(/https?:\/\/[^\/]+/, 'ZOHO:'),
                durationMs,
                status: 500,
                source: 'ZOHO'
              });
              throw err;
            }
          }
          return (originalFetch as any)(...args);
        };
        (globalThis as any).__fetch_patched = true;
        console.log('[Telemetry] Backend Zoho API interceptor active.');
      }
    }
    // ----------------------------------------------------------------

    const { ensureInitialUsers } = await import('./initial-data');
    await ensureInitialUsers();

    // Startup Diagnostics Logs
    const userCount = await prisma.user.count();
    const skuCount = await prisma.sku.count();
    const cartCount = await prisma.cart.count();
    const dbUrl = getDatabaseUrl() || 'Unknown';
    const dbName = dbUrl.split('/').pop()?.split('?')[0] || 'Unknown';
    const orgId = process.env.ZOHO_ORGANIZATION_ID || 'Unknown';

    console.log('\n==================================================');
    console.log('       KAMNA TRADERS B2B STARTUP DIAGNOSTICS');
    console.log('==================================================');
    console.log(` Active DB URL:      ${dbUrl}`);
    console.log(` Active DB Name:     ${dbName}`);
    console.log(` Total Users in DB:  ${userCount}`);
    console.log(` Total SKUs in DB:   ${skuCount}`);
    console.log(` Total Carts in DB:  ${cartCount}`);
    console.log(` Zoho Org ID:        ${orgId}`);
    console.log('==================================================\n');
  } catch (err) {
    console.error('[DB] Initialization failed:', err);
    globalForInit.__db_initialized = false; 
  }
}

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

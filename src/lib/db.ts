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
  } catch (err) {
    console.error('[DB] Initialization failed:', err);
    globalForInit.__db_initialized = false; 
  }
}

import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './database-url';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const datasourceUrl = getDatabaseUrl() || process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: ['error'], // Only log errors to save CPU/Memory
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

 
// Idempotent initialization lock (Global-safe for HMR)
const globalForInit = globalThis as unknown as { __db_initialized?: boolean };

export async function initializeDatabase() {
  if (globalForInit.__db_initialized) return;
  globalForInit.__db_initialized = true;
  
  try {
    const { ensureInitialUsers } = await import('./initial-data');
    await ensureInitialUsers();
  } catch (err) {
    console.error('[DB] Initialization failed:', err);
    globalForInit.__db_initialized = false; // Allow retry on failure
  }
}

// Do NOT trigger initial setup at top-level module evaluation
// as it causes HMR memory leaks and promise cascades.

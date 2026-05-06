import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './database-url';
import { ensureInitialUsers } from './initial-data';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const datasourceUrl = getDatabaseUrl() || process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: ['query', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Trigger initial setup (async, non-blocking for the exports)
ensureInitialUsers().catch(err => {
  console.error('Prisma initialization setup failed:', err);
});

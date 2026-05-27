import { prisma } from './db';
import { UAParser } from 'ua-parser-js';

export type DeviceType = 'desktop' | 'mobile';

/**
 * LIGHTWEIGHT IN-MEMORY SESSION CACHE (Shared across lib)
 */
const validationCache = new Map<string, { result: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Detects device type from User Agent string.
 */
export function detectDeviceType(uaString: string | null): DeviceType {
  if (!uaString) return 'desktop';
  const parser = new UAParser(uaString);
  const device = parser.getDevice();
  const os = parser.getOS();

  if (device.type === 'mobile' || device.type === 'tablet') return 'mobile';
  const mobileOS = ['iOS', 'Android', 'Windows Phone', 'BlackBerry'];
  if (os.name && mobileOS.includes(os.name)) return 'mobile';

  return 'desktop';
}

/**
 * Registers a new session in the database.
 */
export async function registerSession(params: {
  userId: string;
  sessionToken: string;
  deviceType: DeviceType;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  const { userId, sessionToken, deviceType, userAgent, ipAddress } = params;
  const start = performance.now();

  try {
    // 1. Invalidate existing sessions of the same type
    await prisma.activeSession.deleteMany({
      where: { userId, deviceType },
    });

    // 2. Create new session
    const session = await prisma.activeSession.create({
      data: {
        userId,
        sessionToken,
        deviceType,
        userAgent,
        ipAddress,
        lastSeenAt: new Date(),
      },
    });

    console.log(`[Perf] registerSession: ${(performance.now() - start).toFixed(2)}ms`);
    return session;
  } catch (err) {
    console.error('[Session] Registration failed:', err);
    throw err;
  }
}

/**
 * Validates session token existence.
 * OPTIMIZATION: Uses 5-min in-memory cache to skip DB roundtrips.
 */
export async function validateSession(sessionToken: string): Promise<{ 
  isValid: boolean; 
  userId?: string; 
  deviceType?: DeviceType;
  permissions?: any; 
}> {
  // Bypass during system reset
  if ((global as any).__SYSTEM_RESET_RUNNING__) {
    return { isValid: true };
  }

  // 1. Check Cache
  const cached = validationCache.get(sessionToken);
  if (cached && cached.expires > Date.now()) {
    // console.log(`[Perf] validateSession: CACHE HIT`);
    return cached.result;
  }

  const startTotal = performance.now();
  
  // 2. DB Lookup (Strict indexed lookup)
  const session = await prisma.activeSession.findUnique({
    where: { sessionToken },
    select: { 
      userId: true, 
      deviceType: true,
      user: {
        select: {
          role: true,
          canManageCarts: true,
          canAdjustInventory: true,
          canRunSkuSync: true,
          canManageZoneMappings: true,
          canManageUnlimitedSkus: true,
          canManageTransfers: true,
          canDeleteTransfers: true,
          accountsAccess: true,
          accounts_customer_statement: true,
          accounts_transactions: true,
          accounts_summary_view: true,
          stock_alerts_manage: true,
        }
      }
    }
  });

  if (session?.user?.role === 'ADMIN') {
    session.user.canManageCarts = true;
    session.user.canAdjustInventory = true;
    session.user.canRunSkuSync = true;
    session.user.canManageZoneMappings = true;
    session.user.canManageUnlimitedSkus = true;
    session.user.canManageTransfers = true;
    session.user.canDeleteTransfers = true;
    session.user.accounts_customer_statement = true;
    session.user.accounts_transactions = true;
    session.user.accounts_summary_view = true;
    session.user.stock_alerts_manage = true;
  }


  const result = session 
    ? { 
        isValid: true, 
        userId: session.userId, 
        deviceType: session.deviceType as DeviceType,
        permissions: session.user 
      }
    : { isValid: false };

  // 3. Update Cache
  validationCache.set(sessionToken, {
    result,
    expires: Date.now() + CACHE_TTL
  });

  const totalDuration = performance.now() - startTotal;
  console.log(`[Perf] validateSession (DB): ${totalDuration.toFixed(2)}ms`);

  return result;
}

/**
 * Removes a specific session (Logout).
 */
export async function invalidateSession(sessionToken: string) {
  validationCache.delete(sessionToken);
  return await prisma.activeSession.delete({
    where: { sessionToken },
  }).catch(() => null); 
}

/**
 * Lightweight cleanup: Only deletes rows older than 7 days.
 */
export async function cleanupStaleSessions() {
  const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    await prisma.activeSession.deleteMany({
      where: { lastSeenAt: { lt: threshold } },
    });
  } catch (err) {
    console.error('[Session] Cleanup failed:', err);
  }
}

import { prisma } from './db';
import { UAParser } from 'ua-parser-js';

export type DeviceType = 'desktop' | 'mobile';

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
 * Model: Single Desktop + Single Mobile enforcement.
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
    // 1. Invalidate existing sessions of the same type (Simple, Fast Delete)
    await prisma.activeSession.deleteMany({
      where: { userId, deviceType },
    });

    // 2. Create new session (ONE WRITE per login)
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

    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(`[Session] SLOW REGISTRATION: ${duration.toFixed(2)}ms`);
    }
    return session;
  } catch (err) {
    console.error('[Session] Registration failed:', err);
    throw err;
  }
}

/**
 * Validates session token existence using strictly indexed lookup.
 * NO SIDE EFFECTS: No lastSeen updates, no stale cleanup, no writes.
 */
export async function validateSession(sessionToken: string): Promise<{ isValid: boolean; userId?: string; deviceType?: DeviceType }> {
  // Bypass during system reset to prevent deadlock
  if ((global as any).__SYSTEM_RESET_RUNNING__) {
    return { isValid: true };
  }

  const start = performance.now();
  
  // Strict indexed lookup on sessionToken
  const session = await prisma.activeSession.findUnique({
    where: { sessionToken },
    select: { userId: true, deviceType: true }
  });

  const duration = performance.now() - start;
  if (duration > 300) {
    console.warn(`[Session] SLOW VALIDATION: ${duration.toFixed(2)}ms (Token: ${sessionToken.slice(0, 8)}...)`);
  }

  if (!session) {
    return { isValid: false };
  }

  return { 
    isValid: true, 
    userId: session.userId,
    deviceType: session.deviceType as DeviceType
  };
}

/**
 * Removes a specific session (Logout).
 */
export async function invalidateSession(sessionToken: string) {
  return await prisma.activeSession.delete({
    where: { sessionToken },
  }).catch(() => null); 
}

/**
 * Lightweight cleanup: Only deletes rows older than 7 days.
 * To be called infrequently (e.g. background worker or manual trigger).
 */
export async function cleanupStaleSessions() {
  const start = performance.now();
  const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const deleted = await prisma.activeSession.deleteMany({
      where: {
        lastSeenAt: { lt: threshold },
      },
    });
    console.log(`[Session] Purged ${deleted.count} stale sessions in ${(performance.now() - start).toFixed(2)}ms`);
  } catch (err) {
    console.error('[Session] Cleanup failed:', err);
  }
}

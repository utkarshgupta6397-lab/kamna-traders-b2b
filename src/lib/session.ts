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

  if (device.type === 'mobile' || device.type === 'tablet') {
    return 'mobile';
  }

  const mobileOS = ['iOS', 'Android', 'Windows Phone', 'BlackBerry'];
  if (os.name && mobileOS.includes(os.name)) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Registers a new session in the database.
 * FORENSIC: Measures registration duration.
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

    console.log(`[Session] Register duration: ${(performance.now() - start).toFixed(2)}ms`);
    return session;
  } catch (err) {
    console.error('[Session] Registration failed:', err);
    throw err;
  }
}

/**
 * Validates session token existence using strict indexed lookup.
 * FORENSIC: Logs lookup duration.
 */
export async function validateSession(sessionToken: string): Promise<{ isValid: boolean; userId?: string; deviceType?: DeviceType }> {
  const start = performance.now();
  
  // Lookup using ONLY indexed sessionToken
  const session = await prisma.activeSession.findUnique({
    where: { sessionToken },
    select: { userId: true, deviceType: true }
  });

  const duration = performance.now() - start;
  if (duration > 50) {
    console.warn(`[Session] FORENSIC: Slow validation query: ${duration.toFixed(2)}ms`);
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
 * Throttled Heartbeat: Updates lastSeenAt ONLY if > 5 minutes have passed.
 * FORENSIC: Measures heartbeat check vs write timings.
 */
export async function heartbeatSession(sessionToken: string) {
  const start = performance.now();
  
  try {
    // 1. Read check
    const session = await prisma.activeSession.findUnique({
      where: { sessionToken },
      select: { lastSeenAt: true }
    });

    const readDuration = performance.now() - start;
    if (!session) return;

    const fiveMinutes = 5 * 60 * 1000;
    const timeSinceLastSeen = Date.now() - session.lastSeenAt.getTime();

    // 2. Throttle
    if (timeSinceLastSeen < fiveMinutes) {
      return;
    }

    // 3. Write update (Non-Blocking)
    const writeStart = performance.now();
    prisma.activeSession.update({
      where: { sessionToken },
      data: { lastSeenAt: new Date() }
    }).then(() => {
      const writeDuration = performance.now() - writeStart;
      const total = performance.now() - start;
      if (total > 500) {
        console.warn(`[Session] FORENSIC: Slow heartbeat (Read: ${readDuration.toFixed(2)}ms, Write: ${writeDuration.toFixed(2)}ms, Total: ${total.toFixed(2)}ms)`);
      }
    }).catch(err => {
      console.error('[Session] Heartbeat write failed:', err);
    });

  } catch (err) {
    console.error('[Session] Heartbeat process failed:', err);
  }
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
 * Expire stale sessions.
 * 1. Mobile: 15 days
 * 2. Desktop: 7 days
 * 3. Orphaned/Stale: 7 days (Hard cleanup)
 */
export async function cleanupStaleSessions() {
  const start = performance.now();
  const desktopThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const mobileThreshold = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const hardCleanupThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const deleted = await prisma.activeSession.deleteMany({
      where: {
        OR: [
          { deviceType: 'desktop', lastSeenAt: { lt: desktopThreshold } },
          { deviceType: 'mobile', lastSeenAt: { lt: mobileThreshold } },
          { lastSeenAt: { lt: hardCleanupThreshold } }, // 7-day hard purge for orphans
        ],
      },
    });
    console.log(`[Session] Cleanup completed in ${(performance.now() - start).toFixed(2)}ms. Deleted: ${deleted.count}`);
  } catch (err) {
    console.error('[Session] Cleanup failed:', err);
  }
}

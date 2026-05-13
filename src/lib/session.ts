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
 * MEASURES: Registration duration to detect lock contention.
 */
export async function registerSession(params: {
  userId: string;
  sessionToken: string;
  deviceType: DeviceType;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  const { userId, sessionToken, deviceType, userAgent, ipAddress } = params;
  const start = Date.now();

  try {
    // 1. Invalidate existing sessions of the same type (Fast with Index)
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

    console.log(`[Session] Registered in ${Date.now() - start}ms`);
    return session;
  } catch (err) {
    console.error('[Session] Registration failed:', err);
    throw err;
  }
}

/**
 * Validates session token existence.
 * REMOVED: Automatic heartbeat from validation to prevent DB contention on every navigation.
 */
export async function validateSession(sessionToken: string): Promise<{ isValid: boolean; userId?: string; deviceType?: DeviceType }> {
  const start = Date.now();
  
  const session = await prisma.activeSession.findUnique({
    where: { sessionToken },
    select: { userId: true, deviceType: true }
  });

  const duration = Date.now() - start;
  if (duration > 100) {
    console.warn(`[Session] Slow validation query: ${duration}ms`);
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
 * STRICTLY NON-BLOCKING & FIRE-AND-FORGET.
 */
export async function heartbeatSession(sessionToken: string) {
  const start = Date.now();
  
  try {
    // 1. Check current lastSeenAt first (Read is cheaper than Write)
    const session = await prisma.activeSession.findUnique({
      where: { sessionToken },
      select: { lastSeenAt: true }
    });

    if (!session) return;

    const fiveMinutes = 5 * 60 * 1000;
    const timeSinceLastSeen = Date.now() - session.lastSeenAt.getTime();

    // 2. Throttle: Only update if older than 5 minutes
    if (timeSinceLastSeen < fiveMinutes) {
      return;
    }

    // 3. Update (Non-Blocking)
    prisma.activeSession.update({
      where: { sessionToken },
      data: { lastSeenAt: new Date() }
    }).then(() => {
      const updateDuration = Date.now() - start;
      if (updateDuration > 500) {
        console.warn(`[Session] Slow heartbeat write: ${updateDuration}ms`);
      }
    }).catch(err => {
      console.error('[Session] Heartbeat update failed:', err);
    });

  } catch (err) {
    // Non-blocking failures
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
 * Expire stale sessions based on device type.
 * MEASURES: Cleanup duration.
 */
export async function cleanupStaleSessions() {
  const start = Date.now();
  const desktopThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const mobileThreshold = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

  try {
    const deleted = await prisma.activeSession.deleteMany({
      where: {
        OR: [
          { deviceType: 'desktop', lastSeenAt: { lt: desktopThreshold } },
          { deviceType: 'mobile', lastSeenAt: { lt: mobileThreshold } },
        ],
      },
    });
    console.log(`[Session] Cleaned up ${deleted.count} stale sessions in ${Date.now() - start}ms`);
  } catch (err) {
    console.error('[Session] Cleanup failed:', err);
  }
}

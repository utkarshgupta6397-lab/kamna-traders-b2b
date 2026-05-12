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

  // Treat tablets and phones as mobile
  if (device.type === 'mobile' || device.type === 'tablet') {
    return 'mobile';
  }

  // OS-based fallback
  const mobileOS = ['iOS', 'Android', 'Windows Phone', 'BlackBerry'];
  if (os.name && mobileOS.includes(os.name)) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Registers a new session in the database.
 * If a session of the same type already exists, it is invalidated (deleted).
 */
export async function registerSession(params: {
  userId: string;
  sessionToken: string;
  deviceType: DeviceType;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  const { userId, sessionToken, deviceType, userAgent, ipAddress } = params;

  // 1. Invalidate existing sessions of the same type
  await prisma.activeSession.deleteMany({
    where: {
      userId,
      deviceType,
    },
  });

  // 2. Create new session
  return await prisma.activeSession.create({
    data: {
      userId,
      sessionToken,
      deviceType,
      userAgent,
      ipAddress,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Validates that the session token exists and is the latest for its device type.
 */
export async function validateSession(sessionToken: string): Promise<{ isValid: boolean; userId?: string; deviceType?: DeviceType }> {
  const session = await prisma.activeSession.findUnique({
    where: { sessionToken },
    select: { userId: true, deviceType: true, lastSeenAt: true }
  });

  if (!session) {
    return { isValid: false };
  }

  // Heartbeat: Update lastSeenAt (async, don't block)
  prisma.activeSession.update({
    where: { sessionToken },
    data: { lastSeenAt: new Date() }
  }).catch(err => console.error('[Session] Heartbeat update failed:', err));

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
  }).catch(() => null); // Ignore if already deleted
}

/**
 * Expire stale sessions based on device type.
 * Mobile: 15 days
 * Desktop: 7 days
 */
export async function cleanupStaleSessions() {
  const desktopThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const mobileThreshold = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

  await prisma.activeSession.deleteMany({
    where: {
      OR: [
        { deviceType: 'desktop', lastSeenAt: { lt: desktopThreshold } },
        { deviceType: 'mobile', lastSeenAt: { lt: mobileThreshold } },
      ],
    },
  });
}

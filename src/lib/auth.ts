import { cookies, headers } from 'next/headers';
import { encrypt, decrypt } from './jwt';

export { encrypt, decrypt };

export async function createSession(params: {
  userId: string;
  role: string;
  deviceType: string;
  userAgent: string | null;
  ipAddress: string | null;
}) {
  const start = performance.now();
  const { userId, role, deviceType, userAgent, ipAddress } = params;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  const sessionToken = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  console.log(`[Auth] Creating session for ${userId} (${role}). Token: ${sessionToken.slice(0, 8)}...`);

  const { registerSession } = await import('./session');
  await registerSession({
    userId,
    sessionToken,
    deviceType: deviceType as any,
    userAgent,
    ipAddress
  });

  const jwt = await encrypt({ userId, role, sessionToken, deviceType, expires: expires.toISOString() });
  const cookieStore = await cookies();
  cookieStore.set('session', jwt, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' });

  const duration = performance.now() - start;
  if (duration > 1000) {
    console.warn(`[Auth] SLOW LOGIN: ${duration.toFixed(2)}ms`);
  }
}

export async function getSession(): Promise<Record<string, unknown> | null> {
  // 1. Bypass during system reset to avoid deadlocks
  if ((global as any).__SYSTEM_RESET_RUNNING__) {
    return null; // Or return a mock if needed, but null is safer to force re-auth after reset
  }

  const cookieStore = await cookies();
  const jwt = cookieStore.get('session')?.value;
  if (!jwt) return null;
  
  try {
    const start = performance.now();
    const payload = await decrypt(jwt);
    const sessionToken = payload.sessionToken as string;

    if (!sessionToken) return payload;

    // 2. Server-side validation (Read-Only)
    // We do this in the Layout (Node.js runtime)
    const { validateSession } = await import('./session');
    const { isValid } = await validateSession(sessionToken);
    
    if (!isValid) {
      console.warn(`[Auth] Session token ${sessionToken.slice(0, 8)} NOT found in DB.`);
      return null;
    }

    const duration = performance.now() - start;
    if (duration > 300) {
      console.warn(`[Auth] SLOW SESSION RETRIEVAL: ${duration.toFixed(2)}ms`);
    }

    return payload;
  } catch (err) {
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get('session')?.value;
  
  if (jwt) {
    try {
      const payload = await decrypt(jwt);
      if (payload.sessionToken) {
        const { invalidateSession } = await import('./session');
        await invalidateSession(payload.sessionToken as string);
      }
    } catch (err) {
      // Ignore
    }
  }

  cookieStore.set('session', '', { expires: new Date(0) });
}

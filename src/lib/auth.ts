import { cookies } from 'next/headers';
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
  
  // 1. Generate unique session token
  const sessionToken = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // 2. Encrypt JWT
  const jwt = await encrypt({ userId, role, sessionToken, deviceType, expires: expires.toISOString() });
  
  // 3. Register in DB (ONE WRITE)
  const { registerSession } = await import('./session');
  await registerSession({
    userId,
    sessionToken,
    deviceType: deviceType as any,
    userAgent,
    ipAddress
  });

  // 4. Set Cookie
  const cookieStore = await cookies();
  cookieStore.set('session', jwt, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' });

  const duration = performance.now() - start;
  if (duration > 1000) {
    console.warn(`[Auth] SLOW LOGIN: ${duration.toFixed(2)}ms`);
  }
}

export async function getSession(): Promise<Record<string, unknown> | null> {
  const cookieStore = await cookies();
  const jwt = cookieStore.get('session')?.value;
  if (!jwt) return null;
  
  try {
    const start = performance.now();
    const payload = await decrypt(jwt);
    const sessionToken = payload.sessionToken as string;

    if (!sessionToken) return payload;

    // 1. Check if middleware already validated this session (De-duplication)
    const { headers } = await import('next/headers');
    const headersList = await headers();
    if (headersList.get('x-session-validated') === 'true') {
      return payload;
    }

    // 2. Server-side validation (Read-Only)
    const { validateSession } = await import('./session');
    const { isValid } = await validateSession(sessionToken);
    
    if (!isValid) {
      console.warn(`[Auth] Session token ${sessionToken.slice(0, 8)} invalidated by DB.`);
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

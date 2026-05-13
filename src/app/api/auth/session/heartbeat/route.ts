import { NextResponse } from 'next/server';
import { heartbeatSession } from '@/lib/session';
import { decrypt } from '@/lib/jwt';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * Lightweight Heartbeat API.
 * Called by the client periodically or on navigation to keep session alive.
 * Strictly non-blocking and throttled in lib/session.ts
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get('session')?.value;
    
    if (!jwt) {
      return NextResponse.json({ success: false, reason: 'no_session' }, { status: 401 });
    }

    const payload = await decrypt(jwt).catch(() => null);
    if (!payload?.sessionToken) {
      return NextResponse.json({ success: false, reason: 'invalid_token' }, { status: 401 });
    }

    // Fire and forget heartbeat (throttled inside)
    heartbeatSession(payload.sessionToken as string);

    return NextResponse.json({ success: true });
  } catch (error) {
    // Fail silently to never block user experience
    return NextResponse.json({ success: true, warning: 'heartbeat_deferred' });
  }
}

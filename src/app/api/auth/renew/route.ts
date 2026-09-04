import { NextResponse } from 'next/server';
import { getSession, encrypt } from '@/lib/auth';
import { updateSessionLastSeen } from '@/lib/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 1. Validate the session using existing caching and validation logic
    const session = await getSession();
    
    if (!session || !session.sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    // 2. Update the database lastSeenAt to prevent early stale cleanup
    await updateSessionLastSeen(session.sessionToken);

    // 3. Issue a new JWT
    const jwt = await encrypt({
      userId: session.userId,
      role: session.role,
      sessionToken: session.sessionToken,
      deviceType: session.deviceType,
      expires: expires.toISOString()
    });

    // 4. Set the new cookie
    const cookieStore = await cookies();
    const domain = process.env.COOKIE_DOMAIN || undefined;
    
    const isSecure = process.env.NODE_ENV === 'production' && 
      process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');

    cookieStore.set('session', jwt, { 
      expires, 
      httpOnly: true, 
      secure: !!isSecure || !!process.env.HTTPS_LOCAL, 
      sameSite: 'lax',
      domain
    });

    return NextResponse.json({ success: true, expires: expires.toISOString() });
  } catch (error) {
    console.error('[Auth Renew] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

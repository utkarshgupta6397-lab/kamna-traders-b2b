import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/jwt';
import { validateSession } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass all checks during system reset
  if ((global as any).__SYSTEM_RESET_RUNNING__) {
    return NextResponse.next();
  }

  // Define protected routes
  const isAdminPath = pathname.startsWith('/admin');
  const isStaffPath = pathname.startsWith('/staff/dashboard');

  if (isAdminPath || isStaffPath) {
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/staff', request.url));
    }

    try {
      // 2. Decode JWT (Read-only)
      const session = await decrypt(sessionCookie);
      
      if (!session) {
        throw new Error('Invalid JWT');
      }

      // 3. Source of Truth Validation (Read-only lookup)
      // This is fast due to indexing on sessionToken
      const validation = await validateSession(session.sessionToken as string);

      if (!validation.isValid) {
        console.warn(`[Middleware] Session ${session.sessionToken} invalidated.`);
        const loginUrl = new URL('/staff', request.url);
        loginUrl.searchParams.set('error', 'expired');
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set('session', '', { expires: new Date(0) });
        return response;
      }

      // 4. Role Authorization
      if (isAdminPath && session.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/staff/dashboard', request.url));
      }

      // 5. Success: Set validation header to skip redundant DB calls in Layouts
      const response = NextResponse.next();
      response.headers.set('x-session-validated', 'true');
      return response;

    } catch (err) {
      console.error('[Middleware] Auth failure:', err);
      const loginUrl = new URL('/staff', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.set('session', '', { expires: new Date(0) });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/staff/dashboard/:path*'],
};

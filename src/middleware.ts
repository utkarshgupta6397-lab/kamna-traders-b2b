import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/jwt';

/**
 * Middleware to protect /admin/* and /staff/* routes.
 * - Redirects unauthenticated users to the login page.
 * - Enforces role checks where applicable.
 * - Leaves public routes and assets untouched.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to the login page itself to avoid infinite redirects
  if (pathname === '/staff') {
    return NextResponse.next();
  }

  // Apply protection only to admin and staff sections
  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) {
    const sessionCookie = request.cookies.get('session')?.value;
    let session = null;
    if (sessionCookie) {
      session = await decrypt(sessionCookie).catch(() => null);
    }

    // No session → redirect to login (preserve intended URL)
    if (!session?.userId || !session?.sessionToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/staff'; 
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Server-side source of truth validation
    // We call the internal API because Prisma is not Edge-compatible
    try {
      const validateUrl = new URL('/api/auth/session/validate', request.url);
      const validateRes = await fetch(validateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: session.sessionToken })
      });
      const validation = await validateRes.json();
      
      if (!validation.isValid) {
        console.warn(`[Middleware] Session ${session.sessionToken} invalidated by DB.`);
        const loginUrl = new URL('/staff', request.url);
        loginUrl.searchParams.set('error', 'superseded');
        
        // Clear the stale cookie
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set('session', '', { expires: new Date(0) });
        return response;
      }

      // 3. Success: Continue with validated header to skip duplicate lookups in layout/components
      const response = NextResponse.next();
      response.headers.set('x-session-validated', 'true');
      return response;
    } catch (err) {
      console.error('[Middleware] Session validation failed:', err);
    }

    // Admin routes require ADMIN role
    if (pathname.startsWith('/admin') && session.role !== 'ADMIN') {
      const unauthorizedUrl = request.nextUrl.clone();
      unauthorizedUrl.pathname = '/unauthorized';
      return NextResponse.redirect(unauthorizedUrl);
    }

    // Staff routes allow STAFF or ADMIN roles
    if (pathname.startsWith('/staff') && !['STAFF', 'ADMIN'].includes(session.role as string)) {
      const unauthorizedUrl = request.nextUrl.clone();
      unauthorizedUrl.pathname = '/unauthorized';
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  // Allow all other requests (public pages, assets, API routes) to continue
  return NextResponse.next();
}

// Restrict matcher to the two protected prefixes
export const config = {
  matcher: ['/admin/:path*', '/staff/:path*'],
};

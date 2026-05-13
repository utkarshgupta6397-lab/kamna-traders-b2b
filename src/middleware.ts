import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/jwt';

/**
 * LIGHTWEIGHT MIDDLEWARE (Edge-Safe)
 * Strictly decodes JWT and checks roles.
 * NO Database lookups here (Edge runtime cannot use Node.js Prisma client).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass during reset (Note: global is not shared between Edge and Node)
  // We'll rely on layouts to handle the reset lock for now.

  const isAdminPath = pathname.startsWith('/admin');
  const isStaffPath = pathname.startsWith('/staff/dashboard');

  if (isAdminPath || isStaffPath) {
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      console.log(`[Middleware] No cookie for ${pathname}. Redirecting to /staff`);
      return NextResponse.redirect(new URL('/staff', request.url));
    }

    try {
      // 2. Decode JWT (Read-only, Edge-safe)
      const session = await decrypt(sessionCookie);
      if (!session) {
        console.warn(`[Middleware] JWT decode failed for ${pathname}`);
        throw new Error('Invalid JWT');
      }

      // 3. Role Authorization
      if (isAdminPath && session.role !== 'ADMIN') {
        console.warn(`[Middleware] Role mismatch: ${session.role} tried to access ${pathname}. Redirecting to /staff/dashboard`);
        return NextResponse.redirect(new URL('/staff/dashboard', request.url));
      }

      // 4. Success: Pass to Layout for DB-based token validation (Node.js runtime)
      console.log(`[Middleware] SUCCESS: ${session.role} decoded for ${pathname}`);
      return NextResponse.next();

    } catch (err) {
      console.error('[Middleware] Decode Error:', err);
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

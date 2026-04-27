import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

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
    const session = await getSession();

    // No session → redirect to login (preserve intended URL)
    if (!session?.userId) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/staff'; // The login page is at /staff
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
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

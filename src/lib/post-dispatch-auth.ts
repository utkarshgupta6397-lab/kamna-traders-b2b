import { hasMobileFeatureAccess } from './mobile-auth';
import { PermissionKey } from './permissions';

interface SessionUser {
  userId?: string;
  id?: string;
  role?: string;
  name?: string;
  [key: string]: unknown;
}

type Session = SessionUser | null | undefined;

/**
 * Checks if user has access to Post Dispatch on desktop.
 * Admin always has access.
 * Staff requires dispatch_view AND dispatch_post_dispatch.
 */
export function hasDesktopPostDispatchAccess(session: Session): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  return Boolean(session.dispatch_view && session.dispatch_post_dispatch);
}

/**
 * Checks if user has access to Post Dispatch on mobile.
 * Admin always has access.
 * Staff requires mobile_dispatch AND mobile_dispatch_post_dispatch.
 */
export function hasMobilePostDispatchAccess(session: Session): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  return hasMobileFeatureAccess(session, 'mobile_dispatch', 'mobile_dispatch_post_dispatch');
}

/**
 * Checks if user has access to Post Dispatch (either desktop or mobile workspace).
 * Admin always has access.
 */
export function hasPostDispatchAccess(session: Session): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  return hasDesktopPostDispatchAccess(session) || hasMobilePostDispatchAccess(session);
}

/**
 * Checks if user has specific Post Dispatch child permission.
 * Respects both mobile child permissions and desktop permissions appropriately.
 */
export function hasPostDispatchPermission(session: Session, childKey: PermissionKey | string): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;

  // Must have access to Post-Dispatch
  if (!hasPostDispatchAccess(session)) return false;

  // Granular check:
  // If checking a mobile child permission, require mobile post dispatch access + child permission
  if (String(childKey).startsWith('mobile_dispatch_post_dispatch_')) {
    if (!hasMobilePostDispatchAccess(session)) return false;
    return !!session[childKey];
  }

  // If checking a desktop dispatch permission, require desktop post dispatch access + child permission
  if (String(childKey).startsWith('dispatch_')) {
    if (!hasDesktopPostDispatchAccess(session)) return false;
    return !!session[childKey];
  }

  return !!session[childKey];
}

/**
 * Server-side validation: Uploader CANNOT self-verify.
 */
export function canVerifySubmission(session: Session, uploadedByUserId: string, verifyPermissionKey: PermissionKey | string): {
  allowed: boolean;
  error?: string;
  statusCode?: number;
} {
  if (!session) {
    return { allowed: false, error: 'Unauthorized', statusCode: 401 };
  }

  // Check permission hierarchy
  if (!hasPostDispatchPermission(session, verifyPermissionKey)) {
    return {
      allowed: false,
      error: 'You do not have permission to verify this submission.',
      statusCode: 403,
    };
  }

  // Critical business rule: Uploader cannot self-verify (even if Admin)
  const currentUserId = (session.userId as string) || (session.id as string);
  if (currentUserId && currentUserId === uploadedByUserId) {
    return {
      allowed: false,
      error: 'Uploader cannot self-verify their own submission.',
      statusCode: 403,
    };
  }

  return { allowed: true };
}

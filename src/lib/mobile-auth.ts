import { PermissionKey } from './permissions';

type Session = Record<string, any> | null | undefined;

/**
 * Checks if the session has a specific mobile permission.
 * - If session is null/undefined: false
 * - If role === 'ADMIN': true
 * - Otherwise: checks the mobile_* boolean property directly on session.
 *
 * NOTE: Does NOT check or fallback to any old desktop permission.
 */
export function hasMobilePermission(
  session: Session,
  permissionKey: PermissionKey | string
): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  return !!session[permissionKey];
}

/**
 * Checks parent-child mobile feature access.
 * Enforces hierarchy: Both parent AND child permissions MUST be enabled.
 *
 * Example:
 *   hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_solar_panel')
 *   -> returns true only if BOTH are true (or if ADMIN).
 */
export function hasMobileFeatureAccess(
  session: Session,
  parentKey: PermissionKey | string,
  childKey?: PermissionKey | string
): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;

  // Parent must be granted
  if (!session[parentKey]) return false;

  // If a child is specified, child must also be granted
  if (childKey && !session[childKey]) return false;

  return true;
}

/**
 * Standardized 403 Forbidden payload for Mobile APIs.
 */
export function mobileForbiddenResponse(featureName?: string) {
  const message = featureName
    ? `You do not have mobile permission to access ${featureName}.`
    : 'You do not have permission to perform this mobile action.';
  return { error: message, code: 'FORBIDDEN_MOBILE_FEATURE' };
}
